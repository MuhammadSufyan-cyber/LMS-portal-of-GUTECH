import { randomUUID } from 'node:crypto';
import { getServiceSupabase } from '../config/supabase.js';
import { assertCourseAccess, findCourse } from '../repositories/courses.repository.js';
import * as resources from '../repositories/resources.repository.js';
import type { AuthenticatedUser } from '../types/auth.js';
import { HttpError } from '../utils/http-error.js';

interface UploadFile {
  buffer: Buffer;
  originalname: string;
  size: number;
}
const MAX_BYTES = 25 * 1024 * 1024;
const allowedExtensions = new Set([
  '.pdf',
  '.docx',
  '.pptx',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.zip',
]);
function detectMime(file: UploadFile): string {
  const extension = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
  const bytes = file.buffer;
  if (bytes.subarray(0, 5).toString('ascii') === '%PDF-')
    return extension === '.pdf' ? 'application/pdf' : '';
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return extension === '.png' ? 'image/png' : '';
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])))
    return ['.jpg', '.jpeg'].includes(extension) ? 'image/jpeg' : '';
  if (
    bytes
      .subarray(0, 6)
      .toString('ascii')
      .match(/^GIF8[79]a$/)
  )
    return extension === '.gif' ? 'image/gif' : '';
  if (
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  )
    return extension === '.webp' ? 'image/webp' : '';
  const isZip =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    [0x03, 0x05, 0x07].includes(bytes[2] ?? -1) &&
    [0x04, 0x06, 0x08].includes(bytes[3] ?? -1);
  if (isZip && extension === '.zip') return 'application/zip';
  if (isZip && extension === '.docx')
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (isZip && extension === '.pptx')
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  return '';
}

export async function listCourseResources(
  user: AuthenticatedUser,
  courseId: string,
  page: number,
  pageSize: number,
  search?: string,
) {
  const course = await findCourse(courseId);
  if (!course) throw new HttpError(404, 'COURSE_NOT_FOUND', 'Course not found.');
  if (course.is_archived && user.role === 'student')
    throw new HttpError(403, 'FORBIDDEN', 'This course is archived.');
  await assertCourseAccess(user.id, user.role, courseId);
  return resources.listResources(courseId, page, pageSize, search);
}

export async function uploadCourseResource(
  user: AuthenticatedUser,
  courseId: string,
  input: { title: string; description?: string },
  file?: UploadFile,
) {
  if (!file) throw new HttpError(422, 'FILE_REQUIRED', 'Choose a file to upload.');
  if (file.size > MAX_BYTES)
    throw new HttpError(413, 'FILE_TOO_LARGE', 'Files must be 25 MB or smaller.');
  const course = await findCourse(courseId);
  if (!course) throw new HttpError(404, 'COURSE_NOT_FOUND', 'Course not found.');
  if (user.role !== 'admin' && user.role !== 'teacher')
    throw new HttpError(403, 'FORBIDDEN', 'Only course staff can upload resources.');
  if (user.role === 'teacher') await assertCourseAccess(user.id, user.role, courseId);
  const extension = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
  const mimeType = allowedExtensions.has(extension) ? detectMime(file) : '';
  if (!mimeType)
    throw new HttpError(
      422,
      'FILE_TYPE_NOT_ALLOWED',
      'Use a valid PDF, DOCX, PPTX, image, or ZIP file.',
    );
  const safeName = file.originalname
    .split(/[\\/]/)
    .pop()!
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-120);
  const filePath = `${courseId}/${randomUUID()}-${safeName}`;
  const storage = getServiceSupabase().storage.from('resources');
  const { error: uploadError } = await storage.upload(filePath, file.buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (uploadError)
    throw new HttpError(502, 'FILE_UPLOAD_FAILED', 'The file could not be stored. Try again.');
  let row: Awaited<ReturnType<typeof resources.saveResource>>;
  try {
    row = await resources.saveResource({
      courseId,
      uploadedBy: user.id,
      title: input.title,
      description: input.description,
      filePath,
      fileName: safeName,
      mimeType,
      sizeBytes: file.size,
    });
  } catch (error) {
    await storage.remove([filePath]);
    throw error;
  }
  await resources.auditResource(user.id, 'resource.uploaded', row.id);
  return {
    id: row.id,
    title: row.title,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    createdAt: row.created_at,
  };
}

export async function downloadResource(user: AuthenticatedUser, id: string) {
  const row = await resources.requireResource(id);
  const course = await findCourse(row.course_id);
  if (!course) throw new HttpError(404, 'COURSE_NOT_FOUND', 'Course not found.');
  if (course.is_archived && user.role === 'student')
    throw new HttpError(403, 'FORBIDDEN', 'This course is archived.');
  await assertCourseAccess(user.id, user.role, row.course_id);
  const { data, error } = await getServiceSupabase()
    .storage.from('resources')
    .createSignedUrl(row.file_path, 60);
  if (error || !data?.signedUrl)
    throw new HttpError(502, 'SIGNED_URL_FAILED', 'A download link could not be created.');
  return { url: data.signedUrl, expiresIn: 60 };
}

export async function deleteResource(user: AuthenticatedUser, id: string) {
  const row = await resources.requireResource(id);
  if (user.role !== 'admin' && row.uploaded_by !== user.id)
    throw new HttpError(
      403,
      'FORBIDDEN',
      'Only the uploader or an administrator can delete this resource.',
    );
  const { error: storageError } = await getServiceSupabase()
    .storage.from('resources')
    .remove([row.file_path]);
  if (storageError)
    throw new HttpError(502, 'FILE_DELETE_FAILED', 'The stored file could not be removed.');
  await resources.deleteResource(id);
  await resources.auditResource(user.id, 'resource.deleted', id);
}

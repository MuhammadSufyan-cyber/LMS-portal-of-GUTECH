import { parse } from 'csv-parse/sync';
import { getServiceSupabase } from '../config/supabase.js';
import * as repository from '../repositories/courses.repository.js';
import { writeAudit } from '../repositories/profile.repository.js';
import type { AuthenticatedUser } from '../types/auth.js';
import { HttpError } from '../utils/http-error.js';

export async function listAdminCourses(input: { page: number; pageSize: number; search?: string }) {
  return repository.listCourses(input);
}

export async function createCourse(
  actor: AuthenticatedUser,
  input: { code: string; title: string; description?: string | null },
) {
  const course = await repository.createCourse(input);
  await writeAudit(actor.id, 'course.created', 'course', String(course.id));
  return course;
}

export async function updateCourse(
  actor: AuthenticatedUser,
  id: string,
  input: { code?: string; title?: string; description?: string | null; isArchived?: boolean },
) {
  const patch = {
    ...(input.code ? { code: input.code } : {}),
    ...(input.title ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.isArchived !== undefined ? { is_archived: input.isArchived } : {}),
  };
  const course = await repository.updateCourse(id, patch);
  await writeAudit(actor.id, input.isArchived ? 'course.archived' : 'course.updated', 'course', id);
  return course;
}

export async function replaceTeachers(actor: AuthenticatedUser, courseId: string, ids: string[]) {
  if (!(await repository.findCourse(courseId)))
    throw new HttpError(404, 'COURSE_NOT_FOUND', 'Course not found.');
  await repository.replaceCourseTeachers(courseId, [...new Set(ids)]);
  await writeAudit(actor.id, 'course.teachers.updated', 'course', courseId);
  return (await repository.listCourseMembers(courseId, 'teacher', 1, 100)).data;
}

export async function enroll(actor: AuthenticatedUser, courseId: string, studentIds: string[]) {
  if (!(await repository.findCourse(courseId)))
    throw new HttpError(404, 'COURSE_NOT_FOUND', 'Course not found.');
  const result = await repository.enrollStudents(courseId, studentIds);
  await writeAudit(actor.id, 'course.students.enrolled', 'course', courseId);
  return result;
}

async function resolveStudentCsv(courseId: string, csv: string) {
  let records: Array<Record<string, string>>;
  try {
    records = parse(csv, { columns: true, skip_empty_lines: true, trim: true, bom: true }) as Array<
      Record<string, string>
    >;
  } catch {
    throw new HttpError(400, 'CSV_INVALID', 'The CSV file could not be parsed.');
  }
  if (records.length > 500)
    throw new HttpError(413, 'CSV_TOO_MANY_ROWS', 'Import up to 500 students per CSV file.');
  if (!records.length)
    return { matched: 0, ids: [] as string[], duplicateInput: 0, unknownEmails: [] as string[] };
  const emailColumn = Object.keys(records[0] ?? {}).find(
    (column) => column.toLowerCase() === 'email',
  );
  if (!emailColumn)
    throw new HttpError(422, 'CSV_EMAIL_COLUMN_REQUIRED', 'CSV must include an email column.');
  const emails = records
    .map((row) => row[emailColumn]?.trim().toLowerCase())
    .filter((email): email is string => Boolean(email));
  const uniqueEmails = [...new Set(emails)];
  if (!uniqueEmails.length)
    throw new HttpError(422, 'CSV_EMAILS_REQUIRED', 'CSV must contain at least one email address.');
  const { data: students, error } = await getServiceSupabase()
    .from('profiles')
    .select('id,email')
    .in('email', uniqueEmails)
    .eq('role', 'student')
    .eq('is_active', true);
  if (error) throw error;
  const emailToId = new Map(
    (students ?? []).map((student) => [student.email.toLowerCase(), student.id]),
  );
  const unknownEmails = uniqueEmails.filter((email) => !emailToId.has(email));
  const ids = emails.map((email) => emailToId.get(email)).filter((id): id is string => Boolean(id));
  return {
    matched: ids.length,
    ids,
    duplicateInput: emails.length - uniqueEmails.length,
    unknownEmails,
  };
}

export async function previewStudentCsv(courseId: string, csv: string) {
  if (!(await repository.findCourse(courseId)))
    throw new HttpError(404, 'COURSE_NOT_FOUND', 'Course not found.');
  const parsed = await resolveStudentCsv(courseId, csv);
  const { data: existing, error } = parsed.ids.length
    ? await getServiceSupabase()
        .from('enrollments')
        .select('student_id')
        .eq('course_id', courseId)
        .in('student_id', [...new Set(parsed.ids)])
    : { data: [], error: null };
  if (error) throw error;
  return {
    matched: parsed.matched,
    duplicate: parsed.duplicateInput + (existing ?? []).length,
    unknownEmails: parsed.unknownEmails,
  };
}

export async function importStudentCsv(actor: AuthenticatedUser, courseId: string, csv: string) {
  if (!(await repository.findCourse(courseId)))
    throw new HttpError(404, 'COURSE_NOT_FOUND', 'Course not found.');
  const parsed = await resolveStudentCsv(courseId, csv);
  const result = parsed.ids.length
    ? await repository.enrollStudents(courseId, parsed.ids)
    : { enrolled: 0, duplicates: 0 };
  await writeAudit(actor.id, 'course.students.csv_imported', 'course', courseId);
  return {
    matched: parsed.matched,
    enrolled: result.enrolled,
    duplicate: result.duplicates,
    unknownEmails: parsed.unknownEmails,
  };
}

export async function removeStudent(actor: AuthenticatedUser, courseId: string, studentId: string) {
  await repository.unenrollStudent(courseId, studentId);
  await writeAudit(actor.id, 'course.student.unenrolled', 'course', courseId);
}

export async function myCourses(
  userId: string,
  role: AuthenticatedUser['role'],
  page: number,
  pageSize: number,
) {
  return repository.coursesForUser(userId, role, page, pageSize);
}

export async function getCourse(user: AuthenticatedUser, id: string) {
  const course = await repository.findCourse(id);
  if (!course) throw new HttpError(404, 'COURSE_NOT_FOUND', 'Course not found.');
  if (course.is_archived && user.role === 'student')
    throw new HttpError(403, 'FORBIDDEN', 'This course is archived.');
  await repository.assertCourseAccess(user.id, user.role, id);
  return {
    id: course.id,
    code: course.code,
    title: course.title,
    description: course.description,
    isArchived: course.is_archived,
    createdAt: course.created_at,
    updatedAt: course.updated_at,
  };
}

export async function courseMembers(
  id: string,
  role: 'teacher' | 'student',
  page: number,
  pageSize: number,
) {
  if (!(await repository.findCourse(id)))
    throw new HttpError(404, 'COURSE_NOT_FOUND', 'Course not found.');
  return repository.listCourseMembers(id, role, page, pageSize);
}

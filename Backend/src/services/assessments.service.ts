import { randomUUID } from 'node:crypto';
import { getServiceSupabase } from '../config/supabase.js';
import { assertCourseAccess, findCourse } from '../repositories/courses.repository.js';
import { writeAudit } from '../repositories/profile.repository.js';
import * as assessments from '../repositories/assessments.repository.js';
import type { AuthenticatedUser } from '../types/auth.js';
import { HttpError } from '../utils/http-error.js';

async function accessibleCourse(user: AuthenticatedUser, courseId: string) {
  const course = await findCourse(courseId);
  if (!course) throw new HttpError(404, 'COURSE_NOT_FOUND', 'Course not found.');
  if (course.is_archived && user.role === 'student')
    throw new HttpError(403, 'FORBIDDEN', 'This course is archived.');
  await assertCourseAccess(user.id, user.role, courseId);
}
export async function listAssignments(user: AuthenticatedUser, courseId: string) {
  await accessibleCourse(user, courseId);
  const rows = await assessments.listAssignments(courseId);
  if (user.role !== 'student') return rows;
  return rows.map((row) => {
    const sanitized = { ...row };
    delete sanitized.created_by;
    return sanitized;
  });
}
export async function createAssignment(
  user: AuthenticatedUser,
  courseId: string,
  input: Record<string, unknown>,
) {
  if (user.role !== 'admin' && user.role !== 'teacher')
    throw new HttpError(403, 'FORBIDDEN', 'Only course staff can create assignments.');
  await accessibleCourse(user, courseId);
  const result = await assessments.createAssignment(courseId, user.id, input);
  await writeAudit(user.id, 'assignment.created', 'assignment', result.id);
  return result;
}
interface AssignmentFile {
  buffer: Buffer;
  originalname: string;
  size: number;
}
function validateAssignmentFile(file: AssignmentFile) {
  if (file.size > 30 * 1024 * 1024)
    throw new HttpError(413, 'FILE_TOO_LARGE', 'Files must be 30 MB or smaller.');
  const ext = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
  const bytes = file.buffer;
  const pdf = ext === '.pdf' && bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  const zip =
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    [0x03, 0x05, 0x07].includes(bytes[2] ?? -1) &&
    [0x04, 0x06, 0x08].includes(bytes[3] ?? -1);
  if (!(pdf || (zip && ['.docx', '.pptx', '.zip'].includes(ext))))
    throw new HttpError(422, 'FILE_TYPE_NOT_ALLOWED', 'Attach a PDF, DOCX, PPTX, or ZIP file.');
  return file.originalname
    .split(/[\\/]/)
    .pop()!
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-120);
}
export async function submitAssignment(
  user: AuthenticatedUser,
  id: string,
  textAnswer: string,
  file?: AssignmentFile,
) {
  if (user.role !== 'student')
    throw new HttpError(403, 'FORBIDDEN', 'Only students can submit assignments.');
  const assignment = await assessments.findAssignment(id);
  await accessibleCourse(user, assignment.course_id);
  const late = Date.now() > new Date(assignment.due_at).getTime();
  if (late && !assignment.allow_late)
    throw new HttpError(409, 'DEADLINE_PASSED', 'The assignment deadline has passed.');
  const prior = await assessments.mySubmission(id, user.id);
  if (prior?.graded_at)
    throw new HttpError(409, 'ALREADY_GRADED', 'A graded submission cannot be changed.');
  if (!textAnswer.trim() && !file)
    throw new HttpError(422, 'SUBMISSION_REQUIRED', 'Add a response or attach a file.');
  let filePath: string | null = null;
  const fileName = file ? validateAssignmentFile(file) : undefined;
  if (file && fileName) {
    filePath = `${user.id}/${id}/${randomUUID()}-${fileName}`;
    const { error } = await getServiceSupabase()
      .storage.from('submissions')
      .upload(filePath, file.buffer, { upsert: false });
    if (error)
      throw new HttpError(502, 'FILE_UPLOAD_FAILED', 'The submission file could not be stored.');
  }
  let result: Awaited<ReturnType<typeof assessments.saveSubmission>>;
  try {
    result = await assessments.saveSubmission(id, user.id, textAnswer, late, filePath);
  } catch (error) {
    if (filePath) await getServiceSupabase().storage.from('submissions').remove([filePath]);
    throw error;
  }
  if (prior?.file_path && prior.file_path !== filePath)
    await getServiceSupabase().storage.from('submissions').remove([prior.file_path]);
  await writeAudit(user.id, 'assignment.submitted', 'assignment', id);
  return result;
}
export async function submissions(
  user: AuthenticatedUser,
  id: string,
  page: number,
  pageSize: number,
) {
  const assignment = await assessments.findAssignment(id);
  await accessibleCourse(user, assignment.course_id);
  if (user.role === 'student') {
    const row = await assessments.mySubmission(id, user.id);
    return {
      data: row ? [{ ...row, has_attachment: Boolean(row.file_path), file_path: undefined }] : [],
      total: row ? 1 : 0,
    };
  }
  const result = await assessments.listSubmissions(id, page, pageSize);
  return {
    ...result,
    data: result.data.map((row) => ({
      ...row,
      has_attachment: Boolean(row.file_path),
      file_path: undefined,
    })),
  };
}
export async function submissionDownload(user: AuthenticatedUser, submissionId: string) {
  const submission = await assessments.findSubmission(submissionId);
  if (!submission.file_path)
    throw new HttpError(404, 'FILE_NOT_FOUND', 'This submission has no attachment.');
  if (user.role === 'student' && submission.student_id !== user.id)
    throw new HttpError(403, 'FORBIDDEN', 'You cannot access this submission.');
  const assignment = await assessments.findAssignment(submission.assignment_id);
  await accessibleCourse(user, assignment.course_id);
  const { data, error } = await getServiceSupabase()
    .storage.from('submissions')
    .createSignedUrl(submission.file_path, 60);
  if (error || !data?.signedUrl)
    throw new HttpError(502, 'SIGNED_URL_FAILED', 'A download link could not be created.');
  return { url: data.signedUrl, expiresIn: 60 };
}
export async function grade(user: AuthenticatedUser, id: string, marks: number, feedback?: string) {
  if (user.role !== 'admin' && user.role !== 'teacher')
    throw new HttpError(403, 'FORBIDDEN', 'Only course staff can grade.');
  const { data: submission, error } = await getServiceSupabase()
    .from('submissions')
    .select('assignment_id')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!submission) throw new HttpError(404, 'SUBMISSION_NOT_FOUND', 'Submission not found.');
  const assignment = await assessments.findAssignment(submission.assignment_id);
  await accessibleCourse(user, assignment.course_id);
  const result = await assessments.gradeSubmission(id, user.id, marks, feedback);
  await writeAudit(user.id, 'assignment.graded', 'submission', id);
  return result;
}

export async function listQuizzes(user: AuthenticatedUser, courseId: string) {
  await accessibleCourse(user, courseId);
  return assessments.listQuizzes(courseId, user.role === 'student');
}
export async function createQuiz(
  user: AuthenticatedUser,
  courseId: string,
  input: Parameters<typeof assessments.createQuiz>[2],
) {
  if (user.role === 'student')
    throw new HttpError(403, 'FORBIDDEN', 'Only course staff can create quizzes.');
  await accessibleCourse(user, courseId);
  const now = Date.now();
  if (new Date(input.opensAt).getTime() < now - 60_000 || new Date(input.closesAt).getTime() <= now)
    throw new HttpError(422, 'QUIZ_TIME_INVALID', 'Quiz availability must be in the future.');
  const result = await assessments.createQuiz(courseId, user.id, input);
  await writeAudit(user.id, 'quiz.created', 'quiz', result.id);
  return result;
}
async function accessibleQuiz(user: AuthenticatedUser, quizId: string, enforceWindow = false) {
  const { data: quiz, error } = await getServiceSupabase()
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .maybeSingle();
  if (error) throw error;
  if (!quiz) throw new HttpError(404, 'QUIZ_NOT_FOUND', 'Quiz not found.');
  await accessibleCourse(user, quiz.course_id);
  if (user.role === 'student') {
    if (!quiz.is_published) throw new HttpError(404, 'QUIZ_NOT_FOUND', 'Quiz not found.');
    const now = Date.now();
    if (
      enforceWindow &&
      (now < new Date(quiz.opens_at).getTime() || now > new Date(quiz.closes_at).getTime())
    )
      throw new HttpError(409, 'QUIZ_UNAVAILABLE', 'This quiz is outside its availability window.');
  }
  return quiz;
}
export async function startQuiz(user: AuthenticatedUser, quizId: string) {
  if (user.role !== 'student')
    throw new HttpError(403, 'FORBIDDEN', 'Only students can take quizzes.');
  await accessibleQuiz(user, quizId, true);
  return assessments.startQuiz(quizId, user.id);
}
export async function submitQuiz(
  user: AuthenticatedUser,
  quizId: string,
  answers: Record<string, string[]>,
) {
  if (user.role !== 'student')
    throw new HttpError(403, 'FORBIDDEN', 'Only students can submit quizzes.');
  const quiz = await accessibleQuiz(user, quizId, true);
  const published = (await assessments.listQuizzes(quiz.course_id, true)).find(
    (row) => row.id === quizId,
  );
  const questions = (published?.questions ?? []) as Array<{
    id: string;
    options: Array<{ id: string }>;
  }>;
  const allowed = new Map(
    questions.map((question) => [
      question.id,
      new Set(question.options.map((option) => option.id)),
    ]),
  );
  for (const [questionId, selected] of Object.entries(answers)) {
    const optionIds = allowed.get(questionId);
    if (!optionIds || selected.some((optionId) => !optionIds.has(optionId)))
      throw new HttpError(
        422,
        'QUIZ_ANSWER_INVALID',
        'An answer contains an option that is not part of this quiz.',
      );
  }
  const attempt = await assessments.getAttempt(quizId, user.id);
  if (!attempt) throw new HttpError(409, 'QUIZ_NOT_STARTED', 'Start the quiz before submitting.');
  const deadline = Math.min(
    new Date(quiz.closes_at).getTime(),
    new Date(attempt.started_at).getTime() + quiz.time_limit_minutes * 60_000,
  );
  if (Date.now() > deadline)
    throw new HttpError(409, 'QUIZ_TIME_EXPIRED', 'The quiz time limit has expired.');
  const result = await assessments.submitQuiz(quizId, user.id, answers);
  await writeAudit(user.id, 'quiz.submitted', 'quiz', quizId);
  return result;
}
export async function quizAttempt(user: AuthenticatedUser, quizId: string) {
  await accessibleQuiz(user, quizId);
  if (user.role !== 'student')
    throw new HttpError(403, 'FORBIDDEN', 'Only students have quiz attempts.');
  return assessments.getAttempt(quizId, user.id);
}

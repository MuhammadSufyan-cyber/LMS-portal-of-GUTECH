import { assertCourseAccess, findCourse } from '../repositories/courses.repository.js';
import * as repository from '../repositories/communication.repository.js';
import type { AuthenticatedUser } from '../types/auth.js';
import { HttpError } from '../utils/http-error.js';
import { writeAudit } from '../repositories/profile.repository.js';
async function access(user: AuthenticatedUser, courseId: string) {
  const course = await findCourse(courseId);
  if (!course) throw new HttpError(404, 'COURSE_NOT_FOUND', 'Course not found.');
  if (course.is_archived && user.role === 'student')
    throw new HttpError(403, 'FORBIDDEN', 'This course is archived.');
  await assertCourseAccess(user.id, user.role, courseId);
}
export async function announcements(
  user: AuthenticatedUser,
  courseId: string,
  page: number,
  pageSize: number,
) {
  await access(user, courseId);
  return repository.listAnnouncements(courseId, user.id, page, pageSize);
}
export async function createAnnouncement(
  user: AuthenticatedUser,
  courseId: string,
  input: { title: string; body: string; isPinned: boolean },
) {
  if (user.role === 'student')
    throw new HttpError(403, 'FORBIDDEN', 'Only course staff can post announcements.');
  await access(user, courseId);
  const row = await repository.createAnnouncement(courseId, user.id, input);
  await writeAudit(user.id, 'announcement.created', 'announcement', row.id);
  return row;
}
export async function markRead(user: AuthenticatedUser, courseId: string, id: string) {
  await access(user, courseId);
  await repository.markAnnouncementRead(id, courseId, user.id);
}
export async function messages(
  user: AuthenticatedUser,
  courseId: string,
  page: number,
  pageSize: number,
) {
  await access(user, courseId);
  return repository.listMessages(courseId, page, pageSize);
}
export async function sendMessage(user: AuthenticatedUser, courseId: string, body: string) {
  await access(user, courseId);
  return repository.sendMessage(courseId, user.id, body);
}

import * as repository from '../repositories/complaints.repository.js';
import { findCourse, assertCourseAccess } from '../repositories/courses.repository.js';
import { writeAudit } from '../repositories/profile.repository.js';
import type { AuthenticatedUser } from '../types/auth.js';
import { HttpError } from '../utils/http-error.js';
export async function list(
  user: AuthenticatedUser,
  page: number,
  pageSize: number,
  status?: string,
) {
  return repository.listComplaints(user.id, user.role === 'admin', page, pageSize, status);
}
export async function create(
  user: AuthenticatedUser,
  input: { courseId?: string; category: string; subject: string; description: string },
) {
  if (input.courseId) {
    const course = await findCourse(input.courseId);
    if (!course) throw new HttpError(404, 'COURSE_NOT_FOUND', 'Course not found.');
    await assertCourseAccess(user.id, user.role, input.courseId);
  }
  const row = await repository.createComplaint(user.id, input);
  await writeAudit(user.id, 'complaint.created', 'complaint', row.id);
  return row;
}
export async function update(
  user: AuthenticatedUser,
  id: string,
  input: { status: string; adminResponse?: string },
) {
  if (user.role !== 'admin')
    throw new HttpError(403, 'FORBIDDEN', 'Only administrators can manage complaints.');
  const row = await repository.updateComplaint(id, user.id, input);
  if (!row) throw new HttpError(404, 'COMPLAINT_NOT_FOUND', 'Complaint not found.');
  await writeAudit(user.id, 'complaint.updated', 'complaint', id);
  return row;
}

import { getServiceSupabase } from '../config/supabase.js';
import type { UserRole } from '../types/auth.js';
import { HttpError } from '../utils/http-error.js';

function mapCourse(course: Record<string, unknown>) {
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

export async function listCourses(input: { page: number; pageSize: number; search?: string }) {
  let query = getServiceSupabase()
    .from('courses')
    .select('id,code,title,description,is_archived,created_at,updated_at', { count: 'exact' });
  if (input.search)
    query = query.or(
      `code.ilike.%${input.search.replace(/[,%_()]/g, ' ')}%,title.ilike.%${input.search.replace(/[,%_()]/g, ' ')}%`,
    );
  const from = (input.page - 1) * input.pageSize;
  const { data, error, count } = await query.order('code').range(from, from + input.pageSize - 1);
  if (error) throw error;
  return {
    data: (data ?? []).map((course) => mapCourse(course as Record<string, unknown>)),
    total: count ?? 0,
  };
}

export async function createCourse(input: {
  code: string;
  title: string;
  description?: string | null;
}) {
  const { data, error } = await getServiceSupabase()
    .from('courses')
    .insert({ ...input, code: input.code.toUpperCase() })
    .select()
    .single();
  if (error?.code === '23505')
    throw new HttpError(409, 'COURSE_CODE_EXISTS', 'A course with this code already exists.');
  if (error) throw error;
  return mapCourse(data as Record<string, unknown>);
}

export async function updateCourse(
  id: string,
  patch: { code?: string; title?: string; description?: string | null; is_archived?: boolean },
) {
  const dbPatch = { ...patch, ...(patch.code ? { code: patch.code.toUpperCase() } : {}) };
  const { data, error } = await getServiceSupabase()
    .from('courses')
    .update(dbPatch)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error?.code === '23505')
    throw new HttpError(409, 'COURSE_CODE_EXISTS', 'A course with this code already exists.');
  if (error) throw error;
  if (!data) throw new HttpError(404, 'COURSE_NOT_FOUND', 'Course not found.');
  return mapCourse(data as Record<string, unknown>);
}

export async function findCourse(id: string) {
  const { data, error } = await getServiceSupabase()
    .from('courses')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function coursesForUser(
  userId: string,
  role: UserRole,
  page: number,
  pageSize: number,
) {
  const db = getServiceSupabase();
  if (role === 'admin') {
    const from = (page - 1) * pageSize;
    const { data, error, count } = await db
      .from('courses')
      .select('*', { count: 'exact' })
      .eq('is_archived', false)
      .order('code')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    return {
      data: (data ?? []).map((course) => mapCourse(course as Record<string, unknown>)),
      total: count ?? 0,
    };
  }
  const relation = role === 'teacher' ? 'course_teachers' : 'enrollments';
  const ownerColumn = role === 'teacher' ? 'teacher_id' : 'student_id';
  const { data: memberships, error: membershipError } = await db
    .from(relation)
    .select('course_id')
    .eq(ownerColumn, userId);
  if (membershipError) throw membershipError;
  const courseIds = (memberships ?? []).map((row) => row.course_id as string);
  if (!courseIds.length) return { data: [], total: 0 };
  const from = (page - 1) * pageSize;
  const { data, error, count } = await db
    .from('courses')
    .select('*', { count: 'exact' })
    .in('id', courseIds)
    .eq('is_archived', false)
    .order('code')
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return {
    data: (data ?? []).map((course) => mapCourse(course as Record<string, unknown>)),
    total: count ?? 0,
  };
}

export async function assertCourseAccess(userId: string, role: UserRole, courseId: string) {
  if (role === 'admin') return;
  const relation = role === 'teacher' ? 'course_teachers' : 'enrollments';
  const ownerColumn = role === 'teacher' ? 'teacher_id' : 'student_id';
  const { data, error } = await getServiceSupabase()
    .from(relation)
    .select('course_id')
    .eq('course_id', courseId)
    .eq(ownerColumn, userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this course.');
}

export async function replaceCourseTeachers(courseId: string, teacherIds: string[]) {
  const db = getServiceSupabase();
  const { data: teachers, error: teacherError } = teacherIds.length
    ? await db
        .from('profiles')
        .select('id')
        .in('id', teacherIds)
        .eq('role', 'teacher')
        .eq('is_active', true)
    : { data: [], error: null };
  if (teacherError) throw teacherError;
  if ((teachers ?? []).length !== new Set(teacherIds).size)
    throw new HttpError(
      422,
      'INVALID_TEACHERS',
      'Every assigned account must be an active teacher.',
    );
  if (teacherIds.length) {
    const { error } = await db.from('course_teachers').upsert(
      teacherIds.map((teacherId) => ({ course_id: courseId, teacher_id: teacherId })),
      { onConflict: 'course_id,teacher_id', ignoreDuplicates: true },
    );
    if (error) throw error;
  }
  const stale = await db.from('course_teachers').select('teacher_id').eq('course_id', courseId);
  if (stale.error) throw stale.error;
  const staleIds = (stale.data ?? [])
    .map((row) => row.teacher_id)
    .filter((id) => !teacherIds.includes(id));
  if (staleIds.length) {
    const { error } = await db
      .from('course_teachers')
      .delete()
      .eq('course_id', courseId)
      .in('teacher_id', staleIds);
    if (error) throw error;
  }
}

export async function listCourseMembers(
  courseId: string,
  role: 'teacher' | 'student',
  page: number,
  pageSize: number,
) {
  const db = getServiceSupabase();
  const table = role === 'teacher' ? 'course_teachers' : 'enrollments';
  const column = role === 'teacher' ? 'teacher_id' : 'student_id';
  const from = (page - 1) * pageSize;
  const { data, error, count } = await db
    .from(table)
    .select(column, { count: 'exact' })
    .eq('course_id', courseId)
    .range(from, from + pageSize - 1);
  if (error) throw error;
  const ids = (data ?? []).map(
    (row) => ('teacher_id' in row ? row.teacher_id : row.student_id) as string,
  );
  if (!ids.length) return { data: [], total: count ?? 0 };
  const { data: profiles, error: profileError } = await db
    .from('profiles')
    .select('id,full_name,email,role,roll_no,is_active')
    .in('id', ids)
    .order('full_name');
  if (profileError) throw profileError;
  return {
    data: (profiles ?? []).map((profile) => ({
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      role: profile.role,
      rollNo: profile.roll_no,
      isActive: profile.is_active,
    })),
    total: count ?? 0,
  };
}

export async function enrollStudents(courseId: string, studentIds: string[]) {
  const ids = [...new Set(studentIds)];
  const db = getServiceSupabase();
  const { data: students, error: studentError } = await db
    .from('profiles')
    .select('id')
    .in('id', ids)
    .eq('role', 'student')
    .eq('is_active', true);
  if (studentError) throw studentError;
  const validIds = (students ?? []).map((student) => student.id);
  if (validIds.length !== ids.length)
    throw new HttpError(
      422,
      'INVALID_STUDENTS',
      'Every selected account must be an active student.',
    );
  const { data: existing, error: existingError } = await db
    .from('enrollments')
    .select('student_id')
    .eq('course_id', courseId)
    .in('student_id', validIds);
  if (existingError) throw existingError;
  const { error } = await db.from('enrollments').upsert(
    validIds.map((studentId) => ({ course_id: courseId, student_id: studentId })),
    { onConflict: 'course_id,student_id', ignoreDuplicates: true },
  );
  if (error) throw error;
  const existingIds = new Set((existing ?? []).map((row) => row.student_id));
  return {
    enrolled: validIds.filter((id) => !existingIds.has(id)).length,
    duplicates: studentIds.length - ids.length + existingIds.size,
  };
}

export async function unenrollStudent(courseId: string, studentId: string) {
  const { error, count } = await getServiceSupabase()
    .from('enrollments')
    .delete({ count: 'exact' })
    .eq('course_id', courseId)
    .eq('student_id', studentId);
  if (error) throw error;
  if (!count) throw new HttpError(404, 'ENROLLMENT_NOT_FOUND', 'Enrollment not found.');
}

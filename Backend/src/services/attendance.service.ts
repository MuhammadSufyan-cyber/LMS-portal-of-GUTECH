import { getServiceSupabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import type { AuthenticatedUser } from '../types/auth.js';

async function getDemoAttendancePreview(user: AuthenticatedUser) {
  const db = getServiceSupabase();
  const { data: courses, error: courseError } = await db
    .from('courses')
    .select('id,code,title')
    .in('code', ['AIT201', 'SE220', 'DS310']);
  if (courseError) throw courseError;
  let courseRows = courses ?? [];
  if (user.role === 'teacher') {
    const { data, error } = await db
      .from('course_teachers')
      .select('course_id')
      .eq('teacher_id', user.id);
    if (error) throw error;
    const assignedIds = new Set((data ?? []).map((row) => row.course_id));
    courseRows = courseRows.filter((course) => assignedIds.has(course.id));
  }
  if (!courseRows.length) return { data: [], total: 0 };

  const courseIds = courseRows.map((course) => course.id);
  const { data: enrollments, error: enrollmentError } = await db
    .from('enrollments')
    .select('course_id,student_id')
    .in('course_id', courseIds);
  if (enrollmentError) throw enrollmentError;
  const studentIds = [...new Set((enrollments ?? []).map((row) => row.student_id))].filter(
    (studentId) => user.role !== 'student' || studentId === user.id,
  );
  if (!studentIds.length) return { data: [], total: 0 };
  const { data: students, error: studentError } = await db
    .from('profiles')
    .select('id,full_name,roll_no')
    .in('id', studentIds);
  if (studentError) throw studentError;

  const classDays = ['2026-10-19', '2026-10-21', '2026-10-26', '2026-10-28'];
  const statuses = ['present', 'present', 'late', 'present', 'absent', 'present', 'excused'];
  const studentById = new Map((students ?? []).map((student) => [student.id, student]));
  const courseById = new Map(courseRows.map((course) => [course.id, course]));
  const records = (enrollments ?? []).flatMap((enrollment, enrollmentIndex) => {
    if (!studentIds.includes(enrollment.student_id)) return [];
    const student = studentById.get(enrollment.student_id);
    const course = courseById.get(enrollment.course_id);
    if (!student || !course) return [];
    return classDays.map((classDate, dayIndex) => ({
      id: `demo-preview-${course.id}-${student.id}-${classDate}`,
      course_id: course.id,
      student_id: student.id,
      class_date: classDate,
      status: statuses[(enrollmentIndex + dayIndex) % statuses.length],
      notes: 'seed:demo-preview',
      course: { code: course.code, title: course.title },
      student: { full_name: student.full_name, roll_no: student.roll_no },
    }));
  });
  records.sort((left, right) => right.class_date.localeCompare(left.class_date));
  return { data: records, total: records.length };
}

export async function listAttendance(user: AuthenticatedUser, page: number, pageSize: number) {
  const db = getServiceSupabase();
  let courseIds: string[] | null = null;
  if (user.role === 'teacher') {
    const { data, error } = await db
      .from('course_teachers')
      .select('course_id')
      .eq('teacher_id', user.id);
    if (error) throw error;
    courseIds = (data ?? []).map((row) => row.course_id);
    if (!courseIds.length) return { data: [], total: 0 };
  }

  const from = (page - 1) * pageSize;
  let query = db
    .from('attendance_records')
    .select(
      'id,course_id,student_id,class_date,status,notes,course:courses!inner(code,title),student:profiles!attendance_records_student_id_fkey(full_name,roll_no)',
      { count: 'exact' },
    )
    .order('class_date', { ascending: false })
    .order('course_id')
    .range(from, from + pageSize - 1);
  if (user.role === 'student') query = query.eq('student_id', user.id);
  if (courseIds) query = query.in('course_id', courseIds);
  const { data, error, count } = await query;
  if (error) {
    if (env.NODE_ENV === 'development' && error.code === 'PGRST205') {
      return getDemoAttendancePreview(user);
    }
    throw error;
  }
  return { data: data ?? [], total: count ?? 0 };
}

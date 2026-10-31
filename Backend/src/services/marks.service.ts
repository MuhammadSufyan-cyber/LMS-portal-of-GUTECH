import { getServiceSupabase } from '../config/supabase.js';
import type { AuthenticatedUser } from '../types/auth.js';
import { HttpError } from '../utils/http-error.js';
export async function getMarks(user: AuthenticatedUser, page: number, pageSize: number) {
  if (user.role !== 'student')
    throw new HttpError(403, 'FORBIDDEN', 'Marks are available to student accounts.');
  const from = (page - 1) * pageSize;
  const { data, error, count } = await getServiceSupabase()
    .from('v_student_marks')
    .select('course_id,kind,item_id,title,obtained,max,graded_at', { count: 'exact' })
    .eq('student_id', user.id)
    .order('graded_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

import { getServiceSupabase } from '../config/supabase.js';
export async function listComplaints(
  userId: string,
  isAdmin: boolean,
  page: number,
  pageSize: number,
  status?: string,
) {
  let query = getServiceSupabase()
    .from('complaints')
    .select('*,profile:profiles!complaints_raised_by_fkey(full_name,email)', { count: 'exact' });
  if (!isAdmin) query = query.eq('raised_by', userId);
  if (status) query = query.eq('status', status);
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}
export async function createComplaint(
  userId: string,
  input: { courseId?: string; category: string; subject: string; description: string },
) {
  const { data, error } = await getServiceSupabase()
    .from('complaints')
    .insert({
      raised_by: userId,
      course_id: input.courseId ?? null,
      category: input.category,
      subject: input.subject,
      description: input.description,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
export async function updateComplaint(
  id: string,
  adminId: string,
  input: { status: string; adminResponse?: string },
) {
  const { data, error } = await getServiceSupabase()
    .from('complaints')
    .update({
      status: input.status,
      admin_response: input.adminResponse ?? null,
      resolved_by: ['resolved', 'rejected'].includes(input.status) ? adminId : null,
    })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data;
}

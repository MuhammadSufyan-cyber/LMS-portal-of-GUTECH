import { getServiceSupabase } from '../config/supabase.js';
import { HttpError } from '../utils/http-error.js';
export async function listAnnouncements(
  courseId: string,
  userId: string,
  page: number,
  pageSize: number,
) {
  const db = getServiceSupabase();
  const from = (page - 1) * pageSize;
  const { data, error, count } = await db
    .from('announcements')
    .select('*,author:profiles!announcements_author_id_fkey(full_name)', { count: 'exact' })
    .eq('course_id', courseId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  const ids = (data ?? []).map((row) => row.id);
  const { data: reads, error: readError } = ids.length
    ? await db
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', userId)
        .in('announcement_id', ids)
    : { data: [], error: null };
  if (readError) throw readError;
  const readIds = new Set((reads ?? []).map((row) => row.announcement_id));
  return {
    data: (data ?? []).map((row) => ({ ...row, is_read: readIds.has(row.id) })),
    total: count ?? 0,
  };
}
export async function createAnnouncement(
  courseId: string,
  authorId: string,
  input: { title: string; body: string; isPinned: boolean },
) {
  const { data, error } = await getServiceSupabase()
    .from('announcements')
    .insert({ course_id: courseId, author_id: authorId, ...input })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
export async function markAnnouncementRead(id: string, courseId: string, userId: string) {
  const { data: announcement, error: lookupError } = await getServiceSupabase()
    .from('announcements')
    .select('id')
    .eq('id', id)
    .eq('course_id', courseId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!announcement) throw new HttpError(404, 'ANNOUNCEMENT_NOT_FOUND', 'Announcement not found.');
  const { error } = await getServiceSupabase()
    .from('announcement_reads')
    .upsert(
      { announcement_id: id, user_id: userId },
      { onConflict: 'user_id,announcement_id', ignoreDuplicates: true },
    );
  if (error) throw error;
}
export async function listMessages(courseId: string, page: number, pageSize: number) {
  const from = (page - 1) * pageSize;
  const { data, error, count } = await getServiceSupabase()
    .from('chat_messages')
    .select(
      'id,course_id,sender_id,body,created_at,profile:profiles!chat_messages_sender_id_fkey(full_name)',
      { count: 'exact' },
    )
    .eq('course_id', courseId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return { data: (data ?? []).reverse(), total: count ?? 0 };
}
export async function sendMessage(courseId: string, senderId: string, body: string) {
  const { data, error } = await getServiceSupabase()
    .from('chat_messages')
    .insert({ course_id: courseId, sender_id: senderId, body })
    .select(
      'id,course_id,sender_id,body,created_at,profile:profiles!chat_messages_sender_id_fkey(full_name)',
    )
    .single();
  if (error) throw error;
  return data;
}

import { getServiceSupabase } from '../config/supabase.js';
import { HttpError } from '../utils/http-error.js';

export async function listResources(
  courseId: string,
  page: number,
  pageSize: number,
  search?: string,
) {
  let query = getServiceSupabase()
    .from('resources')
    .select(
      'id,course_id,uploaded_by,title,description,file_path,file_name,mime_type,size_bytes,created_at',
      { count: 'exact' },
    )
    .eq('course_id', courseId);
  if (search) query = query.ilike('title', `%${search.replace(/[%_]/g, ' ')}%`);
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      courseId: row.course_id,
      uploadedBy: row.uploaded_by,
      title: row.title,
      description: row.description,
      fileName: row.file_name,
      mimeType: row.mime_type,
      sizeBytes: Number(row.size_bytes),
      createdAt: row.created_at,
    })),
    total: count ?? 0,
  };
}

export async function saveResource(input: {
  courseId: string;
  uploadedBy: string;
  title: string;
  description?: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const { data, error } = await getServiceSupabase()
    .from('resources')
    .insert({
      course_id: input.courseId,
      uploaded_by: input.uploadedBy,
      title: input.title,
      description: input.description ?? null,
      file_path: input.filePath,
      file_name: input.fileName,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
    })
    .select(
      'id,course_id,uploaded_by,title,description,file_path,file_name,mime_type,size_bytes,created_at',
    )
    .single();
  if (error) throw error;
  return data;
}

export async function findResource(id: string) {
  const { data, error } = await getServiceSupabase()
    .from('resources')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteResource(id: string) {
  const { error } = await getServiceSupabase().from('resources').delete().eq('id', id);
  if (error) throw error;
}

export async function auditResource(actorId: string, action: string, id: string) {
  const { error } = await getServiceSupabase()
    .from('audit_log')
    .insert({ actor_id: actorId, action, entity: 'resource', entity_id: id });
  if (error) throw error;
}

export async function requireResource(id: string) {
  const resource = await findResource(id);
  if (!resource) throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'Resource not found.');
  return resource;
}

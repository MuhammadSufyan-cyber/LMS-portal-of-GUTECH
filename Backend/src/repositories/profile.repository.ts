import { getServiceSupabase } from '../config/supabase.js';
import type { UserRole } from '../types/auth.js';

export interface ProfileRecord {
  id: string;
  full_name: string;
  username: string;
  email: string;
  role: UserRole;
  roll_no: string | null;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
}
export function toApiProfile(profile: ProfileRecord) {
  return {
    id: profile.id,
    fullName: profile.full_name,
    username: profile.username,
    email: profile.email,
    role: profile.role,
    rollNo: profile.roll_no,
    isActive: profile.is_active,
    mustChangePassword: profile.must_change_password,
    createdAt: profile.created_at,
  };
}

export async function getProfileById(id: string): Promise<ProfileRecord | null> {
  const { data, error } = await getServiceSupabase()
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as ProfileRecord | null;
}

export async function listProfiles(input: {
  page: number;
  pageSize: number;
  role?: UserRole;
  search?: string;
}) {
  let query = getServiceSupabase()
    .from('profiles')
    .select('id,full_name,username,email,role,roll_no,is_active,must_change_password,created_at', {
      count: 'exact',
    });
  if (input.role) query = query.eq('role', input.role);
  if (input.search) {
    const safe = input.search.replace(/[,%_()]/g, ' ').trim();
    if (safe)
      query = query.or(`full_name.ilike.%${safe}%,username.ilike.%${safe}%,email.ilike.%${safe}%`);
  }
  const from = (input.page - 1) * input.pageSize;
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + input.pageSize - 1);
  if (error) throw error;
  return { data: ((data ?? []) as ProfileRecord[]).map(toApiProfile), total: count ?? 0 };
}

export async function updateProfile(
  id: string,
  patch: { full_name?: string; username?: string; role?: UserRole; is_active?: boolean },
) {
  const { data, error } = await getServiceSupabase()
    .from('profiles')
    .update(patch)
    .eq('id', id)
    .select('id,full_name,username,email,role,roll_no,is_active,must_change_password,created_at')
    .single();
  if (error) throw error;
  return toApiProfile(data as ProfileRecord);
}

export async function writeAudit(
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
) {
  const { error } = await getServiceSupabase()
    .from('audit_log')
    .insert({ actor_id: actorId, action, entity, entity_id: entityId });
  if (error) throw error;
}

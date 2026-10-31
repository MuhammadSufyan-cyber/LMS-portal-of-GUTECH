import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';

let serviceClient: SupabaseClient | undefined;

function requireSupabaseConfig(): { url: string; publishableKey: string } {
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
  if (!env.SUPABASE_URL || !publishableKey) {
    throw new Error('Supabase URL and publishable key must be configured in Backend/.env');
  }
  return { url: env.SUPABASE_URL, publishableKey };
}

export function getPublicSupabase(): SupabaseClient {
  const { url, publishableKey } = requireSupabaseConfig();
  // Auth calls mutate a client's in-memory session; return an isolated client per request.
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getServiceSupabase(): SupabaseClient {
  if (!serviceClient) {
    const { url } = requireSupabaseConfig();
    const secretKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secretKey) {
      throw new Error('Supabase secret key must be configured in Backend/.env');
    }
    serviceClient = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serviceClient;
}

export function createUserSupabase(accessToken?: string): SupabaseClient {
  const { url, publishableKey } = requireSupabaseConfig();
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });
}

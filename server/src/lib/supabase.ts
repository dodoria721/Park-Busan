import { createClient } from '@supabase/supabase-js';
import { getServerEnv } from '@/lib/env';

export function createSupabaseAdminClient() {
  return createClient(
    getServerEnv('SUPABASE_URL'),
    getServerEnv('SUPABASE_SECRET_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

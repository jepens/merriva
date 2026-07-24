import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/env";

/**
 * Supabase client service-role (BYPASS RLS). HANYA untuk server:
 * penyajian halaman undangan publik dengan filter eksplisit, webhook, cron.
 * JANGAN pernah diekspos ke browser. Lihat SPEC §5 & boundaries.
 */
export function createSupabaseAdminClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

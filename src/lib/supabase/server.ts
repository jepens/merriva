import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";

/**
 * Supabase client untuk Server Components / Server Actions / Route Handlers.
 * Terikat ke sesi user (RLS berlaku sesuai `auth.uid()`).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Dipanggil dari Server Component (cookie read-only). Aman diabaikan bila
          // refresh sesi ditangani middleware.
        }
      },
    },
  });
}

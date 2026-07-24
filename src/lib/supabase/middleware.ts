import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";

/**
 * Refresh sesi Supabase pada navigasi (pola @supabase/ssr).
 * Dipanggil dari src/middleware.ts — di-scope ke area terautentikasi saja
 * (dashboard/admin), BUKAN halaman undangan publik yang dilayani dari cache ISR.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Jangan sisipkan logika antara createServerClient dan getUser (pola @supabase/ssr).
  await supabase.auth.getUser();

  return response;
}

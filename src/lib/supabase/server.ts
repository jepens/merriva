import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Supabase client untuk Server Components / Server Actions / Route Handlers.
 * Terikat ke sesi user (RLS berlaku sesuai `auth.uid()`).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    // `DEFAULT_COOKIE_OPTIONS` milik @supabase/ssr TIDAK memuat `secure` — hanya
    // `{ path, sameSite: "lax", httpOnly: false, maxAge }`. Dokumentasi vendor
    // tak menyebutkannya; nilainya hanya terlihat dari kodenya. Tanpa `Secure`,
    // satu-satunya yang menahan access + refresh token pemilik agar tak berjalan
    // di atas HTTP polos adalah HSTS — yang baru mengikat SETELAH satu respons
    // HTTPS diterima dan tidak selalu bertahan di WebView tertanam, jalur utama
    // produk ini. Aman ditambahkan sendirian: `cookieOptions` di-SEBAR DI ATAS
    // default (`{ ...DEFAULT_COOKIE_OPTIONS, ...cookieOptions }`), jadi
    // `path`/`sameSite`/`maxAge` tetap utuh. `httpOnly` sengaja TIDAK disentuh —
    // `lib/supabase/browser.ts` membaca cookie ini lewat `document.cookie`.
    cookieOptions: { secure: process.env.NODE_ENV === "production" },
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

import { type NextRequest } from "next/server";

import { reportHandledError } from "@/lib/observability";
import { relativeRedirect } from "@/lib/relative-redirect";
import { safeNextPath } from "@/lib/safe-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Callback OAuth (Google) & magic link — pola PKCE @supabase/ssr.
 * Menukar `code` menjadi sesi (exchangeCodeForSession) lalu redirect ke `next`
 * (disanitasi anti open-redirect).
 *
 * Redirect-nya memakai `relativeRedirect`, BUKAN origin dari `request.url`:
 * di mode standalone origin itu bernilai `https://0.0.0.0:3000` dan peramban
 * berhenti di ERR_ADDRESS_INVALID — padahal sesinya sudah terbentuk, sehingga
 * pengguna menyimpulkan "login gagal" untuk login yang sebenarnya BERHASIL
 * (DECISIONS #77).
 */
export async function GET(request: NextRequest) {
  // `searchParams` dari `request.url` AMAN — yang salah di mode standalone
  // hanya skema/host/port-nya. Path dan query tetap persis seperti yang
  // dikirim peramban.
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return relativeRedirect(next);
    }
    // Separuh kedatangan dari tarian OAuth sebelumnya tak punya jejak sama
    // sekali: `signInWithGoogleAction` melaporkan sisi PEMBERANGKATAN, tetapi
    // kegagalan DI SINI — PKCE verifier hilang, kode kedaluwarsa, kode sudah
    // dipakai — hanya menjadi `?error=oauth` yang tak bisa dibedakan dari
    // "pengguna membatalkan".
    reportHandledError(error, "auth.callback.exchange", {
      code: error.code ?? null,
      status: error.status ?? null,
    });
  }

  return relativeRedirect("/masuk?error=oauth");
}

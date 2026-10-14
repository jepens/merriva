import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";

import { reportHandledError } from "@/lib/observability";
import { relativeRedirect } from "@/lib/relative-redirect";
import { safeNextPath } from "@/lib/safe-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Konfirmasi email & recovery kata sandi (pola @supabase/ssr).
 * Tautan email → `/auth/confirm?token_hash=…&type=…&next=…` → verifyOtp menaruh
 * sesi di cookie → redirect ke `next` (disanitasi anti open-redirect).
 *
 * Catatan operasional: template email Supabase harus memakai format `{{ .TokenHash }}`
 * (bukan `{{ .ConfirmationURL }}`) agar mengarah ke route ini.
 *
 * Sama seperti `/auth/callback`, redirect-nya RELATIF — lihat
 * `src/lib/relative-redirect.ts`. Cacat yang sama di sini lebih mahal karena
 * route ini melayani verifikasi email DAN reset kata sandi: sesi recovery
 * berumur pendek, dan satu-satunya halaman yang bisa memakainya tak akan pernah
 * terbuka bila tujuannya mustahil (DECISIONS #77).
 */
export async function GET(request: NextRequest) {
  // Hanya origin-nya yang salah di mode standalone; query-nya utuh.
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));

  if (tokenHash && type) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return relativeRedirect(next);
    }
    // `type` saja yang dilampirkan — ia membedakan "verifikasi pendaftaran
    // gagal" dari "reset sandi gagal", dua masalah dengan obat yang berbeda.
    // `token_hash` TIDAK pernah ikut: ia kredensial sekali pakai.
    reportHandledError(error, "auth.confirm.verify", {
      type,
      code: error.code ?? null,
      status: error.status ?? null,
    });
  }

  return relativeRedirect("/masuk?error=verify");
}

import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/lib/safe-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Konfirmasi email & recovery kata sandi (pola @supabase/ssr).
 * Tautan email → `/auth/confirm?token_hash=…&type=…&next=…` → verifyOtp menaruh
 * sesi di cookie → redirect ke `next` (disanitasi anti open-redirect).
 *
 * Catatan operasional: template email Supabase harus memakai format `{{ .TokenHash }}`
 * (bukan `{{ .ConfirmationURL }}`) agar mengarah ke route ini.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
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
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/masuk?error=verify", origin));
}

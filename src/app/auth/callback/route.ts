import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/lib/safe-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Callback OAuth (Google) & magic link — pola PKCE @supabase/ssr.
 * Menukar `code` menjadi sesi (exchangeCodeForSession) lalu redirect ke `next`
 * (disanitasi anti open-redirect).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/masuk?error=oauth", origin));
}

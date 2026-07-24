import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Lewati bila env Supabase belum di-set (mis. preview tanpa DB) — jaga app tetap hidup.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  // Hanya area terautentikasi. Halaman undangan publik & /api sengaja TIDAK di-scope
  // agar cache ISR + performa hari-H tidak terganggu (ARCHITECTURE §3).
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};

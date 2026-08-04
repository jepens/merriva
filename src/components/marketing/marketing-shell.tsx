import type { ReactNode } from "react";

import { mrvFontVars } from "@/lib/mrv-fonts";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

import "../../app/(marketing)/marketing.css";

/**
 * Kerangka (chrome) marketing bersama: token `.mrv` + font + header/footer.
 * Satu sumber navbar/footer untuk grup `(marketing)` DAN halaman di luar grup
 * yang ingin tampil senada — mis. showcase tema publik `/preview/tema/{slug}`.
 */
export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className={`mrv ${mrvFontVars}`}>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}

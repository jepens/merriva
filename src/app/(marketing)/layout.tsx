import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { MarketingShell } from "@/components/marketing/marketing-shell";

// Manifest (ikon PWA/Android) & theme-color hanya untuk permukaan marketing —
// BUKAN di root layout, agar tidak diwarisi halaman undangan tamu `/[slug]`.
//
// `themeColor` di sini dan `theme_color` di `public/site.webmanifest` mewarnai
// permukaan yang sama (bilah alamat / bilah judul Android) lewat dua jalur yang
// berbeda, jadi keduanya WAJIB sama — kertas, karena header juga kertas. Dijaga
// `tests/unit/brand-assets.test.tsx`, bukan ingatan.
export const metadata: Metadata = { manifest: "/site.webmanifest" };
export const viewport: Viewport = { themeColor: "#fbf9f6" };

// Chrome marketing (navbar + footer + token `.mrv` + font) hidup di
// `MarketingShell` agar bisa dipakai ulang di luar grup ini (showcase tema).
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <MarketingShell>{children}</MarketingShell>;
}

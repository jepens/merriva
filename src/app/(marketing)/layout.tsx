import type { ReactNode } from "react";

import { MarketingShell } from "@/components/marketing/marketing-shell";

// Chrome marketing (navbar + footer + token `.mrv` + font) hidup di
// `MarketingShell` agar bisa dipakai ulang di luar grup ini (showcase tema).
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <MarketingShell>{children}</MarketingShell>;
}

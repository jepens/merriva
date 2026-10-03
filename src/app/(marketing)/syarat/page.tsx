import type { Metadata } from "next";

import { LegalPage } from "@/components/marketing/legal-page";
import { copy } from "@/lib/copy";

export const metadata: Metadata = {
  title: copy.marketing.legal.terms.title,
  description: copy.marketing.legal.terms.intro,
  alternates: { canonical: "/syarat" },
};

/**
 * Syarat & Ketentuan (AUDIT-2026-10-01 A2). Sebelum ini TIDAK ADA sama sekali —
 * tak ada dasar kontraktual untuk hal yang kodenya sudah kerjakan: masa aktif
 * berakhir, purge 6 bulan, penangguhan konten oleh admin, dan penolakan refund
 * setelah aktivasi.
 */
export default function TermsPage() {
  const { title, intro, sections } = copy.marketing.legal.terms;
  return <LegalPage title={title} intro={intro} sections={sections} />;
}

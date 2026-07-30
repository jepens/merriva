import type { Metadata } from "next";

import { LegalPage } from "@/components/marketing/legal-page";
import { copy } from "@/lib/copy";

export const metadata: Metadata = {
  title: copy.marketing.legal.refund.title,
  description: copy.marketing.legal.refund.intro,
  alternates: { canonical: "/refund" },
};

export default function RefundPage() {
  const { title, intro, sections } = copy.marketing.legal.refund;
  return <LegalPage title={title} intro={intro} sections={sections} />;
}

import type { Metadata } from "next";

import { LegalPage } from "@/components/marketing/legal-page";
import { copy } from "@/lib/copy";

export const metadata: Metadata = {
  title: copy.marketing.legal.privacy.title,
  description: copy.marketing.legal.privacy.intro,
  alternates: { canonical: "/privasi" },
};

export default function PrivacyPage() {
  const { title, intro, sections } = copy.marketing.legal.privacy;
  return <LegalPage title={title} intro={intro} sections={sections} />;
}

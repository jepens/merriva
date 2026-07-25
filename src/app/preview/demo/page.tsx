import type { Metadata } from "next";

import { PreviewBanner } from "@/components/preview/preview-banner";
import EternalRose from "@/themes/eternal-rose";
import { demoInvitationData } from "@/themes/eternal-rose/demo-data";

export const metadata: Metadata = { title: "Contoh Tema — Eternal Rose" };

/** Showcase tema `eternal-rose` dengan data contoh (publik, tanpa data nyata). */
export default function DemoPreviewPage() {
  return (
    <>
      <PreviewBanner demo />
      <EternalRose data={demoInvitationData} />
    </>
  );
}

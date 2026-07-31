import type { Metadata } from "next";

import { GuestPersonalizationProvider } from "@/components/public/guest-personalization";
import {
  PreviewEmbedStyle,
  PreviewFrame,
} from "@/components/preview/preview-frame";
import EternalRose from "@/themes/eternal-rose";
import { demoInvitationData } from "@/themes/eternal-rose/demo-data";

export const metadata: Metadata = { title: "Contoh Tema — Eternal Rose" };

/**
 * Showcase tema `eternal-rose` dengan data contoh (publik, tanpa data nyata).
 * Default: dibingkai layar ponsel. `?embed=1` = render tema polos (isi iframe).
 */
export default async function DemoPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ embed?: string }>;
}) {
  const { embed } = await searchParams;
  if (!embed) return <PreviewFrame embedSrc="/preview/demo?embed=1" demo />;
  return (
    <GuestPersonalizationProvider slug={demoInvitationData.slug}>
      <PreviewEmbedStyle />
      <EternalRose data={demoInvitationData} />
    </GuestPersonalizationProvider>
  );
}

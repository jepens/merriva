import type { Metadata } from "next";

import { GuestPersonalizationProvider } from "@/components/public/guest-personalization";
import { PexelsCredit } from "@/components/marketing/pexels-credit";
import {
  PreviewEmbedStyle,
  PreviewFrame,
} from "@/components/preview/preview-frame";
import EternalRose from "@/themes/eternal-rose";
import { ThemeStyles } from "@/themes/theme-styles";
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
  if (!embed)
    return (
      <PreviewFrame
        embedSrc="/preview/demo?embed=1"
        demo
        footer={<PexelsCredit slug="eternal-rose" />}
      />
    );
  return (
    <GuestPersonalizationProvider slug={demoInvitationData.slug}>
      <ThemeStyles slug="eternal-rose" />
      <PreviewEmbedStyle />
      <EternalRose data={demoInvitationData} />
    </GuestPersonalizationProvider>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PreviewBanner } from "@/components/preview/preview-banner";
import { getThemeDemoLoader } from "@/themes/demo-data-registry";
import { getThemeLoader } from "@/themes/registry";

export const metadata: Metadata = { title: "Contoh Tema — Merriva" };

/**
 * Showcase tema mana pun dengan data contoh-nya (publik, tanpa data nyata).
 * Dipakai katalog tema (landing M4.3) & QA visual tema baru. `/preview/tema/{slug}`.
 */
export default async function ThemeDemoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const loader = getThemeLoader(slug);
  const demoLoader = getThemeDemoLoader(slug);
  if (!loader || !demoLoader) notFound();

  const Theme = (await loader()).default;
  const { demoInvitationData } = await demoLoader();

  return (
    <>
      <PreviewBanner demo />
      <Theme data={demoInvitationData} />
    </>
  );
}

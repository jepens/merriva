import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  PreviewEmbedStyle,
  PreviewFrame,
} from "@/components/preview/preview-frame";
import { getThemeDemoLoader } from "@/themes/demo-data-registry";
import { getThemeLoader } from "@/themes/registry";

export const metadata: Metadata = { title: "Contoh Tema — Merriva" };

/**
 * Showcase tema mana pun dengan data contoh-nya (publik, tanpa data nyata).
 * Dipakai katalog tema (landing M4.3) & QA visual tema baru. `/preview/tema/{slug}`.
 * Default: dibingkai layar ponsel. `?embed=1` = render tema polos (isi iframe).
 */
export default async function ThemeDemoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  const { slug } = await params;
  const { embed } = await searchParams;
  const loader = getThemeLoader(slug);
  const demoLoader = getThemeDemoLoader(slug);
  if (!loader || !demoLoader) notFound();

  if (!embed) {
    return <PreviewFrame embedSrc={`/preview/tema/${slug}?embed=1`} demo />;
  }

  const Theme = (await loader()).default;
  const { demoInvitationData } = await demoLoader();
  return (
    <>
      <PreviewEmbedStyle />
      <Theme data={demoInvitationData} />
    </>
  );
}

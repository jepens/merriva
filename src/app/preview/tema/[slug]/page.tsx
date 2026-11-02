import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MarketingShell } from "@/components/marketing/marketing-shell";
import { PexelsCredit } from "@/components/marketing/pexels-credit";
import { PreviewEmbedStyle } from "@/components/preview/preview-frame";
import { ThemeShowcase } from "@/components/preview/theme-showcase";
import { GuestPersonalizationProvider } from "@/components/public/guest-personalization";
import { copy } from "@/lib/copy";
import {
  getActiveThemes,
  pickPreviewVariant,
  themePreviewHref,
  VARIANT_PARAM,
} from "@/server/marketing/catalog";
import { getThemeDemoLoader } from "@/themes/demo-data-registry";
import { getThemeLoader } from "@/themes/registry";
import { ThemeStyles } from "@/themes/theme-styles";
import type { InvitationCategory } from "@/types";

function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** `?variant=` mentah dari URL — hanya untuk `pickPreviewVariant`, jangan dirender. */
type PreviewSearchParams = Promise<{
  embed?: string;
  [VARIANT_PARAM]?: string | string[];
}>;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: PreviewSearchParams;
}): Promise<Metadata> {
  // Template root menambahkan "· Merriva" → jangan gandakan brand di sini.
  const { slug } = await params;
  const variant = pickPreviewVariant(slug, (await searchParams)[VARIANT_PARAM]);
  const name = humanizeSlug(slug);
  return {
    title: `Contoh Tema ${
      variant ? copy.marketing.themes.variantTitle(name, variant.name) : name
    }`,
  };
}

/** Label kategori tema: >1 kategori → "Universal", selainnya nama kategori. */
function categoryLabel(categories: InvitationCategory[]): string {
  if (categories.length !== 1) return copy.marketing.themes.universal;
  const map: Record<InvitationCategory, string> = {
    wedding: copy.create.category.wedding,
    corporate: copy.create.category.corporate,
    family: copy.create.category.family,
  };
  return map[categories[0]] ?? copy.marketing.themes.universal;
}

interface Neighbor {
  slug: string;
  name: string;
}

interface ShowcaseContext {
  name: string;
  category: string | null;
  tier: string | null;
  prev: Neighbor | null;
  next: Neighbor | null;
}

/**
 * Konteks showcase (nama/kategori/tier + tetangga prev/next) dari katalog aktif.
 * Toleran: bila DB tak terjangkau, spesimen tetap tampil (data file) dengan nama
 * yang di-humanize dari slug — pratinjau tak pernah bergantung pada DB.
 */
async function loadShowcaseContext(slug: string): Promise<ShowcaseContext> {
  const fallback: ShowcaseContext = {
    name: humanizeSlug(slug),
    category: null,
    tier: null,
    prev: null,
    next: null,
  };
  try {
    const themes = await getActiveThemes();
    // Navigasi hanya antar-tema yang punya demo (pratinjau butuh demo).
    const demoThemes = themes.filter((t) => t.hasDemo);
    const idx = demoThemes.findIndex((t) => t.slug === slug);
    const current =
      idx >= 0 ? demoThemes[idx] : themes.find((t) => t.slug === slug);
    if (!current) return fallback;
    return {
      name: current.name,
      category: categoryLabel(current.categories),
      tier:
        current.tier === "premium"
          ? copy.marketing.themes.tierPremium
          : copy.marketing.themes.tierStandard,
      prev:
        idx > 0
          ? { slug: demoThemes[idx - 1].slug, name: demoThemes[idx - 1].name }
          : null,
      next:
        idx >= 0 && idx < demoThemes.length - 1
          ? { slug: demoThemes[idx + 1].slug, name: demoThemes[idx + 1].name }
          : null,
    };
  } catch {
    return fallback;
  }
}

/**
 * Showcase tema mana pun dengan data contoh-nya (publik, tanpa data nyata).
 * Dipakai katalog tema (landing M4.3) & QA visual tema baru. `/preview/tema/{slug}`.
 * Default: chrome marketing (navbar + plakat + spesimen ponsel + footer).
 * `?embed=1` = render tema polos (isi iframe bingkai ponsel).
 * `?variant={id}` = varian katalog (THEME-WAVE3 §4) — hanya id dari `options.ts`
 * tema itu yang diterapkan; selain itu varian bawaan.
 */
export default async function ThemeDemoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: PreviewSearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const loader = getThemeLoader(slug);
  const demoLoader = getThemeDemoLoader(slug);
  if (!loader || !demoLoader) notFound();
  const variant = pickPreviewVariant(slug, sp[VARIANT_PARAM]);

  // Isi iframe: tema polos tanpa chrome marketing → viewport bersarang (100dvh,
  // fixed, reveal berperilaku seperti di ponsel).
  if (sp.embed) {
    const Theme = (await loader()).default;
    const { demoInvitationData } = await demoLoader();
    // Varian dipasang pada SALINAN data demo request ini — tak ada undangan
    // siapa pun yang dibaca atau ditulis, dan modul demo tak termutasi.
    const data = variant?.custom
      ? {
          ...demoInvitationData,
          settings: { ...demoInvitationData.settings, custom: variant.custom },
        }
      : demoInvitationData;
    return (
      <GuestPersonalizationProvider slug={demoInvitationData.slug}>
        <ThemeStyles slug={slug} />
        <PreviewEmbedStyle />
        <Theme data={data} />
      </GuestPersonalizationProvider>
    );
  }

  const ctx = await loadShowcaseContext(slug);
  return (
    <MarketingShell>
      <ThemeShowcase
        slug={slug}
        name={
          variant
            ? copy.marketing.themes.variantTitle(ctx.name, variant.name)
            : ctx.name
        }
        category={ctx.category}
        tier={ctx.tier}
        embedSrc={themePreviewHref(slug, { embed: true, variant: variant?.id })}
        credit={<PexelsCredit slug={slug} />}
        prev={ctx.prev}
        next={ctx.next}
      />
    </MarketingShell>
  );
}

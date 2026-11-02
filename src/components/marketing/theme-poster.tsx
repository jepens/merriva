import { Eye, Send } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

import { ThemeMockup } from "@/components/theme-mockup";
import { copy } from "@/lib/copy";
import { contrastRatio, safeTextColor } from "@/lib/customizer/contrast-guard";
import { themeCtaHref } from "@/lib/theme-cta";
import {
  themePreviewHref,
  type MarketingTheme,
} from "@/server/marketing/catalog";
import { hasThemeThumb } from "@/server/theme-thumbs";
import type { ThemeCatalogMeta } from "@/themes/catalog-meta";
import type { InvitationCategory } from "@/types";

const CATEGORY_LABEL: Record<InvitationCategory, string> = {
  wedding: copy.create.category.wedding,
  corporate: copy.create.category.corporate,
  family: copy.create.category.family,
};

/** Label kategori kartu: >1 kategori → "Universal", selainnya nama kategori. */
function categoryText(categories: InvitationCategory[]): string {
  if (categories.length > 1) return copy.marketing.themes.universal;
  return CATEGORY_LABEL[categories[0]] ?? copy.marketing.themes.universal;
}

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Warna nama di poster kartu VARIAN = aksen varian, karena itulah pembedanya:
 * sepuluh tema lama berbagi kertas & tinta di semua variannya, jadi tanpa ini
 * "Aria — Biru Klasik" dan "Aria — Hijau Hutan" tampil identik. Dijaga AA 4,5
 * di atas kertas: kertas terang menggelapkan aksen (`safeTextColor`), kertas
 * gelap jatuh ke tinta (menggelapkan tak menolong di sana).
 */
export function posterNameColor(meta: ThemeCatalogMeta): string | undefined {
  if (!HEX.test(meta.accent) || !HEX.test(meta.bg)) return undefined;
  if (contrastRatio(meta.accent, meta.bg) >= 4.5) return meta.accent;
  return meta.dark ? undefined : safeTextColor(meta.accent, meta.bg).color;
}

/**
 * Poster spesimen tema (identitas visual dari `catalog-meta`). Murni presentasional
 * & isomorfik (dipakai di server pages maupun katalog client). TANPA gambar/font
 * per-tema → ringan. Variabel warna disuntik via inline style ter-scope poster.
 * `landscape` = 4:3 setinggi mockup, agar baris grid kartu katalog tetap rata.
 */
export function ThemePoster({
  theme,
  landscape = false,
}: {
  theme: MarketingTheme;
  landscape?: boolean;
}) {
  const { meta } = theme;
  const style = {
    "--mrv-poster-bg": meta.bg,
    "--mrv-poster-ink": meta.ink,
    "--mrv-poster-accent": meta.accent,
    "--mrv-poster-line": meta.line,
    ...(landscape ? { aspectRatio: "4 / 3" } : null),
  } as CSSProperties;
  const tierLabel =
    theme.tier === "premium"
      ? copy.marketing.themes.tierPremium
      : copy.marketing.themes.tierStandard;

  return (
    <div className="mrv-poster" style={style}>
      <div className="mrv-poster__tag">{categoryText(theme.categories)}</div>
      <div className="mrv-poster__center">
        <div
          className="mrv-poster__name"
          style={theme.variant ? { color: posterNameColor(meta) } : undefined}
        >
          {theme.name}
        </div>
        <div className="mrv-poster__rule" aria-hidden="true">
          <span>{meta.ornament}</span>
        </div>
      </div>
      <div className="mrv-poster__foot">
        <span>MERRIVA</span>
        <span className="mrv-poster__tier">{tierLabel}</span>
      </div>
    </div>
  );
}

/**
 * Kartu tema katalog = MOCKUP dua ponsel (rupa asli tema, dari `pnpm thumbs`) +
 * nama/kategori + aksi. "Preview" membuka pratinjau HP live di tab baru; "Gunakan
 * Tema" mengarah ke pendaftaran. Tema tanpa demo/foto memakai poster spesimen +
 * label "segera hadir". Kartu = `<div>` (bukan satu tautan) karena kini memuat
 * dua kontrol interaktif terpisah.
 *
 * Kartu VARIAN (`/tema`, THEME-WAVE3 §4) berjudul "{Tema} — {Varian}" dan membuka
 * pratinjau varian itu. Thumbnail memotret varian BAWAAN, jadi hanya kartu bawaan
 * yang memakai mockup; varian lain memakai poster berpalet variannya — kartu tak
 * boleh memamerkan warna yang bukan miliknya.
 */
export function ThemeCard({ theme }: { theme: MarketingTheme }) {
  const { variant } = theme;
  const title = variant
    ? copy.marketing.themes.variantTitle(theme.name, variant.name)
    : theme.name;
  const showMockup =
    theme.hasDemo &&
    (!variant || variant.isDefault) &&
    hasThemeThumb(theme.slug);
  return (
    <div className="mrv-theme-card">
      <div className="mrv-theme-card__media">
        {showMockup ? (
          <ThemeMockup slug={theme.slug} name={theme.name} />
        ) : (
          <ThemePoster theme={theme} landscape />
        )}
      </div>
      <div className="mrv-theme-card__meta">
        <div>
          <div className="mrv-theme-card__name">{title}</div>
          <div className="mrv-theme-card__cats">
            {categoryText(theme.categories)}
          </div>
        </div>
      </div>
      {theme.hasDemo ? (
        <div className="mrv-theme-card__actions">
          <a
            className="mrv-btn mrv-btn--ghost mrv-btn--sm"
            href={themePreviewHref(theme.slug, { variant: variant?.id })}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={copy.marketing.themes.demoOf(title)}
          >
            <Eye size={16} aria-hidden="true" />
            {copy.marketing.themes.preview}
          </a>
          <Link
            className="mrv-btn mrv-btn--primary mrv-btn--sm"
            href={themeCtaHref(theme.slug)}
          >
            <Send size={16} aria-hidden="true" />
            {copy.marketing.themes.useTheme}
          </Link>
        </div>
      ) : (
        <span className="mrv-theme-card__soon">
          {copy.marketing.themes.soon}
        </span>
      )}
    </div>
  );
}

/**
 * Kartu tema untuk KIPAS HERO landing: satu ponsel berisi screenshot cover asli
 * di atas panel warna tema (`meta.panel ?? bg`) + nama/tier — pengganti poster
 * tipografi agar senada mockup katalog. Fallback ke `ThemePoster` bila tema belum
 * difoto (`pnpm thumbs`). Rotasi/tumpuk kipas diatur `.mrv-fan` (tak berubah).
 */
export function HeroThemeCard({ theme }: { theme: MarketingTheme }) {
  if (!hasThemeThumb(theme.slug)) return <ThemePoster theme={theme} />;
  const panel = theme.meta.panel ?? theme.meta.bg;
  const tier =
    theme.tier === "premium"
      ? copy.marketing.themes.tierPremium
      : copy.marketing.themes.tierStandard;
  return (
    <div
      className="mrv-hero-card"
      style={{
        background: `linear-gradient(160deg, ${panel}, color-mix(in srgb, ${panel} 82%, #000))`,
      }}
    >
      <span className="mrv-hero-card__tag">
        {categoryText(theme.categories)}
      </span>
      <div className="mrv-hero-card__phone">
        <Image
          src={`/theme-thumbs/${theme.slug}-cover.jpg`}
          alt={`Pratinjau tema ${theme.name}`}
          fill
          sizes="180px"
          className="object-cover object-top"
        />
      </div>
      <div className="mrv-hero-card__foot">
        <span className="mrv-hero-card__name">{theme.name}</span>
        <span className="mrv-hero-card__tier">{tier}</span>
      </div>
    </div>
  );
}

import Link from "next/link";
import type { CSSProperties } from "react";

import { copy } from "@/lib/copy";
import type { MarketingTheme } from "@/server/marketing/catalog";
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

/**
 * Poster spesimen tema (identitas visual dari `catalog-meta`). Murni presentasional
 * & isomorfik (dipakai di server pages maupun katalog client). TANPA gambar/font
 * per-tema → ringan. Variabel warna disuntik via inline style ter-scope poster.
 */
export function ThemePoster({ theme }: { theme: MarketingTheme }) {
  const { meta } = theme;
  const style = {
    "--mrv-poster-bg": meta.bg,
    "--mrv-poster-ink": meta.ink,
    "--mrv-poster-accent": meta.accent,
    "--mrv-poster-line": meta.line,
  } as CSSProperties;
  const tierLabel =
    theme.tier === "premium"
      ? copy.marketing.themes.tierPremium
      : copy.marketing.themes.tierStandard;

  return (
    <div className="mrv-poster" style={style}>
      <div className="mrv-poster__tag">{categoryText(theme.categories)}</div>
      <div className="mrv-poster__center">
        <div className="mrv-poster__name">{theme.name}</div>
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
 * Kartu tema = poster + baris meta. Bila punya demo, SELURUH kartu jadi satu tautan
 * (bersih untuk pembaca layar) ke `/preview/tema/{slug}` di tab baru. Tanpa demo →
 * kartu statis + label "segera hadir".
 */
export function ThemeCard({ theme }: { theme: MarketingTheme }) {
  const inner = (
    <>
      <ThemePoster theme={theme} />
      <div className="mrv-theme-card__meta">
        <div>
          <div className="mrv-theme-card__name">{theme.name}</div>
          <div className="mrv-theme-card__cats">
            {categoryText(theme.categories)}
          </div>
        </div>
        {theme.hasDemo ? (
          <span className="mrv-theme-card__demo" aria-hidden="true">
            {copy.marketing.themes.demo} →
          </span>
        ) : (
          <span className="mrv-theme-card__soon">
            {copy.marketing.themes.soon}
          </span>
        )}
      </div>
    </>
  );

  if (!theme.hasDemo) {
    return <div className="mrv-theme-card">{inner}</div>;
  }

  return (
    <Link
      className="mrv-theme-card"
      href={`/preview/tema/${theme.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={copy.marketing.themes.demoOf(theme.name)}
    >
      {inner}
    </Link>
  );
}

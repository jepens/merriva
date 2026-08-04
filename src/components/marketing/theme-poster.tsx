import { Eye, Send } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import { ThemeMockup } from "@/components/theme-mockup";
import { copy } from "@/lib/copy";
import type { MarketingTheme } from "@/server/marketing/catalog";
import { hasThemeThumb } from "@/server/theme-thumbs";
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
 * Kartu tema katalog = MOCKUP dua ponsel (rupa asli tema, dari `pnpm thumbs`) +
 * nama/kategori + aksi. "Preview" membuka pratinjau HP live di tab baru; "Gunakan
 * Tema" mengarah ke pendaftaran. Tema tanpa demo/foto memakai poster spesimen +
 * label "segera hadir". Kartu = `<div>` (bukan satu tautan) karena kini memuat
 * dua kontrol interaktif terpisah.
 */
export function ThemeCard({ theme }: { theme: MarketingTheme }) {
  const showMockup = theme.hasDemo && hasThemeThumb(theme.slug);
  return (
    <div className="mrv-theme-card">
      <div className="mrv-theme-card__media">
        {showMockup ? (
          <ThemeMockup slug={theme.slug} name={theme.name} />
        ) : (
          <ThemePoster theme={theme} />
        )}
      </div>
      <div className="mrv-theme-card__meta">
        <div>
          <div className="mrv-theme-card__name">{theme.name}</div>
          <div className="mrv-theme-card__cats">
            {categoryText(theme.categories)}
          </div>
        </div>
      </div>
      {theme.hasDemo ? (
        <div className="mrv-theme-card__actions">
          <a
            className="mrv-btn mrv-btn--ghost mrv-btn--sm"
            href={`/preview/tema/${theme.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={copy.marketing.themes.demoOf(theme.name)}
          >
            <Eye size={16} aria-hidden="true" />
            {copy.marketing.themes.preview}
          </a>
          <Link className="mrv-btn mrv-btn--primary mrv-btn--sm" href="/daftar">
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

import type { Metadata } from "next";

import {
  ThemeCatalog,
  type ThemeCatalogLabels,
} from "@/components/marketing/theme-catalog";
import { PexelsCreditFooter } from "@/components/marketing/pexels-credit";
import { ThemeCard } from "@/components/marketing/theme-poster";
import { copy } from "@/lib/copy";
import {
  expandThemeVariants,
  getActiveThemes,
} from "@/server/marketing/catalog";

export const metadata: Metadata = {
  title: copy.marketing.pages.themes.title,
  description: copy.marketing.pages.themes.subtitle,
  alternates: { canonical: "/tema" },
};

export const revalidate = 3600;

export default async function ThemesPage() {
  // Satu kartu per (tema × varian) — THEME-WAVE3 §4. Landing tetap per tema.
  const themes = expandThemeVariants(await getActiveThemes());
  const p = copy.marketing.pages.themes;
  const tc = copy.marketing.themes;

  // Kartu dirender di server (copy tetap di server) lalu dilewatkan sebagai prop
  // ke katalog client — bundel /tema hanya berisi state filter, bukan `copy`.
  const labels: ThemeCatalogLabels = {
    tabs: [
      { key: "all", label: tc.filterAll },
      { key: "wedding", label: copy.create.category.wedding },
      { key: "corporate", label: copy.create.category.corporate },
      { key: "family", label: copy.create.category.family },
    ],
    filterLabel: tc.filterLabel,
    countUnit: tc.countUnit,
    empty: tc.empty,
  };

  return (
    <>
      <section className="mrv-page-head">
        <div className="mrv-container">
          <span className="mrv-eyebrow">{copy.marketing.themes.eyebrow}</span>
          <h1 className="mrv-display mrv-h1" style={{ marginTop: "0.85rem" }}>
            {p.title}
          </h1>
          <p
            className="mrv-lead"
            style={{ marginTop: "0.75rem", maxWidth: "40rem" }}
          >
            {p.subtitle}
          </p>
        </div>
      </section>

      <section className="mrv-section" style={{ paddingTop: 0 }}>
        <div className="mrv-container">
          <ThemeCatalog
            categories={themes.map((t) => t.categories)}
            labels={labels}
            cards={themes.map((t) => (
              <ThemeCard key={`${t.slug}:${t.variant?.id ?? ""}`} theme={t} />
            ))}
          />
          <div style={{ marginTop: "2.5rem" }}>
            <PexelsCreditFooter />
          </div>
        </div>
      </section>
    </>
  );
}

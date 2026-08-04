import type { Metadata } from "next";
import Link from "next/link";

import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { SectionHead } from "@/components/marketing/section-head";
import { HeroThemeCard, ThemeCard } from "@/components/marketing/theme-poster";
import { copy } from "@/lib/copy";
import {
  getActivePackages,
  getActiveThemes,
  type MarketingTheme,
} from "@/server/marketing/catalog";

export const metadata: Metadata = {
  title: "Undangan Digital untuk Setiap Momen Bahagia",
  description: copy.marketing.hero.subtitle,
  alternates: { canonical: "/" },
};

// Statis + di-revalidate on-demand saat admin ubah harga/tema (revalidatePath).
// `revalidate` = jaring pengaman berkala.
export const revalidate = 3600;

/** Pilih 3 tema beragam untuk kipas hero (prioritas palet kontras, fallback aman). */
function selectHeroThemes(themes: MarketingTheme[]): MarketingTheme[] {
  const preferred = ["barakah", "noir", "festa", "verdant", "eternal-rose"];
  const picked = preferred
    .map((slug) => themes.find((t) => t.slug === slug))
    .filter((t): t is MarketingTheme => Boolean(t));
  return (picked.length >= 3 ? picked : themes).slice(0, 3);
}

export default async function LandingPage() {
  const [themes, packages] = await Promise.all([
    getActiveThemes(),
    getActivePackages(),
  ]);
  const c = copy.marketing;
  const heroThemes = selectHeroThemes(themes);
  const featured = themes.slice(0, 6);
  const faqItems = c.faq.items.slice(0, 6);

  return (
    <>
      {/* Hero */}
      <section className="mrv-hero">
        <div className="mrv-container mrv-hero__grid">
          <div className="space-y-6">
            <span className="mrv-eyebrow">{c.hero.eyebrow}</span>
            <h1 className="mrv-display mrv-h1">
              {c.hero.titleLead}{" "}
              <span className="mrv-accent-word">{c.hero.titleAccent}</span>
            </h1>
            <p className="mrv-lead" style={{ maxWidth: "34rem" }}>
              {c.hero.subtitle}
            </p>
            <div className="mrv-hero__ctas">
              <Link href="/daftar" className="mrv-btn mrv-btn--primary">
                {c.hero.ctaPrimary}
              </Link>
              <Link href="/tema" className="mrv-btn mrv-btn--ghost">
                {c.hero.ctaSecondary}
              </Link>
            </div>
            <p className="mrv-hero__note">{c.hero.note}</p>
            <ul className="mrv-trust">
              {c.trust.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>

          {heroThemes.length > 0 ? (
            <div className="mrv-fan">
              {heroThemes.map((theme) => (
                <HeroThemeCard key={theme.slug} theme={theme} />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* Cara kerja */}
      <section className="mrv-section mrv-band-cream">
        <div className="mrv-container">
          <SectionHead
            eyebrow={c.how.eyebrow}
            title={c.how.title}
            subtitle={c.how.subtitle}
          />
          <div className="mrv-steps">
            {c.how.steps.map((step, i) => (
              <div key={step.title} className="mrv-step">
                {i < c.how.steps.length - 1 ? (
                  <span className="mrv-step__line" aria-hidden="true" />
                ) : null}
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Katalog tema */}
      {featured.length > 0 ? (
        <section className="mrv-section">
          <div className="mrv-container">
            <SectionHead
              eyebrow={c.themes.eyebrow}
              title={c.themes.title}
              subtitle={c.themes.subtitle}
            />
            <div className="mrv-grid mrv-grid--themes">
              {featured.map((theme) => (
                <ThemeCard key={theme.slug} theme={theme} />
              ))}
            </div>
            <div style={{ marginTop: "2.5rem", textAlign: "center" }}>
              <Link href="/tema" className="mrv-btn mrv-btn--ghost">
                {c.themes.all}
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {/* Kenapa Merriva */}
      <section className="mrv-section mrv-band-cream">
        <div className="mrv-container">
          <SectionHead eyebrow={c.features.eyebrow} title={c.features.title} />
          <div className="mrv-features">
            {c.features.items.map((item) => (
              <div key={item.title} className="mrv-feature">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Harga */}
      {packages.length > 0 ? (
        <section className="mrv-section">
          <div className="mrv-container">
            <SectionHead
              eyebrow={c.pricing.eyebrow}
              title={c.pricing.title}
              subtitle={c.pricing.subtitle}
              align="center"
            />
            <PricingCards packages={packages} />
            <p
              className="mrv-hero__note"
              style={{ justifyContent: "center", marginTop: "1.5rem" }}
            >
              {c.pricing.note}
            </p>
            <div style={{ marginTop: "1rem", textAlign: "center" }}>
              <Link href="/harga" className="mrv-theme-card__demo">
                {c.pricing.seeAll} →
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {/* FAQ */}
      <section className="mrv-section mrv-band-cream">
        <div className="mrv-container mrv-container--narrow">
          <SectionHead
            eyebrow={c.faq.eyebrow}
            title={c.faq.title}
            align="center"
          />
          <FaqAccordion items={faqItems} />
          <div style={{ marginTop: "2rem", textAlign: "center" }}>
            <Link href="/faq" className="mrv-btn mrv-btn--ghost">
              {c.faq.more}
            </Link>
          </div>
        </div>
      </section>

      {/* CTA akhir */}
      <section className="mrv-section mrv-band-dark">
        <div
          className="mrv-container mrv-container--narrow"
          style={{ textAlign: "center" }}
        >
          <h2 className="mrv-display mrv-h2">{c.finalCta.title}</h2>
          <p
            className="mrv-lead"
            style={{
              marginTop: "0.9rem",
              marginInline: "auto",
              maxWidth: "34rem",
            }}
          >
            {c.finalCta.subtitle}
          </p>
          <div
            className="mrv-hero__ctas"
            style={{ justifyContent: "center", marginTop: "1.75rem" }}
          >
            <Link href="/daftar" className="mrv-btn mrv-btn--accent">
              {c.finalCta.cta}
            </Link>
            <Link href="/harga" className="mrv-btn mrv-btn--ghost">
              {c.finalCta.secondary}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

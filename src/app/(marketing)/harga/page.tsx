import type { Metadata } from "next";
import Link from "next/link";

import { PricingCards } from "@/components/marketing/pricing-cards";
import { PricingComparison } from "@/components/marketing/pricing-comparison";
import { copy } from "@/lib/copy";
import { getActivePackages } from "@/server/marketing/catalog";

export const metadata: Metadata = {
  title: copy.marketing.pages.pricing.title,
  description: copy.marketing.pages.pricing.subtitle,
  alternates: { canonical: "/harga" },
};

export const revalidate = 3600;

export default async function PricingPage() {
  const packages = await getActivePackages();
  const p = copy.marketing.pages.pricing;

  return (
    <>
      <section className="mrv-page-head">
        <div className="mrv-container" style={{ textAlign: "center" }}>
          <span className="mrv-eyebrow">{copy.marketing.pricing.eyebrow}</span>
          <h1 className="mrv-display mrv-h1" style={{ marginTop: "0.85rem" }}>
            {p.title}
          </h1>
          <p
            className="mrv-lead"
            style={{
              marginTop: "0.75rem",
              marginInline: "auto",
              maxWidth: "38rem",
            }}
          >
            {p.subtitle}
          </p>
        </div>
      </section>

      <section className="mrv-section" style={{ paddingTop: 0 }}>
        <div className="mrv-container">
          {packages.length > 0 ? (
            <>
              <PricingCards packages={packages} />
              <p
                className="mrv-hero__note"
                style={{ justifyContent: "center", marginTop: "1.25rem" }}
              >
                {copy.checkout.securedBy}
              </p>
            </>
          ) : (
            <p className="mrv-lead" style={{ textAlign: "center" }}>
              {copy.checkout.packageUnavailable}
            </p>
          )}
        </div>
      </section>

      {packages.length > 0 ? (
        <section
          className="mrv-section mrv-band-cream"
          style={{ paddingTop: 0 }}
        >
          <div className="mrv-container mrv-container--narrow">
            <h2
              className="mrv-display mrv-h2"
              style={{
                paddingTop: "clamp(2.5rem,6vw,4.5rem)",
                marginBottom: "1.5rem",
              }}
            >
              {p.comparisonTitle}
            </h2>
            <PricingComparison packages={packages} />
          </div>
        </section>
      ) : null}

      <section className="mrv-section">
        <div
          className="mrv-container mrv-container--narrow"
          style={{ textAlign: "center" }}
        >
          <div className="mrv-hero__ctas" style={{ justifyContent: "center" }}>
            <Link href="/daftar" className="mrv-btn mrv-btn--primary">
              {copy.marketing.finalCta.cta}
            </Link>
            <Link href="/faq" className="mrv-btn mrv-btn--ghost">
              {copy.marketing.nav.faq}
            </Link>
          </div>
          <p
            className="mrv-hero__note"
            style={{ justifyContent: "center", marginTop: "1.25rem" }}
          >
            {copy.marketing.pricing.note}
          </p>
          <p style={{ marginTop: "0.5rem" }}>
            <Link href="/refund" className="mrv-theme-card__demo">
              {copy.marketing.legal.refund.title} →
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}

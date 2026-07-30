import type { Metadata } from "next";
import Link from "next/link";

import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { copy } from "@/lib/copy";

export const metadata: Metadata = {
  title: copy.marketing.pages.faq.title,
  description: copy.marketing.pages.faq.subtitle,
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  const c = copy.marketing;
  const l = c.legal;

  return (
    <section className="mrv-section">
      <div className="mrv-container mrv-container--narrow">
        <span className="mrv-eyebrow">{c.faq.eyebrow}</span>
        <h1 className="mrv-display mrv-h1" style={{ marginTop: "0.85rem" }}>
          {c.pages.faq.title}
        </h1>
        <p
          className="mrv-lead"
          style={{ marginTop: "0.75rem", marginBottom: "2.5rem" }}
        >
          {c.pages.faq.subtitle}
        </p>

        <FaqAccordion items={c.faq.items} />

        <p className="mrv-lead" style={{ marginTop: "2.5rem" }}>
          {l.contactBody}{" "}
          <a href={`mailto:${l.contactEmail}`} className="mrv-theme-card__demo">
            {l.contactEmail}
          </a>
          .
        </p>
        <div style={{ marginTop: "1.75rem" }}>
          <Link href="/daftar" className="mrv-btn mrv-btn--primary">
            {c.hero.ctaPrimary}
          </Link>
        </div>
      </div>
    </section>
  );
}

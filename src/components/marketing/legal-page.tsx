import Link from "next/link";

import { copy } from "@/lib/copy";

interface LegalSection {
  heading: string;
  body: readonly string[];
}

/**
 * Kerangka halaman legal (privasi/refund) dari data terstruktur di `copy`.
 * Seksi dengan satu butir → paragraf; lebih dari satu → daftar berbutir.
 */
export function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: readonly LegalSection[];
}) {
  const l = copy.marketing.legal;

  return (
    <section className="mrv-section">
      <div className="mrv-container mrv-container--narrow mrv-prose">
        <span className="mrv-eyebrow">{l.updated}</span>
        <h1 className="mrv-display mrv-h1" style={{ marginTop: "0.85rem" }}>
          {title}
        </h1>
        <p className="mrv-lead" style={{ marginTop: "0.75rem" }}>
          {intro}
        </p>

        {sections.map((s) => (
          <div key={s.heading}>
            <h2>{s.heading}</h2>
            {s.body.length === 1 ? (
              <p>{s.body[0]}</p>
            ) : (
              <ul>
                {s.body.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </div>
        ))}

        <h2>{l.contactHeading}</h2>
        <p>
          {l.contactBody}{" "}
          <a href={`mailto:${l.contactEmail}`} className="mrv-theme-card__demo">
            {l.contactEmail}
          </a>
          .
        </p>

        <p style={{ marginTop: "2.5rem" }}>
          <Link href="/" className="mrv-theme-card__demo">
            ← {l.backHome}
          </Link>
        </p>
      </div>
    </section>
  );
}

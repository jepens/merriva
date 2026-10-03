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
  // Dilebarkan ke `string` secara eksplisit: `copy` ber-`as const`, sehingga
  // field yang masih kosong bertipe literal `""` dan setiap pengecekan di sini
  // akan dianggap selalu-salah oleh TypeScript. Begitu pemilik mengisinya,
  // tipenya berubah dan kode ini tetap sama.
  const m: Record<"form" | "name" | "owner" | "address" | "taxId", string> =
    l.merchant;
  const identitas = [
    m.name && `${m.form}: ${m.name}`,
    m.owner && `${l.merchantOwner}: ${m.owner}`,
    m.address && `${l.merchantAddress}: ${m.address}`,
    m.taxId && `${l.merchantTaxId}: ${m.taxId}`,
  ].filter((v) => v !== "");

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

        {/* Identitas pelaku usaha — WAJIB tampil sebelum pembayaran (PP 80/2019,
            Permendag 31/2020 PMSE), dan aggregator pembayaran rutin
            menangguhkan merchant yang tak punya. Hanya field yang TERISI yang
            dirender: halaman tetap benar sebelum pemilik mengisinya, tetapi
            `name` + `address` wajib ada sebelum menerima uang pertama. */}
        {identitas.length > 0 ? (
          <>
            <h2>{l.merchantHeading}</h2>
            <ul>
              {identitas.map((baris) => (
                <li key={baris}>{baris}</li>
              ))}
            </ul>
          </>
        ) : null}

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

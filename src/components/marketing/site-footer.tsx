import Link from "next/link";

import { copy } from "@/lib/copy";

/**
 * Footer marketing: brand + kolom tautan (produk / perusahaan / legal) + baris
 * hak cipta. Tahun dihitung saat render (build/ISR).
 */
export function SiteFooter() {
  const f = copy.marketing.footer;
  const m = copy.marketing.nav;
  const year = new Date().getFullYear();

  return (
    <footer className="mrv-footer">
      <div className="mrv-container mrv-section--tight">
        <div className="mrv-footer__grid">
          <div>
            <Link href="/" className="mrv-brand" aria-label={copy.brand.name}>
              {copy.brand.name}
              <span className="mrv-brand__dot" aria-hidden="true" />
            </Link>
            <p
              className="mrv-lead"
              style={{ marginTop: "0.85rem", maxWidth: "22rem" }}
            >
              {f.tagline}
            </p>
          </div>

          <div>
            <h4>{f.colProduct}</h4>
            <div className="mrv-footer__links">
              <Link href="/tema">{m.themes}</Link>
              <Link href="/harga">{m.pricing}</Link>
              <Link href="/faq">{m.faq}</Link>
            </div>
          </div>

          <div>
            <h4>{f.colCompany}</h4>
            <div className="mrv-footer__links">
              <Link href="/daftar">{m.cta}</Link>
              <Link href="/masuk">{m.login}</Link>
            </div>
          </div>

          <div>
            <h4>{f.colLegal}</h4>
            <div className="mrv-footer__links">
              <Link href="/syarat">{copy.marketing.legal.terms.title}</Link>
              <Link href="/privasi">{copy.marketing.legal.privacy.title}</Link>
              <Link href="/refund">{copy.marketing.legal.refund.title}</Link>
            </div>
          </div>
        </div>

        <div className="mrv-footer__bottom">
          <span>{f.rights(year)}</span>
          <span>{f.madeIn}</span>
        </div>
      </div>
    </footer>
  );
}

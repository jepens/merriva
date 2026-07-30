import Link from "next/link";

import { copy } from "@/lib/copy";
import { formatIdr } from "@/lib/format";
import { packageFeatures } from "@/lib/package-features";
import type { MarketingPackage } from "@/server/marketing/catalog";

/**
 * Kartu harga marketing — harga & fitur langsung dari `packages` (DB), jadi selalu
 * sinkron (SPEC §4.1). Berbeda dari `PackageChooser` dashboard: di sini tak ada
 * checkout langsung (belum ada undangan) → CTA mengarah ke pendaftaran/funnel.
 * Paket teratas (harga tertinggi) ditandai "Terpopuler".
 */
export function PricingCards({ packages }: { packages: MarketingPackage[] }) {
  return (
    <div className="mrv-price-grid">
      {packages.map((pkg, i) => {
        const featured = i === packages.length - 1;
        return (
          <div
            key={pkg.code}
            className={`mrv-price ${featured ? "mrv-price--featured" : ""}`}
          >
            <div className="space-y-2">
              <div className="mrv-price__head">
                <span className="mrv-price__name">{pkg.name}</span>
                {featured ? (
                  <span className="mrv-price__badge">
                    {copy.marketing.pricing.popular}
                  </span>
                ) : null}
              </div>
              <div className="mrv-price__amount">{formatIdr(pkg.priceIdr)}</div>
              <div className="mrv-price__dur">
                {copy.checkout.perDuration(pkg.durationMonths)}
              </div>
            </div>

            <ul className="mrv-price__list">
              {packageFeatures(pkg.limits, pkg.durationMonths).map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>

            <Link
              href="/daftar"
              className={`mrv-btn ${featured ? "mrv-btn--primary" : "mrv-btn--ghost"}`}
            >
              {copy.marketing.pricing.ctaGeneric}
            </Link>
          </div>
        );
      })}
    </div>
  );
}

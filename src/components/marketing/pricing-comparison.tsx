import type { ReactNode } from "react";

import { copy } from "@/lib/copy";
import { formatIdr } from "@/lib/format";
import type { MarketingPackage } from "@/server/marketing/catalog";

function yes() {
  return (
    <span className="mrv-yes" aria-label="ya">
      ✓
    </span>
  );
}
function no() {
  return (
    <span className="mrv-no" aria-label="tidak">
      —
    </span>
  );
}

/**
 * Tabel perbandingan paket lengkap — nilai diturunkan dari `packages.limits` (DB)
 * agar selalu sinkron dengan katalog & checkout. Menggulir horizontal di layar
 * sempit tanpa memaksa body ikut menggulir.
 */
export function PricingComparison({
  packages,
}: {
  packages: MarketingPackage[];
}) {
  const t = copy.marketing.pages.pricing.compare;

  const rows: { label: string; cell: (p: MarketingPackage) => ReactNode }[] = [
    { label: t.price, cell: (p) => formatIdr(p.priceIdr) },
    { label: t.duration, cell: (p) => t.months(p.durationMonths) },
    { label: t.photos, cell: (p) => t.photosVal(p.limits.maxPhotos) },
    {
      label: t.guests,
      cell: (p) =>
        p.limits.maxGuests === null
          ? t.guestsUnlimited
          : t.guestsVal(p.limits.maxGuests),
    },
    {
      label: t.themes,
      cell: (p) => (p.limits.allThemes ? t.themesAll : t.themesStd),
    },
    { label: t.youtube, cell: (p) => (p.limits.youtube ? yes() : no()) },
    { label: t.rsvp, cell: () => yes() },
    {
      label: t.watermark,
      cell: (p) => (p.limits.watermark ? t.watermarkYes : t.watermarkNo),
    },
  ];

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="mrv-compare">
        <thead>
          <tr>
            <th scope="col">{copy.marketing.pages.pricing.featureCol}</th>
            {packages.map((p) => (
              <th key={p.code} scope="col">
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row" style={{ fontWeight: 500 }}>
                {row.label}
              </th>
              {packages.map((p) => (
                <td key={p.code}>{row.cell(p)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

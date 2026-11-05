import { describe, expect, it } from "vitest";

import { copy } from "@/lib/copy";
import { BASIC_LIMITS, type PackageLimits } from "@/lib/limits";
import { packageFeatures } from "@/lib/package-features";
import {
  FALLBACK_CATALOG_META,
  getThemeCatalogMeta,
  themeCatalogMeta,
} from "@/themes/catalog-meta";
import { demoDataRegistry } from "@/themes/demo-data-registry";
import { themeRegistry } from "@/themes/registry";

/**
 * Menjaga katalog marketing (M4.3) tetap konsisten dengan sistem tema: tiap tema
 * terdaftar wajib punya identitas poster + data demo, dan daftar fitur paket
 * (dipakai kartu harga marketing & pemilih paket checkout) tetap benar.
 */
describe("catalog visual meta", () => {
  const slugs = Object.keys(themeRegistry);

  it("setiap tema terdaftar punya poster meta khusus (bukan fallback)", () => {
    for (const slug of slugs) {
      expect(
        themeCatalogMeta[slug],
        `meta hilang untuk tema ${slug}`,
      ).toBeDefined();
    }
  });

  it("setiap tema terdaftar punya data demo (katalog bisa membuka demo)", () => {
    for (const slug of slugs) {
      expect(
        demoDataRegistry[slug],
        `demo hilang untuk tema ${slug}`,
      ).toBeDefined();
    }
  });

  it("meta menyediakan warna & ornamen non-kosong", () => {
    for (const [slug, m] of Object.entries(themeCatalogMeta)) {
      for (const key of ["bg", "ink", "accent", "line", "ornament"] as const) {
        expect(m[key], `${slug}.${key}`).toBeTruthy();
      }
    }
  });

  it("getThemeCatalogMeta jatuh ke fallback untuk slug tak dikenal", () => {
    expect(getThemeCatalogMeta("slug-tak-dikenal")).toBe(FALLBACK_CATALOG_META);
  });
});

describe("packageFeatures", () => {
  it("Basic: tema standar, ada watermark, tamu terbatas, tanpa youtube", () => {
    const f = copy.checkout.feat;
    const feats = packageFeatures(BASIC_LIMITS, 6);
    expect(feats).toContain(f.standardThemes);
    expect(feats).toContain(f.watermark);
    expect(feats).toContain(f.guestsLimited(500));
    expect(feats).toContain(f.photos(8));
    expect(feats).not.toContain(f.youtube);
    expect(feats).toContain(copy.checkout.perDuration(6));
  });

  it("Premium (tanpa batas): semua tema, tanpa watermark, youtube, tamu tanpa batas", () => {
    const f = copy.checkout.feat;
    const premium: PackageLimits = {
      maxPhotos: 20,
      maxGuests: null,
      youtube: true,
      allThemes: true,
      watermark: false,
    };
    const feats = packageFeatures(premium, 12);
    expect(feats).toContain(f.allThemes);
    expect(feats).toContain(f.noWatermark);
    expect(feats).toContain(f.youtube);
    expect(feats).toContain(f.guestsUnlimited);
    expect(feats).toContain(copy.checkout.perDuration(12));
  });
});

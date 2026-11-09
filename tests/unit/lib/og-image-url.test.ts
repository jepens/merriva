import { describe, expect, it } from "vitest";

import { ogImageUrl, ogSlugFromSegment } from "@/lib/og/image-url";

/**
 * URL og:image (DECISIONS #122). Path tanpa ekstensi terukur `cf-cache-status:
 * DYNAMIC` di produksi — tiap pengambilan dirender ulang 1–3 detik dan memakan
 * jatah tunggu WhatsApp Desktop/Web. Berakhiran `.jpg` → di-cache Cloudflare
 * secara bawaan. Metadata halaman dan pemanasan dari Sebar memakai helper ini,
 * jadi untuk `updated_at` yang sama keduanya menghasilkan URL yang identik.
 */

describe("ogImageUrl", () => {
  it("berakhiran .jpg, ?v = updated_at dalam milidetik", () => {
    expect(ogImageUrl("rani-wanda", "2026-11-08T10:20:30.456Z")).toBe(
      `/api/og/rani-wanda.jpg?v=${Date.UTC(2026, 10, 8, 10, 20, 30, 456)}`,
    );
  });

  it("bentuk timestamptz Supabase (mikrodetik, +00:00) → milidetik yang sama", () => {
    // Dua simpanan dalam detik yang sama tetap beda URL (presisi milidetik).
    expect(ogImageUrl("rani-wanda", "2026-11-08T10:20:30.456789+00:00")).toBe(
      ogImageUrl("rani-wanda", "2026-11-08T10:20:30.456Z"),
    );
  });
});

describe("ogSlugFromSegment", () => {
  it("`<slug>.jpg` (og:image sejak #122) → slug", () => {
    expect(ogSlugFromSegment("rani-wanda.jpg")).toBe("rani-wanda");
  });

  it("slug polos (pratinjau yang sudah tersebar) tetap dilayani", () => {
    expect(ogSlugFromSegment("rani-wanda")).toBe("rani-wanda");
  });

  it("ekstensi lain tak dipotong → slug mustahil → gambar default di route", () => {
    expect(ogSlugFromSegment("rani-wanda.png")).toBe("rani-wanda.png");
  });
});

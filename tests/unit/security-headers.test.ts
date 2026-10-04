import { describe, expect, it } from "vitest";

import {
  AUTH_CSP,
  BASE_CSP,
  securityHeaderRules,
  type HeaderRule,
} from "../../config/security-headers";

/**
 * Header keamanan yang BENAR-BENAR terkirim per jalur.
 *
 * KENAPA BERKAS INI ADA: aturan header Next menimpa **per-kunci**, tidak
 * menggabung. Aturan `/dashboard/:path*` yang hanya menyetel `frame-ancestors`
 * karena itu MENGHAPUS `object-src`, `base-uri`, dan `form-action` dari seluruh
 * permukaan ter-auth — dan dokumen repo (komentar `next.config.ts` + DECISIONS
 * #57) sama-sama menyatakan perlindungan itu global, sehingga tak ada yang
 * mencurigainya. Dibuktikan dengan `curl -D -` sebelum diperbaiki:
 *   `/`          → object-src 'none'; base-uri 'self'; form-action 'self'
 *   `/dashboard` → frame-ancestors 'none'   (semua yang lain hilang)
 *
 * Yang diuji di sini adalah hasil GABUNGAN, bukan isi tiap aturan. Menguji
 * "setiap aturan ber-kunci CSP memuat ketiga direktif" tidak akan menangkap
 * cacatnya: ia lolos pada aturan masa depan yang menimpa `Referrer-Policy` atau
 * `Permissions-Policy` — kelas cacat yang sama, kunci berbeda.
 */

/**
 * `/dashboard/:path*` → regex, mengikuti path-to-regexp yang dipakai Next.
 *
 * Yang MUDAH salah: pada `:name*` garis miring di DEPANNYA ikut opsional, jadi
 * `/dashboard/:path*` mencocoki `/dashboard` yang polos. Tiruan pertama di
 * berkas ini menuntut garis miringnya dan karena itu menyimpulkan `/dashboard`
 * tak terkena aturan ter-auth — kesimpulan yang langsung dibantah
 * `curl -D - /dashboard` pada server nyata (ia menjawab `X-Frame-Options: DENY`).
 */
function sourceToRegExp(source: string): RegExp {
  let pola = "";
  for (const segmen of source.split("/").filter(Boolean)) {
    if (/^:[A-Za-z]+\*$/.test(segmen)) {
      // `:name*` = nol atau lebih segmen, BERIKUT garis miring di depannya.
      pola += "(?:/.*)?";
    } else if (segmen.includes(":")) {
      pola +=
        "/" + segmen.replace(/:[A-Za-z]+\*?/g, "[^/]*").replace(/\./g, "\\.");
    } else {
      pola += "/" + segmen.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${pola || "/"}/?$`);
}

/**
 * Tiru perilaku Next: SEMUA aturan yang `source`-nya cocok diterapkan
 * berurutan, dengan penugasan biasa per kunci → yang terakhir menang.
 */
function headerEfektif(
  rules: readonly HeaderRule[],
  path: string,
): Record<string, string> {
  const hasil: Record<string, string> = {};
  for (const rule of rules) {
    if (!sourceToRegExp(rule.source).test(path)) continue;
    for (const { key, value } of rule.headers) hasil[key] = value;
  }
  return hasil;
}

const JALUR_PUBLIK = ["/", "/andi-sinta", "/harga", "/syarat"];
const JALUR_TERAUTH = [
  "/dashboard",
  "/dashboard/undangan",
  "/dashboard/pesanan/MRV-8F3K2Q",
  "/admin",
  "/admin/order",
];

describe("pencocokan source (tiruan perilaku Next)", () => {
  it("`/:path*` mencocoki akar DAN jalur bersarang", () => {
    const re = sourceToRegExp("/:path*");
    for (const p of [...JALUR_PUBLIK, ...JALUR_TERAUTH]) {
      expect(re.test(p), p).toBe(true);
    }
  });

  it("`/dashboard/:path*` TIDAK mencocoki jalur publik", () => {
    const re = sourceToRegExp("/dashboard/:path*");
    expect(re.test("/dashboard")).toBe(true);
    expect(re.test("/dashboard/undangan")).toBe(true);
    expect(re.test("/")).toBe(false);
    expect(re.test("/andi-sinta")).toBe(false);
    // Slug undangan yang kebetulan berawalan sama tak boleh ikut tertangkap.
    expect(re.test("/dashboardku")).toBe(false);
  });
});

describe("CSP dasar bertahan di SELURUH jalur", () => {
  const rules = securityHeaderRules(false);

  it.each([...JALUR_PUBLIK, ...JALUR_TERAUTH])(
    "%s memuat object-src, base-uri, dan form-action",
    (path) => {
      const csp = headerEfektif(rules, path)["Content-Security-Policy"];
      // Inti regresinya: ketiga direktif ini pernah HILANG di jalur ter-auth,
      // yaitu tempat yang bisa dieksfiltrasi — cookie sesi, token tamu,
      // `gift_notes`, dan tombol refund admin.
      expect(csp, path).toContain("object-src 'none'");
      expect(csp, path).toContain("base-uri 'self'");
      expect(csp, path).toContain("form-action 'self'");
    },
  );
});

describe("permukaan ter-auth menambah larangan pembingkaian", () => {
  const rules = securityHeaderRules(false);

  it.each(JALUR_TERAUTH)(
    "%s: frame-ancestors none + X-Frame-Options DENY",
    (path) => {
      const h = headerEfektif(rules, path);
      expect(h["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
      expect(h["X-Frame-Options"]).toBe("DENY");
    },
  );

  it.each(JALUR_PUBLIK)(
    "%s tetap SAMEORIGIN (pratinjau membingkainya)",
    (path) => {
      const h = headerEfektif(rules, path);
      // `PreviewFrame` + editor tampilan membingkai halaman undangan dari
      // dashboard (same-origin) — DENY di sini akan mematikan pratinjau.
      expect(h["X-Frame-Options"]).toBe("SAMEORIGIN");
      expect(h["Content-Security-Policy"]).not.toContain("frame-ancestors");
    },
  );
});

describe("header non-CSP tak boleh ikut tersapu", () => {
  const rules = securityHeaderRules(false);

  it.each([...JALUR_PUBLIK, ...JALUR_TERAUTH])(
    "%s mempertahankan nosniff, Referrer-Policy, dan Permissions-Policy",
    (path) => {
      const h = headerEfektif(rules, path);
      expect(h["X-Content-Type-Options"], path).toBe("nosniff");
      expect(h["Referrer-Policy"], path).toBe(
        "strict-origin-when-cross-origin",
      );
      // `camera=(self)` WAJIB: Album Momen memakai getUserMedia di
      // `/[slug]/momen`. Menghilangkannya mematikan fitur berbayar.
      expect(h["Permissions-Policy"], path).toContain("camera=(self)");
    },
  );
});

describe("HSTS", () => {
  it("dikirim di production", () => {
    const h = headerEfektif(securityHeaderRules(true), "/dashboard");
    expect(h["Strict-Transport-Security"]).toContain("max-age=63072000");
  });

  it("TIDAK dikirim di luar production", () => {
    // Mengirimnya dari `next dev` memaksa https pada localhost dan mematikan
    // dev server. `isProd` diterima sebagai argumen justru agar cabang ini
    // teruji — di Vitest `NODE_ENV` selalu "test".
    const h = headerEfektif(securityHeaderRules(false), "/dashboard");
    expect(h["Strict-Transport-Security"]).toBeUndefined();
  });
});

describe("CSP ter-auth diturunkan dari CSP dasar, bukan ditulis ulang", () => {
  it("AUTH_CSP memuat BASE_CSP secara harfiah", () => {
    // Menyalin literalnya akan menciptakan kembali drift yang sama begitu satu
    // direktif ditambahkan ke CSP dasar.
    expect(AUTH_CSP.startsWith(BASE_CSP)).toBe(true);
  });

  it("setiap direktif CSP dasar ikut terbawa", () => {
    for (const direktif of BASE_CSP.split(";").map((s) => s.trim())) {
      expect(AUTH_CSP).toContain(direktif);
    }
  });
});

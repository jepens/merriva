/**
 * Aturan header keamanan — SATU sumber kebenaran untuk `next.config.ts` dan
 * untuk `tests/unit/security-headers.test.ts`.
 *
 * KENAPA MODUL TERSENDIRI, bukan tetap di `next.config.ts`: berkas itu
 * meng-import `@sentry/nextjs` di baris pertama, jadi mengimpornya dari Vitest
 * akan menarik seluruh SDK Sentry ke graph jsdom tanpa guna. Tanpa test, celah
 * di bawah ini tak akan pernah tertangkap — dan ia sudah pernah terjadi.
 *
 * ATURAN HEADER NEXT MENIMPA PER-KUNCI, TIDAK MENGGABUNG. Setiap aturan yang
 * `source`-nya cocok diterapkan berurutan dengan penugasan biasa
 * (`resHeaders[key] = value`), sehingga yang TERAKHIR menang. Karena itu
 * `/dashboard/:path*` yang hanya menyetel `frame-ancestors` pernah MENGHAPUS
 * `object-src`, `base-uri`, dan `form-action` dari seluruh permukaan ter-auth —
 * persis tempat yang paling butuh: cookie sesi, token tamu, `gift_notes`, dan
 * tombol refund admin. Diverifikasi dengan `curl -D -` sebelum diperbaiki:
 *   `/`          → object-src 'none'; base-uri 'self'; form-action 'self'
 *   `/dashboard` → frame-ancestors 'none'   ← SEMUA yang lain hilang
 *
 * Konsekuensinya untuk siapa pun yang menambah aturan baru: JANGAN menyetel
 * kunci yang sudah dipakai aturan sebelumnya tanpa menyertakan ulang nilainya.
 * Turunkan dari konstanta di bawah, dan biarkan test yang menjaganya.
 */

export interface HeaderEntry {
  key: string;
  value: string;
}

export interface HeaderRule {
  source: string;
  headers: HeaderEntry[];
}

/**
 * CSP PARSIAL — sengaja tanpa `script-src`/`connect-src` (DECISIONS #27 & #57).
 * Ketiga direktif ini tak menyentuh skrip inline maupun ISR, jadi gratis:
 *   object-src  — tak ada <object>/<embed> di produk ini; menutup plugin lawas
 *   base-uri    — mencegah <base> suntikan mengalihkan SELURUH URL relatif
 *   form-action — mengurung ke mana formulir boleh dikirim
 * Dua terakhir menutup jalur eskalasi/eksfiltrasi PASCA-XSS tanpa perlu
 * `script-src` sama sekali. Aman: redirect Pakasir memakai
 * `window.location.assign` (navigasi, bukan form) dan tak ada form
 * lintas-origin di repo ini.
 */
export const BASE_CSP =
  "object-src 'none'; base-uri 'self'; form-action 'self'";

/**
 * CSP permukaan ter-auth = CSP dasar DITAMBAH `frame-ancestors`.
 *
 * Diturunkan, tidak ditulis ulang: menyalin literalnya akan menciptakan kembali
 * drift yang sama begitu seseorang menambah satu direktif ke CSP dasar.
 */
export const AUTH_CSP = `${BASE_CSP}; frame-ancestors 'none'`;

/**
 * `isProd` diterima sebagai ARGUMEN, bukan dibaca dari `process.env` saat modul
 * dimuat: di Vitest `NODE_ENV` selalu `"test"`, jadi cabang HSTS tak akan pernah
 * teruji bila nilainya ditangkap di tingkat modul.
 */
export function securityHeaderRules(isProd: boolean): HeaderRule[] {
  const base: HeaderEntry[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // `camera=(self)` WAJIB: Album Momen memakai `getUserMedia` di
    // `/[slug]/momen` (same-origin).
    {
      key: "Permissions-Policy",
      value: "camera=(self), microphone=(), geolocation=(), payment=()",
    },
    // Halaman undangan & `/preview/*` sengaja SAMEORIGIN: `PreviewFrame` +
    // `appearance-editor` membingkainya dari dashboard (same-origin).
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "Content-Security-Policy", value: BASE_CSP },
    // HSTS hanya di production — mengirimnya dari `next dev` akan memaksa https
    // pada `localhost` dan mematikan dev server.
    ...(isProd
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ]
      : []),
  ];

  // Permukaan ter-auth: aksi destruktif (hapus undangan, reveal album, refund)
  // tak boleh bisa di-clickjack → larang pembingkaian sepenuhnya.
  // `frame-ancestors` mengalahkan `X-Frame-Options` di browser yang mendukung
  // keduanya; keduanya tetap dikirim demi peramban lawas.
  const noFrame: HeaderEntry[] = [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Content-Security-Policy", value: AUTH_CSP },
  ];

  return [
    { source: "/:path*", headers: base },
    { source: "/dashboard/:path*", headers: noFrame },
    { source: "/admin/:path*", headers: noFrame },
  ];
}

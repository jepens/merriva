// @ts-nocheck
/**
 * Regenerasi aset turunan merek (PNG/ICO) dari master SVG di `public/brand/`.
 *
 * Skrip OPS author-time (BUKAN runtime app). Jalankan setelah menyunting master
 * SVG — mis. mengubah warna tile atau bentuk mark — agar favicon, ikon PWA,
 * OG, dan banner tidak "drift" dari logonya:
 *
 *   pnpm brand:assets
 *
 * Rasterisasi memakai Chromium Playwright (sudah devDependency; `sharp` tidak
 * dipakai karena build-script-nya dimatikan di `pnpm-workspace.yaml`). Tiap
 * master dimuat sebagai <img> berukuran target lalu dipotret dengan latar
 * transparan — Chromium merender SVG identik dengan yang dilihat pengguna.
 *
 * Output:
 *   public/brand/png/*          PNG logo/mark (@1x/@2x, varian email)
 *   public/brand/social/*.png   banner hero, OG, kit media sosial (dari *.svg di folder yang sama)
 *   public/og-default.png       OG fallback undangan non-aktif (= og-1200x630)
 *   src/app/(marketing)/opengraph-image.png   OG halaman marketing (konvensi berkas Next)
 *   public/icons/*              favicon 16/32/48 + .ico, apple-touch-icon, ikon PWA (manifest)
 *   src/app/{grup}/icon.svg & apple-icon.png   ikon per route group (konvensi berkas Next)
 *
 * Catatan desain: ikon TIDAK diletakkan di `src/app/` (root) — ia akan diwarisi
 * `/[slug]` (halaman undangan TAMU), sedangkan "tanpa watermark Merriva" dijual
 * di paket Premium. Daftar route group di `ROUTE_GROUPS`.
 */
import { chromium } from "@playwright/test";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BRAND = join(ROOT, "public", "brand");
const ICONS = join(ROOT, "public", "icons");
const APP = join(ROOT, "src", "app");

/** Route group permukaan Merriva (bukan halaman undangan tamu). */
const ROUTE_GROUPS = [
  "(marketing)",
  "(auth)",
  "(dashboard)",
  "(admin)",
  "preview",
];

const SOCIAL = [
  ["hero-banner-1920x640", 1920, 640],
  ["hero-banner-1920x640-dark", 1920, 640],
  ["og-1200x630", 1200, 630],
  ["og-1200x630-dark", 1200, 630],
  ["profile-1080", 1080, 1080],
  ["profile-1080-light", 1080, 1080],
  ["x-header-1500x500", 1500, 500],
  ["x-header-1500x500-dark", 1500, 500],
  ["facebook-cover-820x312", 820, 312],
  ["facebook-cover-820x312-dark", 820, 312],
  ["linkedin-banner-1584x396", 1584, 396],
  ["linkedin-banner-1584x396-dark", 1584, 396],
];

/** [master SVG, PNG keluaran, lebar, tinggi (opsional — ikut rasio bila kosong)] */
const JOBS = [
  // --- logo & mark (public/brand/png) ---
  ["merriva-mark.svg", "png/merriva-mark-512.png", 512],
  ["merriva-mark.svg", "png/merriva-mark-1024.png", 1024],
  ["merriva-mark-light.svg", "png/merriva-mark-light-512.png", 512],
  ["merriva-logo.svg", "png/merriva-logo-600.png", 600],
  ["merriva-logo.svg", "png/merriva-logo-1200.png", 1200],
  ["merriva-logo-dark.svg", "png/merriva-logo-dark-600.png", 600],
  ["merriva-logo-dark.svg", "png/merriva-logo-dark-1200.png", 1200],
  ["merriva-logo-stacked.svg", "png/merriva-logo-stacked-600.png", 600],
  [
    "merriva-logo-stacked-dark.svg",
    "png/merriva-logo-stacked-dark-600.png",
    600,
  ],
  // email: ditampilkan 160 px lebar → PNG 320 px (@2x)
  ["merriva-logo.svg", "png/merriva-logo-email.png", 320],
  ["merriva-logo-dark.svg", "png/merriva-logo-email-dark.png", 320],
  ["merriva-mark.svg", "png/merriva-mark-email.png", 96],
  // --- sosial ---
  ...SOCIAL.map(([name, w, h]) => [
    `social/${name}.svg`,
    `social/${name}.png`,
    w,
    h,
  ]),
];

const ICON_SVG_COMMENT = `
  <!--
    Ikon situs Merriva — mark "Gerbang" (dua lengkungan + titik marigold),
    varian favicon (goresan lebih tebal) dari master public/brand/merriva-mark.svg.
    Di-generate \`pnpm brand:assets\` — jangan sunting manual; ubah masternya.

    SVG, bukan .ico/.png: nol dependensi, tajam di semua kerapatan piksel, dan
    cukup satu berkas. Next menyuntikkan <link rel="icon"> sendiri lewat
    konvensi berkas — tak ada yang perlu ditulis di \`metadata\`.

    SENGAJA TIDAK diletakkan di \`src/app/\` (root): ikon di sana diwarisi
    \`/[slug]\`, yaitu halaman undangan TAMU — dan "Tanpa watermark Merriva"
    adalah fitur yang DIJUAL di paket Premium. Karena itu berkas ini (dan
    \`apple-icon.png\`) hidup di tiap route group permukaan KAMI.
  -->
`;

/**
 * Buang metadata C2PA (content credentials) dari master.
 *
 * Master menyimpan manifest ±8,5 KB base64 — provenans BERKAS, bukan bagian
 * gambar. Di master itu wajar dan sengaja dibiarkan utuh. Di TURUNAN tidak:
 * `src/app/{grup}/icon.svg` diminta peramban pada tiap kunjungan, dan tanpa
 * pembuangan ini 95% isinya adalah metadata (8,9 KB berbanding ±0,4 KB gambar).
 * Rasterisasi juga ikut diuntungkan: data URL yang disuapkan ke Chromium
 * menyusut dari puluhan KB menjadi seukuran gambarnya.
 */
function stripMeta(svg) {
  return svg
    .replace(/<metadata>[\s\S]*?<\/metadata>/g, "")
    .replace(/\s+xmlns:c2pa="[^"]*"/g, "");
}

/** Ikon aplikasi dari master mark: tile plum penuh (sudut membulat opsional). */
function squareIcon(markSvg, { rounded, inset = 0 }) {
  // Ambil isi master (tanpa pembungkus <svg>), gambar ulang di atas tile.
  const inner = stripMeta(markSvg)
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<rect[^>]*\/>/, "") // tile asli dibuang; digambar ulang di bawah
    .replace(/<\/svg>\s*$/, "");
  const s = 1 - inset * 2;
  const g = inset
    ? `<g transform="translate(${64 * inset} ${64 * inset}) scale(${s})">${inner}</g>`
    : inner;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><rect width="64" height="64" rx="${rounded ? 14 : 0}" fill="#241f2b"/>${g}</svg>`;
}

/** Bungkus ICO berisi PNG (Vista+/semua peramban modern). */
function writeIco(path, entries) {
  const dir = Buffer.alloc(6 + 16 * entries.length);
  dir.writeUInt16LE(0, 0);
  dir.writeUInt16LE(1, 2);
  dir.writeUInt16LE(entries.length, 4);
  let offset = dir.length;
  const blobs = [];
  entries.forEach(([size, file], i) => {
    const blob = readFileSync(file);
    const o = 6 + 16 * i;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(blob.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += blob.length;
    blobs.push(blob);
  });
  writeFileSync(path, Buffer.concat([dir, ...blobs]));
}

async function launchBrowser() {
  const attempts = process.env.PW_CHANNEL
    ? [{ channel: process.env.PW_CHANNEL }]
    : [{}, { channel: "chrome" }, { channel: "msedge" }];
  let lastErr;
  for (const opts of attempts) {
    try {
      const b = await chromium.launch(opts);
      console.log(`Browser: ${opts.channel ?? "playwright-chromium"}`);
      return b;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/** Potret satu SVG (string) menjadi PNG transparan berukuran persis w×h. */
async function rasterize(page, svg, out, w, h) {
  const b64 = Buffer.from(svg).toString("base64");
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(
    `<!doctype html><html><head><style>html,body{margin:0;background:transparent}img{display:block;width:${w}px;height:${h}px}</style></head>` +
      `<body><img src="data:image/svg+xml;base64,${b64}" width="${w}" height="${h}" alt=""></body></html>`,
    { waitUntil: "load" },
  );
  await page.screenshot({
    path: out,
    type: "png",
    omitBackground: true,
    clip: { x: 0, y: 0, width: w, height: h },
  });
}

/** Ukuran intrinsik master dari atribut viewBox (untuk tinggi otomatis). */
function intrinsic(svg) {
  const m = /viewBox="([\d.\-]+)\s+([\d.\-]+)\s+([\d.]+)\s+([\d.]+)"/.exec(svg);
  return m ? { w: Number(m[3]), h: Number(m[4]) } : { w: 64, h: 64 };
}

(async () => {
  for (const d of [join(BRAND, "png"), join(BRAND, "social"), ICONS])
    mkdirSync(d, { recursive: true });

  const browser = await launchBrowser();
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await context.newPage();
  let n = 0;

  for (const [src, dst, w, h] of JOBS) {
    const svg = stripMeta(readFileSync(join(BRAND, src), "utf8"));
    const i = intrinsic(svg);
    const height = h ?? Math.round((w * i.h) / i.w);
    await rasterize(page, svg, join(BRAND, dst), w, height);
    n++;
  }

  // OG merek dipakai dua tempat: konvensi berkas Next di grup (marketing) dan
  // fallback undangan non-aktif (`/og-default.png`, lihat api/og/[slug]).
  copyFileSync(
    join(BRAND, "social", "og-1200x630.png"),
    join(APP, "(marketing)", "opengraph-image.png"),
  );
  copyFileSync(
    join(BRAND, "social", "og-1200x630.png"),
    join(ROOT, "public", "og-default.png"),
  );

  // Favicon & ikon aplikasi.
  const mark = readFileSync(join(BRAND, "merriva-mark.svg"), "utf8");
  const markSmall = readFileSync(
    join(BRAND, "merriva-mark-favicon.svg"),
    "utf8",
  );
  const rounded = squareIcon(mark, { rounded: true });
  const roundedSmall = squareIcon(markSmall, { rounded: true });
  const flat = squareIcon(mark, { rounded: false }); // iOS memasang mask-nya sendiri
  const maskable = squareIcon(mark, { rounded: false, inset: 0.17 }); // zona aman Android
  const icons = [
    [roundedSmall, "favicon-16x16.png", 16],
    [roundedSmall, "favicon-32x32.png", 32],
    [rounded, "favicon-48x48.png", 48],
    [flat, "apple-touch-icon.png", 180],
    [rounded, "icon-192.png", 192],
    [rounded, "icon-512.png", 512],
    [maskable, "icon-maskable-512.png", 512],
  ];
  for (const [svg, name, size] of icons) {
    await rasterize(page, svg, join(ICONS, name), size, size);
    n++;
  }
  writeIco(join(ICONS, "favicon.ico"), [
    [16, join(ICONS, "favicon-16x16.png")],
    [32, join(ICONS, "favicon-32x32.png")],
    [48, join(ICONS, "favicon-48x48.png")],
  ]);

  // Ikon per route group (konvensi berkas Next): icon.svg + apple-icon.png.
  const iconSvg = stripMeta(markSmall)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<svg([^>]*)>/, `<svg$1>${ICON_SVG_COMMENT}`)
    .replace(/<rect/g, "\n  <rect")
    .replace(/<path/g, "\n  <path")
    .replace(/<circle/g, "\n  <circle")
    .replace(/<\/svg>/, "\n</svg>\n");
  for (const rg of ROUTE_GROUPS) {
    writeFileSync(join(APP, rg, "icon.svg"), iconSvg);
    copyFileSync(
      join(ICONS, "apple-touch-icon.png"),
      join(APP, rg, "apple-icon.png"),
    );
  }

  await browser.close();
  console.log(
    `Selesai: ${n} PNG + favicon.ico + ikon ${ROUTE_GROUPS.length} route group → public/brand, public/icons, src/app/*`,
  );
})();

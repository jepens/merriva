// @ts-nocheck
/**
 * Regenerasi thumbnail tema untuk kartu pemilih tema (form buat undangan &
 * katalog /tema). Memotret tiap tema AKTIF dari pratinjau live-nya menjadi 2
 * gambar — cover + satu bagian isi — yang lalu ditampilkan di dalam mockup HP.
 *
 * Skrip OPS author-time (BUKAN runtime app). Jalankan saat menambah/mengubah
 * tema agar thumbnail tak "drift" dari tampilan asli:
 *
 *   1) pastikan dev server hidup:  pnpm dev
 *   2) pnpm thumbs                 # potret semua tema aktif
 *   3) pnpm thumbs --only=noir,aria   # hanya sebagian (uji cepat)
 *
 * Output: public/theme-thumbs/{slug}-cover.jpg & {slug}-inner.jpg (JPEG mutu 82;
 * Next <Image> mengoptimasi ke WebP/AVIF saat disajikan). Sumber tema diambil
 * dari halaman /tema (auto-discover slug yang punya demo) → tema baru ikut
 * otomatis. reduced-motion dipakai agar tangkapan deterministik (cover langsung
 * ter-wipe, reveal tampil penuh tanpa menunggu animasi).
 */
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(
  /\/+$/,
  "",
);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "theme-thumbs");
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? onlyArg.split("=")[1].split(",").filter(Boolean) : null;

// Ukuran potret ~aspek ponsel (9:19.5). deviceScaleFactor 1 cukup: kartu memakai
// thumbnail kecil, dan Next <Image> menghasilkan varian srcset sesuai `sizes`.
const VW = 400;
const VH = 844;

async function discoverSlugs(page) {
  await page.goto(`${BASE}/tema`, { waitUntil: "load", timeout: 30000 });
  const slugs = await page.$$eval('a[href*="/preview/tema/"]', (els) => [
    ...new Set(
      els.map((e) => new URL(e.href).pathname.split("/").filter(Boolean).pop()),
    ),
  ]);
  return slugs.filter(Boolean);
}

/** Sembunyikan/buang overlay dev Next.js (badge "N", error toast) dari tangkapan. */
async function hideDevOverlay(page) {
  await page
    .addStyleTag({
      content:
        "nextjs-portal,[data-next-badge-root],[data-nextjs-dev-tools-button],#__next-dev-tools-indicator{display:none !important}",
    })
    .catch(() => {});
  await page
    .evaluate(() =>
      document.querySelectorAll("nextjs-portal").forEach((e) => e.remove()),
    )
    .catch(() => {});
}

async function capture(page, slug) {
  await page.goto(`${BASE}/preview/tema/${slug}?embed=1`, {
    waitUntil: "load",
    timeout: 45000,
  });
  // Cover = <div role="dialog"> gerbang. Tunggu tampil lalu beri jeda muat font/foto.
  const dialog = page.getByRole("dialog").first();
  await dialog.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  await page
    .waitForLoadState("networkidle", { timeout: 12000 })
    .catch(() => {});
  await hideDevOverlay(page);
  await page.waitForTimeout(500);
  await page.screenshot({
    path: join(OUT, `${slug}-cover.jpg`),
    type: "jpeg",
    quality: 82,
  });

  // Buka gerbang: klik tombol PERTAMA di dalam cover (label beda per tema —
  // "Buka Undangan" / "PUTAR UNDANGAN" dst). reduced-motion → cover langsung buang.
  try {
    const btns = dialog.locator("button");
    if (await btns.count()) await btns.first().click({ timeout: 5000 });
    else await dialog.click({ timeout: 5000 });
    await dialog.waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
  } catch {
    /* tema tanpa gerbang → isi sudah tampak */
  }
  await page.waitForTimeout(400);
  // Gulir ke ~42% tinggi konten (biasanya bagian mempelai/cerita) untuk "isi".
  await page.evaluate(() => {
    const h = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
    );
    window.scrollTo(0, Math.round(h * 0.42));
  });
  await page
    .waitForLoadState("networkidle", { timeout: 10000 })
    .catch(() => {});
  await hideDevOverlay(page);
  await page.waitForTimeout(800);
  await page.screenshot({
    path: join(OUT, `${slug}-inner.jpg`),
    type: "jpeg",
    quality: 82,
  });
}

/**
 * Luncurkan Chromium. Browser bundel Playwright bisa belum terunduh/beda versi →
 * coba Edge lalu Chrome sistem (selalu ada di Win11), baru bundel. Override via
 * PW_CHANNEL (mis. `PW_CHANNEL=chrome`).
 */
async function launchBrowser() {
  const attempts = process.env.PW_CHANNEL
    ? [{ channel: process.env.PW_CHANNEL }]
    : [{ channel: "msedge" }, { channel: "chrome" }, {}];
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

(async () => {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: VW, height: VH },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  const slugs = ONLY ?? (await discoverSlugs(page));
  console.log(`Menangkap ${slugs.length} tema: ${slugs.join(", ")}`);

  let ok = 0;
  const fails = [];
  for (const slug of slugs) {
    try {
      await capture(page, slug);
      ok++;
      console.log(`  ✓ ${slug}`);
    } catch (e) {
      fails.push(`${slug}: ${e.message}`);
      console.error(`  ✖ ${slug}: ${e.message}`);
    }
  }

  await browser.close();
  console.log(`Selesai: ${ok}/${slugs.length} → ${OUT}`);
  if (fails.length) {
    console.error(`Gagal:\n${fails.join("\n")}`);
    process.exit(1);
  }
})();

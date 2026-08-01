// @ts-nocheck
/**
 * Isi foto demo tema dari Pexels ke ASET LOKAL (own-domain) — dijalankan
 * author-time, bukan runtime app.
 *
 *   pnpm demo:photos            # butuh PEXELS_API_KEY di .env / .env.local
 *
 * Alur: cari foto per tema (kunci Anda) → unduh 2 varian (sisi terpanjang 1600
 * & 400, meniru kontrak 1600px galeri) ke /public/demo/<slug>/ → tulis manifest
 * src/themes/_shared/demo-photos.generated.ts. Kunci HANYA dipakai untuk mencari;
 * app runtime tak pernah memuatnya. Menampilkan foto tak butuh kunci (URL CDN
 * publik) — tapi kami mengunduh agar patuh aturan own-domain (CLAUDE.md) & cepat.
 *
 * Lisensi Pexels: manifest menyimpan kredit fotografer + tautan; ditampilkan di
 * footer /tema & /preview (komponen PexelsCredit).
 */
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Muat KEY=VALUE dari .env.local lalu .env (tanpa menimpa env yang sudah ada). */
function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = join(ROOT, file);
    if (!existsSync(path)) continue;
    for (const raw of readFileSync(path, "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = val;
    }
  }
}

loadEnv();
const API_KEY = process.env.PEXELS_API_KEY;
if (!API_KEY) {
  console.error(
    "✖ PEXELS_API_KEY belum diset. Isi di .env lalu jalankan `pnpm demo:photos`.",
  );
  process.exit(1);
}

// Kurasi pencarian per tema — SILAKAN SUNTING query bila hasilnya kurang pas.
// orientation portrait untuk hero/galeri undangan; landscape untuk corporate.
const THEMES = [
  {
    slug: "eternal-rose",
    query: "elegant wedding couple",
    orientation: "portrait",
  },
  {
    slug: "meridian",
    query: "glamorous wedding gold",
    orientation: "portrait",
  },
  { slug: "barakah", query: "muslim wedding couple", orientation: "portrait" },
  { slug: "aria", query: "minimalist wedding", orientation: "portrait" },
  { slug: "verdant", query: "garden wedding flowers", orientation: "portrait" },
  { slug: "noir", query: "elegant wedding evening", orientation: "portrait" },
  { slug: "festa", query: "family celebration party", orientation: "portrait" },
  {
    slug: "lumina",
    query: "couple portrait soft light",
    orientation: "portrait",
  },
  {
    slug: "prisma",
    query: "business conference stage",
    orientation: "landscape",
  },
  {
    slug: "kirana",
    query: "javanese traditional wedding",
    orientation: "portrait",
  },
];

const COUNT = 6; // jumlah foto per tema (galeri demo memakai s/d 6)
const FULL = 1600; // sisi terpanjang varian tampil
const THUMB = 400; // sisi terpanjang varian thumbnail

/** URL Pexels dgn sisi terpanjang dibatasi (h utk portrait, w utk landscape). */
function sizedUrl(id, longSide, portrait) {
  const dim = portrait ? "h" : "w";
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&${dim}=${longSide}`;
}

async function searchPhotos(query, orientation) {
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("orientation", orientation);
  url.searchParams.set("size", "large");
  url.searchParams.set("per_page", String(COUNT));
  const res = await fetch(url, { headers: { Authorization: API_KEY } });
  if (!res.ok) {
    throw new Error(`Pexels search ${res.status}: ${await res.text()}`);
  }
  const remaining = res.headers.get("x-ratelimit-remaining");
  if (remaining) console.log(`  (sisa kuota Pexels: ${remaining})`);
  const json = await res.json();
  return json.photos ?? [];
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`unduh ${res.status} ${url}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

const demoPhotos = {};
const demoPhotoCredits = {};

for (const t of THEMES) {
  try {
    console.log(`→ ${t.slug}: "${t.query}"`);
    const photos = await searchPhotos(t.query, t.orientation);
    if (photos.length === 0) {
      console.warn(`  ! 0 hasil — lewati (demo pakai swatch).`);
      continue;
    }
    const dir = join(ROOT, "public", "demo", t.slug);
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });

    const media = [];
    const credits = [];
    let i = 0;
    for (const p of photos) {
      const portrait = p.height >= p.width;
      await download(sizedUrl(p.id, FULL, portrait), join(dir, `${i}.jpg`));
      await download(
        sizedUrl(p.id, THUMB, portrait),
        join(dir, `${i}-thumb.jpg`),
      );
      const ratio = p.width / p.height;
      const width = portrait ? Math.round(FULL * ratio) : FULL;
      const height = portrait ? FULL : Math.round(FULL / ratio);
      media.push({
        id: `demo-${t.slug}-${i}`,
        url: `/demo/${t.slug}/${i}.jpg`,
        thumbUrl: `/demo/${t.slug}/${i}-thumb.jpg`,
        width,
        height,
      });
      credits.push({
        photographer: p.photographer,
        photographerUrl: p.photographer_url,
        pexelsUrl: p.url,
        alt: p.alt ?? "",
      });
      i++;
    }
    demoPhotos[t.slug] = media;
    demoPhotoCredits[t.slug] = credits;
    console.log(`  ✓ ${media.length} foto`);
  } catch (err) {
    console.error(`  ✖ ${t.slug} gagal: ${err.message}`);
  }
}

const manifest = `/* AUTO-GENERATED oleh scripts/fetch-demo-photos.mjs — JANGAN sunting tangan.
 *
 * Regenerasi: \`pnpm demo:photos\` (butuh PEXELS_API_KEY di .env). Skrip mengunduh
 * foto ke /public/demo/<slug>/ lalu menulis ulang berkas ini. Selama kedua map
 * masih kosong (skrip belum dijalankan), tiap demo-data.ts memakai fallback
 * swatch SVG-nya sendiri.
 *
 * Lisensi Pexels mewajibkan tautan Pexels + kredit fotografer — ditampilkan di
 * footer /tema & /preview via komponen PexelsCredit (lihat DECISIONS).
 */
import type { InvitationMediaView } from "@/types/invitation";

export interface DemoPhotoCredit {
  photographer: string;
  photographerUrl: string;
  /** Halaman foto di Pexels (tautan kredit). */
  pexelsUrl: string;
  alt: string;
}

export const demoPhotos: Record<string, InvitationMediaView[]> = ${JSON.stringify(demoPhotos, null, 2)};

export const demoPhotoCredits: Record<string, DemoPhotoCredit[]> = ${JSON.stringify(demoPhotoCredits, null, 2)};
`;

await writeFile(
  join(ROOT, "src/themes/_shared/demo-photos.generated.ts"),
  manifest,
);

const done = Object.keys(demoPhotos).length;
console.log(
  `\n✓ Manifest ditulis (${done}/${THEMES.length} tema). Commit public/demo/ + demo-photos.generated.ts.`,
);

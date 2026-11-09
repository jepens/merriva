import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { getMediaRoot, getStorageDriver } from "@/lib/env";
import { berkasObjek, segmenObjek, tipeIsi } from "@/lib/storage/local-path";
import { parseRange } from "@/lib/storage/range";

/**
 * Penyaji media untuk driver storage `local` (SPEC §6.4 / DECISIONS #82).
 *
 * Ini yang membuat `NEXT_PUBLIC_MEDIA_URL=https://merriva.id/media` bekerja:
 * foto galeri, foto Album Momen, dan lagu dibaca dari volume VPS lalu dikirim
 * dari domain sendiri — aturan "jangan pernah serve media dari URL vendor"
 * tetap utuh, dan pindah ke R2 nanti tak mengubah satu pun URL yang beredar.
 *
 * Path objek memakai nama immutable (UUID/hash) sehingga aman di-cache
 * selamanya; Cloudflare di depannya yang menanggung beban hari-H dan origin
 * hanya tersentuh sekali per objek. Pengecualiannya musik unggahan klien
 * (`audio/`), yang bisa di-takedown — lihat `CACHE_AUDIO_UNGGAHAN`.
 *
 * Isi berkas di-STREAM sebatas rentang yang diminta, bukan dibaca utuh ke
 * memori. Dulu dibaca utuh (foto ratusan KB, lagu ±3MB — murah); sejak video
 * undangan (FASE J, ≤40MB) tidak lagi: pemutar video meminta puluhan Range
 * kecil per tamu, dan `.mov` tak di-cache Cloudflare secara bawaan, jadi tiap
 * Range sampai ke origin. Membaca 40MB untuk mengirim 64KB, dikali tamu yang
 * membuka undangan bersamaan, adalah jalan tercepat menuju OOM di hari-H.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Nama berbasis hash/UUID → isinya tak pernah berubah. */
const CACHE = "public, max-age=31536000, immutable";

/**
 * Musik unggahan klien (`audio/<undangan>/<uuid>.mp3`, DECISIONS #121): isinya
 * juga tak berubah, tetapi objeknya bisa DIHAPUS admin karena laporan hak
 * cipta. Dengan `immutable` setahun, Cloudflare dan peramban tamu tetap
 * menyajikannya setelah takedown sampai cache-nya di-purge manual. Satu jam
 * membuat takedown efektif ≤ 1 jam tanpa purge Cloudflare, dengan harga satu
 * revalidasi per jam per lagu di origin — lagu pustaka (`songs/`) tak terkena.
 */
const CACHE_AUDIO_UNGGAHAN = "public, max-age=3600";

/**
 * Header cache untuk path objek. Ditentukan dari SEGMEN yang sudah dinormalkan
 * (`segmenObjek`, yang sama dengan pembaca berkas), bukan dari teks URL — jadi
 * `//audio/...` atau segmen kosong lain tak bisa menyajikan berkas audio
 * unggahan dengan cache setahun.
 */
function cacheUntuk(rel: string): string {
  return segmenObjek(rel)?.[0] === "audio" ? CACHE_AUDIO_UNGGAHAN : CACHE;
}

function tolak(status: number, headers?: HeadersInit): Response {
  return new Response(null, { status, headers });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  // Dengan driver lain, URL media menunjuk host lain dan route ini tak boleh
  // menjadi permukaan baca berkas yang menganggur di produksi.
  if (getStorageDriver() !== "local") return tolak(404);

  const { path } = await params;
  const rel = (path ?? []).join("/");

  // Ekstensi di luar daftar-putih = 404 walau berkasnya ada. Yang ditahan nyata:
  // sisa unggah gagal bernama `*.tmp`, dan berkas apa pun yang kelak tak sengaja
  // mendarat di volume ini.
  const tipe = tipeIsi(rel);
  const berkas = berkasObjek(getMediaRoot(), rel);
  if (!tipe || !berkas) return tolak(404);

  let info;
  try {
    info = await stat(berkas);
  } catch {
    return tolak(404);
  }
  if (!info.isFile()) return tolak(404);

  const etag = `"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`;
  const dasar = {
    "Cache-Control": cacheUntuk(rel),
    ETag: etag,
    "Accept-Ranges": "bytes",
  };

  if (req.headers.get("if-none-match") === etag) return tolak(304, dasar);

  const rentang = parseRange(req.headers.get("range"), info.size);
  if (rentang === "invalid") {
    return tolak(416, { ...dasar, "Content-Range": `bytes */${info.size}` });
  }

  const start = rentang ? rentang.start : 0;
  const end = rentang ? rentang.end : info.size - 1;
  const panjang = end - start + 1;
  // Berkas kosong: `createReadStream` dengan `end: -1` tidak sah.
  const isi =
    panjang > 0
      ? (Readable.toWeb(
          createReadStream(berkas, { start, end }),
        ) as ReadableStream<Uint8Array>)
      : new Uint8Array(0);

  return new Response(isi, {
    status: rentang ? 206 : 200,
    headers: {
      ...dasar,
      "Content-Type": tipe,
      "Content-Length": String(panjang),
      ...(rentang
        ? {
            "Content-Range": `bytes ${rentang.start}-${rentang.end}/${info.size}`,
          }
        : {}),
    },
  });
}

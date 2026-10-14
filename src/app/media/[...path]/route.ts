import { readFile, stat } from "node:fs/promises";

import { getMediaRoot, getStorageDriver } from "@/lib/env";
import { berkasObjek, tipeIsi } from "@/lib/storage/local-path";
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
 * hanya tersentuh sekali per objek.
 *
 * Isi berkas dibaca UTUH ke memori, bukan di-stream. Objek di produk ini
 * berukuran ratusan KB (foto) sampai ±3MB (lagu) dan sudah dibatasi di sisi
 * unggah, jadi yang dibeli dengan sedikit memori adalah penanganan Range yang
 * sederhana dan tipe yang lurus. Bila kelak ada video, ini yang pertama diganti.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Nama berbasis hash/UUID → isinya tak pernah berubah. */
const CACHE = "public, max-age=31536000, immutable";

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
    "Cache-Control": CACHE,
    ETag: etag,
    "Accept-Ranges": "bytes",
  };

  if (req.headers.get("if-none-match") === etag) return tolak(304, dasar);

  const rentang = parseRange(req.headers.get("range"), info.size);
  if (rentang === "invalid") {
    return tolak(416, { ...dasar, "Content-Range": `bytes */${info.size}` });
  }

  const isi = await readFile(berkas);
  const potongan = rentang ? isi.subarray(rentang.start, rentang.end + 1) : isi;

  return new Response(new Uint8Array(potongan), {
    status: rentang ? 206 : 200,
    headers: {
      ...dasar,
      "Content-Type": tipe,
      "Content-Length": String(potongan.byteLength),
      ...(rentang
        ? {
            "Content-Range": `bytes ${rentang.start}-${rentang.end}/${info.size}`,
          }
        : {}),
    },
  });
}

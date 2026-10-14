import "server-only";

import { mkdir, rename, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { getMediaBaseUrl, getMediaRoot } from "@/lib/env";

import { segmenObjek } from "./local-path";
import type { StorageDriver, StorageObjectPath, UploadInput } from "./types";

/** Bangun URL publik dari domain sendiri + path relatif (tanpa URL vendor).
 * `getMediaBaseUrl()` gagal-keras di production bila basis kosong. */
function publicUrl(path: StorageObjectPath): string {
  return `${getMediaBaseUrl()}/${path.replace(/^\/+/, "")}`;
}

function segmenAtauGagal(path: StorageObjectPath): string[] {
  const segmen = segmenObjek(path);
  if (!segmen) throw new Error(`Path objek storage tidak sah: ${path}`);
  return segmen;
}

async function keBytes(
  body: ArrayBuffer | Uint8Array | Blob,
): Promise<Uint8Array> {
  if (body instanceof Blob) return new Uint8Array(await body.arrayBuffer());
  if (body instanceof Uint8Array) return body;
  return new Uint8Array(body);
}

function pesan(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Driver filesystem VPS (SPEC §6.4) — media disimpan di disk server sendiri dan
 * disajikan route `/media/[...path]` dari domain sendiri.
 *
 * Dipakai sebagai tahap ANTARA: Supabase free tier hanya memberi 5GB egress
 * sebulan (habis oleh satu resepsi ramai) sedangkan R2 belum disiapkan. Kontrak
 * `StorageDriver` tak berubah, jadi pindah ke R2 nanti tetap "ganti env".
 *
 * Syarat operasional yang TIDAK boleh dilupakan: `MEDIA_ROOT` harus menunjuk
 * VOLUME yang di-mount (Easypanel → Mounts). Tanpa itu berkas ditulis ke lapisan
 * container yang dibuang setiap deploy — unggah tetap "berhasil", lalu seluruh
 * foto klien hilang pada rebuild berikutnya tanpa satu pun galat. Lihat
 * DECISIONS #82 dan docs/DEPLOYMENT.md.
 */
export class LocalStorageDriver implements StorageDriver {
  private berkas(path: StorageObjectPath): string {
    return resolve(getMediaRoot(), ...segmenAtauGagal(path));
  }

  async upload(input: UploadInput): Promise<StorageObjectPath> {
    const berkas = this.berkas(input.path);
    await mkdir(dirname(berkas), { recursive: true });
    const isi = await keBytes(input.body);
    // Tulis ke nama sementara lalu RENAME (atomik di filesystem yang sama):
    // tamu yang kebetulan meminta objek ini saat unggah berjalan mendapat 404
    // atau berkas utuh — tak pernah foto separuh. Ekstensi `.tmp` juga di luar
    // daftar-putih penyaji, jadi sisa unggah gagal tak bisa diunduh.
    const sementara = `${berkas}.${crypto.randomUUID()}.tmp`;
    try {
      await writeFile(sementara, isi);
      await rename(sementara, berkas);
    } catch (err) {
      await rm(sementara, { force: true });
      throw new Error(`Gagal unggah storage lokal: ${pesan(err)}`);
    }
    return input.path;
  }

  getPublicUrl(path: StorageObjectPath): string {
    return publicUrl(path);
  }

  async delete(path: StorageObjectPath): Promise<void> {
    const segmen = segmenAtauGagal(path);
    const berkas = resolve(getMediaRoot(), ...segmen);
    // `force` = idempoten, sama seperti R2 yang memperlakukan 404 sebagai sukses.
    await rm(berkas, { force: true });
    // Rapikan direktori prefix yang jadi kosong (`inv/<inv>/<media>/`). `rmdir`
    // gagal bila masih berisi — itu justru yang diinginkan, jadi galatnya
    // diabaikan. Hanya untuk path bersarang: direktori AKAR adalah titik mount
    // volume dan tak boleh ikut terhapus.
    if (segmen.length > 1) await rmdir(dirname(berkas)).catch(() => {});
  }
}

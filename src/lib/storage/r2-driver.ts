import "server-only";

import { AwsClient } from "aws4fetch";

import {
  getR2AccessKeyId,
  getR2AccountId,
  getR2Bucket,
  getR2SecretAccessKey,
} from "@/lib/env";

import type { StorageDriver, StorageObjectPath, UploadInput } from "./types";

/** Bangun URL publik dari domain sendiri (cdn.merriva.id) + path relatif. */
function publicUrl(path: StorageObjectPath): string {
  const base = (process.env.NEXT_PUBLIC_MEDIA_URL ?? "").replace(/\/+$/, "");
  return `${base}/${path.replace(/^\/+/, "")}`;
}

/** Normalkan body ke ArrayBuffer bersih (aws4fetch meng-hash-nya untuk SigV4). */
async function toArrayBuffer(
  body: ArrayBuffer | Uint8Array | Blob,
): Promise<ArrayBuffer> {
  if (body instanceof Blob) return body.arrayBuffer();
  if (body instanceof Uint8Array) {
    const ab = new ArrayBuffer(body.byteLength);
    new Uint8Array(ab).set(body);
    return ab;
  }
  return body;
}

/**
 * Driver Cloudflare R2 via S3 API (SPEC §6.4 / DECISIONS #6). Menandatangani
 * request S3 SigV4 dengan `aws4fetch` (6,4 KB; memakai `fetch` + `SubtleCrypto`
 * global — tersedia di Node 22 runtime). Karena hostname R2 tak mengikuti pola
 * AWS, `service`/`region` DISET eksplisit ("s3"/"auto") agar penandatanganan
 * benar. Klien di-cache; kredensial dibaca lazy (server-only) → build/CI tanpa
 * env R2 tak gagal. Penyajian ke tamu tetap lewat `getPublicUrl` (domain sendiri,
 * bukan URL vendor) sehingga pindah vendor cukup ganti env.
 */
export class R2StorageDriver implements StorageDriver {
  private client: AwsClient | null = null;
  private base: string | null = null;

  private ensure(): { client: AwsClient; base: string } {
    if (!this.client || !this.base) {
      this.client = new AwsClient({
        accessKeyId: getR2AccessKeyId(),
        secretAccessKey: getR2SecretAccessKey(),
        service: "s3",
        region: "auto",
      });
      // Endpoint S3 R2 + bucket → prefix key. Key (path relatif) hanya berisi
      // karakter aman URL (uuid + `1600.webp`), jadi tanpa encoding tambahan.
      this.base = `https://${getR2AccountId()}.r2.cloudflarestorage.com/${getR2Bucket()}`;
    }
    return { client: this.client, base: this.base };
  }

  private objectUrl(path: StorageObjectPath): string {
    const { base } = this.ensure();
    return `${base}/${path.replace(/^\/+/, "")}`;
  }

  async upload(input: UploadInput): Promise<StorageObjectPath> {
    const { client } = this.ensure();
    const body = await toArrayBuffer(input.body);
    const res = await client.fetch(this.objectUrl(input.path), {
      method: "PUT",
      headers: {
        "Content-Type": input.contentType,
        // Immutable: path berbasis hash → boleh di-cache lama oleh CDN.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      body,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Gagal unggah R2 (${res.status}): ${detail.slice(0, 200)}`);
    }
    return input.path;
  }

  getPublicUrl(path: StorageObjectPath): string {
    return publicUrl(path);
  }

  async delete(path: StorageObjectPath): Promise<void> {
    const { client } = this.ensure();
    const res = await client.fetch(this.objectUrl(path), { method: "DELETE" });
    // S3/R2: sukses = 204; 404 (objek sudah tiada) diperlakukan idempoten.
    if (!res.ok && res.status !== 404) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Gagal hapus R2 (${res.status}): ${detail.slice(0, 200)}`);
    }
  }
}

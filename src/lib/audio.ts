import { createHash } from "node:crypto";

/**
 * Konstanta berkas audio lagu latar (pustaka musik, SPEC §5 `songs`).
 * Dipakai unggah admin: validasi tipe/ukuran + membangun storage path.
 */

/** Batas ukuran berkas audio — cukup untuk satu lagu instrumental terkompresi. */
export const AUDIO_MAX_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * MIME audio yang diizinkan → ekstensi berkas. Validasi berbasis MIME (bukan
 * nama berkas) agar tak bisa dikelabui ekstensi palsu.
 */
export const AUDIO_MIME_EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/opus": "opus",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
};

/**
 * Storage path lagu (content-addressed): `songs/<sha256>.<ext>`. Hash isi →
 * unggah idempoten (berkas identik ⇒ path sama) sesuai konvensi immutable-hash
 * storage (`lib/storage/types.ts`). Path relatif; DB tak pernah simpan URL vendor.
 */
export function songObjectPath(bytes: Uint8Array, ext: string): string {
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 32);
  return `songs/${hash}.${ext}`;
}

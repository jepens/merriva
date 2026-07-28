import { z } from "zod";

/**
 * Validasi checkout (SPEC §4.8 / M3.1). Klien hanya memilih **kode paket**;
 * harga & durasi diambil server dari tabel `packages` (jangan percaya nominal
 * dari klien — uang selalu diverifikasi ulang di server).
 */

export const PACKAGE_CODES = ["basic", "premium"] as const;
export type PackageCode = (typeof PACKAGE_CODES)[number];

export const packageCodeSchema = z.enum(PACKAGE_CODES);

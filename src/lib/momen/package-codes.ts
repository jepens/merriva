import { z } from "zod";

/**
 * Kode paket add-on Album Momen (baris `packages` kind='addon_momen', DECISIONS
 * #22). Dipisah dari kode paket undangan (`lib/validation/checkout.ts`) agar
 * add-on tak bocor ke pemilih paket undangan dan sebaliknya.
 *
 * Model harga per JUMLAH PESERTA (device unik). Tier `momen_5` GRATIS →
 * self-service langsung tanpa order/Pakasir (activateFreeMomenAction); tier
 * berbayar lewat alur order+Pakasir yang sama seperti undangan
 * (createMomenCheckoutAction). Harga otoritatif tetap dari DB — konstanta di
 * sini hanya untuk validasi kode + urutan tampil.
 */

/** Tier gratis (self-service, tanpa pembayaran). */
export const MOMEN_FREE_CODE = "momen_5" as const;

/** Tier berbayar (lewat order + Pakasir). Urutan = urutan tampil termurah→termahal. */
export const MOMEN_PAID_CODES = [
  "momen_50",
  "momen_100",
  "momen_200",
  "momen_unlimited",
] as const;

/** Semua kode add-on (gratis + berbayar). */
export const MOMEN_ADDON_CODES = [
  MOMEN_FREE_CODE,
  ...MOMEN_PAID_CODES,
] as const;

export type MomenPaidCode = (typeof MOMEN_PAID_CODES)[number];
export type MomenAddonCode = (typeof MOMEN_ADDON_CODES)[number];

/** Validasi kode tier BERBAYAR (checkout Pakasir; `momen_5` gratis ditolak). */
export const momenPaidCodeSchema = z.enum(MOMEN_PAID_CODES);

/** Validasi kode add-on apa pun (gratis atau berbayar). */
export const momenAddonCodeSchema = z.enum(MOMEN_ADDON_CODES);

/** True bila kode = tier gratis (self-service, bukan jalur bayar). */
export function isMomenFreeCode(code: string): boolean {
  return code === MOMEN_FREE_CODE;
}

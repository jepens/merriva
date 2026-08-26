/**
 * Logika jatah jepret (MOMEN-SPEC §4/§6) — murni. Sumber angka dari DB
 * (`momen_albums.photo_count`, hitungan per `device_id`); penegakan SEBENARNYA
 * terjadi atomik di RPC — modul ini menjaga UX klien & dipakai ulang server
 * untuk pesan error yang konsisten.
 */

export interface QuotaState {
  /** Kapasitas total album (tier add-on). */
  quotaTotal: number;
  /** Foto tersimpan di album saat ini. */
  photoCount: number;
  /** Jatah per tamu (1–20). */
  quotaPerGuest: number;
  /** Foto yang sudah diambil perangkat/tamu ini. */
  deviceCount: number;
}

export type DenyReason = "album-full" | "guest-quota";

const nn = (v: number): number =>
  Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;

/** Sisa jatah perangkat ini (dibatasi juga oleh sisa kapasitas album). */
export function remainingForDevice(s: QuotaState): number {
  const perGuest = Math.max(0, nn(s.quotaPerGuest) - nn(s.deviceCount));
  return Math.min(perGuest, remainingTotal(s));
}

/** Sisa kapasitas album. */
export function remainingTotal(s: QuotaState): number {
  return Math.max(0, nn(s.quotaTotal) - nn(s.photoCount));
}

/** Boleh jepret sekarang? Alasan penolakan stabil untuk copy UI. */
export function canCapture(
  s: QuotaState,
): { ok: true } | { ok: false; reason: DenyReason } {
  if (remainingTotal(s) <= 0) return { ok: false, reason: "album-full" };
  if (nn(s.deviceCount) >= nn(s.quotaPerGuest)) {
    return { ok: false, reason: "guest-quota" };
  }
  return { ok: true };
}

/**
 * Logika fase Album Momen (MOMEN-SPEC §2) — murni & bebas timezone-trap:
 * semua perbandingan dalam epoch milliseconds; `reveal_at` disimpan sebagai
 * timestamptz dan dikirim ke klien sebagai ISO string (dengan offset).
 *
 * NULL reveal_at = mode "instan" (foto langsung tampil).
 * Host/pemilik SELALU boleh melihat (kebutuhan moderasi pra-reveal).
 */

export type AlbumPhase = "hidden" | "revealed";

/**
 * Fase album pada saat `nowMs`. `revealAt` null ⇒ langsung `revealed`.
 * String non-null yang tak terparse ⇒ `hidden` (FAIL-CLOSED: data korup tidak
 * boleh membocorkan foto sebelum waktunya).
 */
export function resolveAlbumPhase(
  nowMs: number,
  revealAtIso: string | null,
): AlbumPhase {
  if (revealAtIso === null) return "revealed";
  const t = Date.parse(revealAtIso);
  if (Number.isNaN(t)) return "hidden";
  return nowMs >= t ? "revealed" : "hidden";
}

/** Milidetik menuju reveal; 0 bila sudah lewat / mode instan / nilai invalid. */
export function msUntilReveal(
  nowMs: number,
  revealAtIso: string | null,
): number {
  if (revealAtIso === null) return 0;
  const t = Date.parse(revealAtIso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, t - nowMs);
}

/**
 * Boleh melihat isi album? Tamu hanya saat `revealed`; pemilik selalu.
 * Server WAJIB memakai aturan yang sama di query publik (fail-closed).
 */
export function canViewPhotos(phase: AlbumPhase, isOwner: boolean): boolean {
  return isOwner || phase === "revealed";
}

/** Pecahan hitung-mundur untuk UI (hari/jam/menit/detik), floor & non-negatif. */
export function countdownParts(ms: number): {
  d: number;
  h: number;
  m: number;
  s: number;
} {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

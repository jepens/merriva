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
 * Gerbang FAIL-CLOSED foto untuk jalur TAMU (MOMEN-SPEC §4). SATU-SATUNYA tempat
 * aturan ini tinggal — setiap jalur baca publik wajib melewatinya, supaya
 * perubahan tak bisa diterapkan ke satu jalur dan terlupa di jalur lain.
 *
 * Pemanggil: `src/app/[slug]/momen/page.tsx` (render awal) dan
 * `loadMomenPhotosAction` (halaman berikutnya) — aksi publik itu memeriksa
 * ULANG, tak boleh bersandar pada halaman pemanggilnya.
 *
 * Akses PEMILIK sengaja TIDAK punya parameter di sini: ia dipisahkan secara
 * struktural, bukan lewat flag. Dashboard adalah route terautentikasi yang
 * memverifikasi kepemilikan lalu membaca via service_role tanpa gerbang fase
 * sama sekali (host memang harus bisa memoderasi pra-reveal). Parameter
 * `isOwner` yang dulu ada tak pernah dipanggil dengan `true` oleh siapa pun —
 * flag mati yang justru mengundang salah pakai.
 */
export function canGuestViewPhotos(phase: AlbumPhase): boolean {
  return phase === "revealed";
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

/** Rentang byte yang diminta klien, sudah dijepit ke ukuran berkas. */
export type Rentang = { start: number; end: number };

/**
 * Parse header `Range` untuk penyaji media lokal (`/media/[...path]`).
 *
 * Mengembalikan:
 *  - `null`   → tak ada / bentuknya tak dikenali. RFC 9110 §14.2 membolehkan
 *               server mengabaikan Range yang tak dipahami dan mengirim 200
 *               berisi berkas utuh; itu yang kita lakukan.
 *  - `"invalid"` → bentuknya benar tetapi di luar ukuran berkas → 416.
 *  - `Rentang`   → 206.
 *
 * Yang membutuhkannya: pemutar musik undangan. Tanpa 206, menggeser posisi lagu
 * tak berfungsi dan Safari/iOS bisa menolak memutar audio sama sekali.
 *
 * Hidup di modul sendiri karena `route.ts` hanya boleh mengekspor handler HTTP
 * dan konfigurasi route — ekspor lain membuat `next build` gagal. Di sini ia
 * juga bisa diuji langsung, termasuk cabang yang jarang terpanggil.
 */
export function parseRange(
  raw: string | null,
  size: number,
): Rentang | "invalid" | null {
  if (!raw) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(raw.trim());
  if (!m) return null;
  const [, awal, akhir] = m;
  if (awal === "" && akhir === "") return null;

  let start: number;
  let end: number;
  if (awal === "") {
    // Bentuk sufiks `bytes=-N`: N byte TERAKHIR.
    start = Math.max(0, size - Number(akhir));
    end = size - 1;
  } else {
    start = Number(awal);
    end = akhir === "" ? size - 1 : Math.min(Number(akhir), size - 1);
  }
  // Satu perbandingan ini menutup SEMUA bentuk yang di luar jangkauan, karena
  // `end` sudah dijepit ke `size - 1`: permintaan yang mulai di luar berkas
  // (`bytes=1000-` pada 1000 byte) dan sufiks nol (`bytes=-0`) sama-sama
  // menghasilkan `start > end`. Cek `start >= size` yang terpisah pernah ada di
  // sini dan terbukti tak pernah bisa dijalankan — kode mati yang tampak seperti
  // pengaman.
  if (start > end) return "invalid";
  return { start, end };
}

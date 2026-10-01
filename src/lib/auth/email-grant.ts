/**
 * Apakah sebuah sesi lahir dari KLIK TAUTAN EMAIL yang masih segar?
 *
 * Dipakai `updatePasswordAction` untuk memisahkan dua hal yang dulu tak
 * dibedakan sama sekali (AUDIT-2026-10-01 B1): orang yang baru saja mengklik
 * tautan "lupa kata sandi" dari kotak masuknya, versus siapa pun yang kebetulan
 * memegang perangkat yang masih login.
 *
 * Nilai yang diperiksa adalah `otp`, BUKAN `recovery`. Itu hasil pengujian
 * langsung terhadap proyek ini, bukan bacaan dokumentasi: dokumentasi Supabase
 * mencantumkan `"recovery"` sebagai salah satu nilai `amr.method`, tetapi
 * `verifyOtp({ type: "recovery" })` yang sesungguhnya menghasilkan
 * `amr: [{ method: "otp", timestamp: … }]`. Memakai `"recovery"` akan mengunci
 * SETIAP pengguna dari pemulihan kata sandi. Lihat DECISIONS #51.
 *
 * Konsekuensi yang diterima sadar: verifikasi email saat pendaftaran juga
 * menghasilkan `otp`, jadi pendaftar baru punya jendela singkat tempat ia bisa
 * mengganti kata sandi tanpa menyebut yang lama. Ia baru saja membuktikan
 * kendali atas kotak masuknya, jadi itu bukan eskalasi.
 */

/** Umur maksimal tautan email yang masih dianggap memberi izin. */
export const EMAIL_GRANT_MAX_AGE_SEC = 30 * 60;

type AmrEntry = { method?: unknown; timestamp?: unknown };

export function isFreshEmailGrant(
  amr: unknown,
  nowSec: number,
  maxAgeSec: number = EMAIL_GRANT_MAX_AGE_SEC,
): boolean {
  if (!Array.isArray(amr)) return false;

  for (const item of amr) {
    // Bentuk RFC-8176 (`string[]`) tak membawa timestamp. Bentuk itu TIDAK
    // teramati pada proyek ini, tetapi bila kelak muncul, menolaknya akan
    // mematikan pemulihan kata sandi — kegagalan yang jauh lebih parah
    // daripada celah yang hendak ditutup. Jadi diterima tanpa cek kesegaran.
    if (typeof item === "string") {
      if (item === "otp") return true;
      continue;
    }
    if (!item || typeof item !== "object") continue;

    const { method, timestamp } = item as AmrEntry;
    if (method !== "otp") continue;
    if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) continue;

    // Timestamp masa depan ditolak: jam yang melenceng tak boleh memperpanjang
    // izin tanpa batas.
    const umur = nowSec - timestamp;
    if (umur >= 0 && umur <= maxAgeSec) return true;
  }

  return false;
}

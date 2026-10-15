import type { StorageDriverName } from "./types";

/**
 * Deteksi PASANGAN konfigurasi media yang mustahil benar.
 *
 * Dua sakelar, dua latensi. `STORAGE_DRIVER` dibaca saat RUNTIME; sedangkan
 * `NEXT_PUBLIC_MEDIA_URL` di-INLINE Next saat BUILD — termasuk ke bundel
 * server — dan `.dockerignore` membuang `.env*` dari konteks build, jadi
 * satu-satunya cara mengubahnya adalah REBUILD. Cara paling alami mengubah
 * setelan di Easypanel (sunting tab Environment lalu restart) hanya
 * menggerakkan yang pertama.
 *
 * Akibatnya, pada hari pindah ke R2, pemadaman media total bukan RISIKO
 * kelalaian melainkan HASIL PASTI dari cutover yang dikerjakan "benar" tanpa
 * rebuild: `STORAGE_DRIVER=r2` membuat route `/media/[...path]` menjawab 404
 * untuk SEMUA permintaan (lihat route-nya), sementara seluruh URL yang
 * dirender masih menunjuk `https://<app>/media/...` yang dipanggang ke bundel.
 * Setiap foto, lagu, dan gambar OG padam serentak — tanpa exception, tanpa
 * satu pun entri Sentry, hanya 404 polos yang bahkan ikut ter-cache di CDN.
 *
 * SATU aturan saja, dan itu disengaja. Yang diperiksa hanya kombinasi yang
 * TIDAK MUNGKIN benar: driver bukan `local`, tetapi URL media masih menunjuk
 * route `/media` milik aplikasi ini sendiri — route yang pasti 404 pada driver
 * itu. Kebalikannya (driver `local` dengan URL media di host lain) sengaja
 * TIDAK ditandai: menyajikan volume lewat subdomain CDN atau reverse-proxy
 * terpisah adalah susunan yang sah, dan menolaknya akan memerahkan deployment
 * yang sehat.
 *
 * KENAPA FUNGSI MURNI, DAN KENAPA BUKAN DI `lib/env.ts`: `getMediaBaseUrl()`
 * dipanggil PER-RENDER lewat `getPublicUrl()`. Melempar di sana akan mengubah
 * halaman yang TERDEGRADASI (teks tampil, gambar 404) menjadi halaman MATI
 * (500) bagi setiap tamu dan bagi editor dashboard — bentuk kegagalan yang
 * persis sama dengan insiden DECISIONS #82. Lebih buruk lagi, lemparan itu
 * lazy, jadi container tetap lolos `/api/health` dan Easypanel menilai deploy
 * yang rusak sebagai sehat. Karena itu hasilnya dilaporkan lewat health —
 * tempat yang membuat image tak cocok GAGAL healthcheck dan karena itu tak
 * pernah menerima trafik — bukan lewat lemparan saat render.
 */
export interface MasalahMedia {
  kode: string;
  pesan: string;
}

/** Apakah `mediaBaseUrl` menunjuk route `/media` milik aplikasi ini sendiri? */
function rutenyaMilikSendiri(mediaBaseUrl: string, appUrl: string): boolean {
  try {
    const media = new URL(mediaBaseUrl);
    const app = new URL(appUrl);
    if (media.origin !== app.origin) return false;
    return media.pathname.replace(/\/+$/, "") === "/media";
  } catch {
    // URL tak terbaca (kosong/salah bentuk) bukan urusan pemeriksa ini —
    // `getMediaBaseUrl()` sudah gagal-keras untuk nilai kosong di produksi.
    // Menebak di sini hanya akan menghasilkan health merah yang salah sebab.
    return false;
  }
}

export function periksaPasanganMedia(args: {
  driver: StorageDriverName;
  mediaBaseUrl: string;
  appUrl: string;
}): MasalahMedia | null {
  const { driver, mediaBaseUrl, appUrl } = args;
  if (driver === "local") return null;
  if (!rutenyaMilikSendiri(mediaBaseUrl, appUrl)) return null;

  return {
    kode: "media-url-basi",
    pesan:
      `STORAGE_DRIVER="${driver}" tetapi NEXT_PUBLIC_MEDIA_URL masih menunjuk ` +
      `route /media milik aplikasi ini (${mediaBaseUrl}) — route itu hanya ` +
      `menyajikan driver \`local\` dan akan menjawab 404 untuk semua media. ` +
      `NEXT_PUBLIC_MEDIA_URL dipanggang saat BUILD, jadi mengubahnya di panel ` +
      `lalu restart TIDAK cukup: image ini harus DIBANGUN ULANG dengan ` +
      `build-arg yang baru.`,
  };
}

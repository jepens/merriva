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
    // Bentuk sudah diperiksa `periksaBentukBasis` di atas pemanggil; di sini
    // lemparan hanya berarti `appUrl` yang tak terbaca, dan itu bukan urusan
    // aturan pasangan.
    return false;
  }
}

function masalahBentuk(nilai: string, sebab: string): MasalahMedia {
  return {
    kode: "media-url-tak-sah",
    pesan:
      `NEXT_PUBLIC_MEDIA_URL="${nilai}" ${sebab}. Peramban akan ` +
      `menyelesaikannya RELATIF terhadap halaman undangan — ` +
      `"cdn.merriva.id/inv/a/1600.webp" menjadi ` +
      `"https://merriva.id/cdn.merriva.id/inv/a/1600.webp" — sehingga setiap ` +
      `foto, lagu, dan gambar OG menjawab 404 polos tanpa satu pun exception. ` +
      `Isi dengan URL absolut berskema, mis. https://cdn.merriva.id. Nilai ini ` +
      `dipanggang saat BUILD, jadi memperbaikinya menuntut BANGUN ULANG image.`,
  };
}

/**
 * Aturan BENTUK, berlaku untuk SEMUA driver.
 *
 * Terpisah dari aturan pasangan di bawah karena sebabnya berbeda: basis yang
 * tak bisa menjadi URL absolut merusak `local`, `r2`, dan `supabase` dengan
 * cara yang sama persis — `getPublicUrl()` hanya merangkai string, tak ada
 * driver yang memvalidasi apa pun.
 *
 * Sebelum ini lubangnya terbuka dan ADA TEST YANG MENGUNCINYA sebagai perilaku
 * yang diharapkan ("mediaBaseUrl bukan URL" → null). Alasan yang tertulis saat
 * itu — "nilai kosong sudah punya gerbangnya sendiri di `getMediaBaseUrl()`" —
 * benar untuk KOSONG dan salah untuk SALAH BENTUK: `getMediaBaseUrl()` hanya
 * memeriksa string kosong, jadi `cdn.merriva.id` lolos ke produksi, lolos
 * `/api/health` dengan 200, dan memadamkan seluruh media. Satu dokumen repo ini
 * (`docs/MUSIC-LIBRARY.md`) bahkan sempat menuliskannya persis tanpa skema.
 */
function periksaBentukBasis(mediaBaseUrl: string): MasalahMedia | null {
  // Kosong memang punya gerbangnya sendiri: `getMediaBaseUrl()` gagal-keras di
  // runtime production dan health menerjemahkannya jadi `media-env-invalid`.
  // Di dev, kosong sah.
  if (mediaBaseUrl === "") return null;

  let basis: URL;
  try {
    basis = new URL(mediaBaseUrl);
  } catch {
    return masalahBentuk(mediaBaseUrl, "bukan URL absolut");
  }

  // `new URL("cdn.merriva.id:8080")` TIDAK melempar: titik adalah karakter yang
  // sah di nama skema, jadi ia terbaca sebagai skema `cdn.merriva.id:` dengan
  // path `8080`. Tanpa pemeriksaan protokol, bentuk berport itu lolos persis
  // seperti bentuk tanpa port yang justru tertangkap di atas.
  if (basis.protocol !== "https:" && basis.protocol !== "http:") {
    return masalahBentuk(mediaBaseUrl, `memakai skema \`${basis.protocol}\``);
  }
  return null;
}

export function periksaPasanganMedia(args: {
  driver: StorageDriverName;
  mediaBaseUrl: string;
  appUrl: string;
}): MasalahMedia | null {
  const { driver, mediaBaseUrl, appUrl } = args;

  const bentuk = periksaBentukBasis(mediaBaseUrl);
  if (bentuk) return bentuk;

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

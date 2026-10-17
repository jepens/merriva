import { describe, expect, it } from "vitest";

import { periksaPasanganMedia } from "@/lib/storage/konfigurasi";

/**
 * Pasangan `STORAGE_DRIVER` × `NEXT_PUBLIC_MEDIA_URL`.
 *
 * KENAPA TEST INI ADA: kedua variabel wajib berpindah bersamaan, tetapi
 * mekanika aktivasinya BERBEDA — driver dibaca saat runtime, URL media
 * dipanggang saat build. Cara paling alami mengubah setelan di panel (sunting
 * env lalu restart) hanya menggerakkan yang pertama, dan hasilnya adalah
 * padamnya SELURUH media tanpa satu pun exception: route `/media` menjawab 404
 * untuk driver non-local, sementara URL yang sudah dirender masih menunjuk ke
 * sana.
 *
 * Separuh nilai test ini ada pada blok "sengaja TIDAK ditandai". Pemeriksa yang
 * terlalu rajin akan memerahkan susunan yang sah — volume yang disajikan lewat
 * subdomain CDN atau reverse-proxy terpisah — dan health yang memerah tanpa
 * sebab adalah health yang orang berhenti percayai.
 */

const APP = "https://merriva.id";

describe("ditandai — kombinasi yang mustahil benar", () => {
  it.each(["r2", "supabase"] as const)(
    "driver %s + URL media masih route /media sendiri",
    (driver) => {
      const m = periksaPasanganMedia({
        driver,
        mediaBaseUrl: "https://merriva.id/media",
        appUrl: APP,
      });
      expect(m?.kode).toBe("media-url-basi");
      // Pesannya harus menyebut REBUILD: tanpa itu orang akan mengubah panel,
      // me-restart, melihat health tetap merah, dan menyimpulkan kodenya rusak.
      expect(m?.pesan).toMatch(/BANGUN ULANG|build-arg/i);
    },
  );

  it("slash di ujung tak menyelamatkan — tetap route yang sama", () => {
    expect(
      periksaPasanganMedia({
        driver: "r2",
        mediaBaseUrl: "https://merriva.id/media/",
        appUrl: APP,
      }),
    ).not.toBeNull();
  });

  it("appUrl berslash tetap dikenali sebagai origin yang sama", () => {
    expect(
      periksaPasanganMedia({
        driver: "r2",
        mediaBaseUrl: "https://merriva.id/media",
        appUrl: "https://merriva.id/",
      }),
    ).not.toBeNull();
  });
});

describe("sengaja TIDAK ditandai", () => {
  it("driver local + route /media sendiri — justru susunan yang benar", () => {
    expect(
      periksaPasanganMedia({
        driver: "local",
        mediaBaseUrl: "https://merriva.id/media",
        appUrl: APP,
      }),
    ).toBeNull();
  });

  it("driver r2 + domain CDN terpisah — susunan tujuan kita", () => {
    expect(
      periksaPasanganMedia({
        driver: "r2",
        mediaBaseUrl: "https://cdn.merriva.id",
        appUrl: APP,
      }),
    ).toBeNull();
  });

  it("driver local + host LAIN — reverse-proxy/CDN di depan volume itu SAH", () => {
    // Menolak ini akan memerahkan deployment yang sehat. Pemeriksa yang
    // menuduh terlalu luas lebih berbahaya daripada yang diam: ia melatih
    // orang mengabaikan health.
    expect(
      periksaPasanganMedia({
        driver: "local",
        mediaBaseUrl: "https://cdn.merriva.id",
        appUrl: APP,
      }),
    ).toBeNull();
  });

  it("host sama tetapi path lain — bukan route /media", () => {
    expect(
      periksaPasanganMedia({
        driver: "r2",
        mediaBaseUrl: "https://merriva.id/berkas",
        appUrl: APP,
      }),
    ).toBeNull();
  });

  it("origin berbeda walau path /media", () => {
    expect(
      periksaPasanganMedia({
        driver: "r2",
        mediaBaseUrl: "https://lain.example/media",
        appUrl: APP,
      }),
    ).toBeNull();
  });
});

describe("masukan rusak tak boleh menjatuhkan health", () => {
  it.each([
    ["mediaBaseUrl kosong", "", APP],
    ["appUrl kosong", "https://merriva.id/media", ""],
    ["keduanya kosong", "", ""],
  ])("%s → null, bukan lemparan", (_n, mediaBaseUrl, appUrl) => {
    // KOSONG memang punya gerbangnya sendiri di `getMediaBaseUrl()`, yang
    // gagal-keras di runtime production; health menerjemahkannya menjadi
    // `media-env-invalid`. Menduplikasinya di sini hanya menghasilkan health
    // merah dengan sebab yang salah. Di dev, kosong sah.
    expect(() =>
      periksaPasanganMedia({ driver: "r2", mediaBaseUrl, appUrl }),
    ).not.toThrow();
    expect(
      periksaPasanganMedia({ driver: "r2", mediaBaseUrl, appUrl }),
    ).toBeNull();
  });
});

/**
 * BENTUK basis media — aturan yang dulu TIDAK ADA, dan yang ketiadaannya
 * dikunci test ini sendiri sebagai perilaku yang diharapkan: versi pertama
 * berkas ini menegaskan `"bukan-url"` → `null`, dengan alasan "nilai kosong
 * sudah punya gerbangnya sendiri di `getMediaBaseUrl()`".
 *
 * Alasan itu benar untuk KOSONG dan salah untuk SALAH BENTUK. `getMediaBaseUrl()`
 * hanya memeriksa string kosong, jadi `cdn.merriva.id` lolos ke produksi dan
 * `/api/health` menjawab 200 sementara peramban menyelesaikan nilai itu RELATIF
 * terhadap halaman undangan: `https://merriva.id/cdn.merriva.id/inv/a/1600.webp`.
 * Setiap foto, lagu, dan gambar OG padam serentak — 404 polos, nol exception.
 *
 * Bukan skenario karangan: `docs/MUSIC-LIBRARY.md` menuliskannya persis tanpa
 * skema, dan itu dokumen yang dibuka untuk tugas PERTAMA pasca-cutover R2
 * (mengunggah ulang enam lagu).
 */
describe("bentuk basis media — berlaku untuk SEMUA driver", () => {
  it.each(["r2", "supabase", "local"] as const)(
    "driver %s: tanpa skema ditandai, bukan diabaikan",
    (driver) => {
      const m = periksaPasanganMedia({
        driver,
        mediaBaseUrl: "cdn.merriva.id",
        appUrl: APP,
      });
      expect(m?.kode).toBe("media-url-tak-sah");
      // Pesannya harus menyebut REBUILD: nilainya dipanggang saat build, jadi
      // memperbaikinya di panel lalu restart tidak akan mengubah apa pun.
      expect(m?.pesan).toMatch(/BANGUN ULANG|BUILD/i);
    },
  );

  it("`local` TIDAK kebal — basis rusak memadamkan semua driver sama rata", () => {
    // Aturan bentuk sengaja berjalan SEBELUM short-circuit `local` pada aturan
    // pasangan. `getPublicUrl()` hanya merangkai string; tak ada driver yang
    // memvalidasi apa pun.
    expect(
      periksaPasanganMedia({
        driver: "local",
        mediaBaseUrl: "merriva.id/media",
        appUrl: APP,
      })?.kode,
    ).toBe("media-url-tak-sah");
  });

  it("bentuk berport lolos `new URL` — karena itu protokolnya ikut diperiksa", () => {
    // `new URL("cdn.merriva.id:8080")` TIDAK melempar: titik sah di nama skema,
    // jadi ia terbaca sebagai skema `cdn.merriva.id:` dengan path `8080`.
    // Tanpa pemeriksaan protokol, bentuk ini lolos sementara saudaranya yang
    // tanpa port tertangkap — lubang yang lebih buruk daripada tak memeriksa
    // sama sekali, karena ia tampak sudah dijaga.
    expect(() => new URL("cdn.merriva.id:8080")).not.toThrow();
    expect(
      periksaPasanganMedia({
        driver: "r2",
        mediaBaseUrl: "cdn.merriva.id:8080",
        appUrl: APP,
      })?.kode,
    ).toBe("media-url-tak-sah");
  });

  it.each(["ftp://x.test", "file:///tmp/media", "javascript:alert(1)"])(
    "skema non-HTTP ditolak: %s",
    (nilai) => {
      expect(
        periksaPasanganMedia({
          driver: "r2",
          mediaBaseUrl: nilai,
          appUrl: APP,
        })?.kode,
      ).toBe("media-url-tak-sah");
    },
  );

  it.each([
    ["https — bentuk produksi", "https://cdn.merriva.id"],
    ["http — sah untuk dev lokal", "http://localhost:3000/media"],
    ["berport", "https://cdn.merriva.id:8443"],
  ])("%s tetap lolos", (_n, mediaBaseUrl) => {
    // Pemeriksa yang menolak bentuk sah lebih berbahaya daripada yang diam:
    // ia memerahkan deployment sehat sampai orang berhenti membaca health.
    expect(
      periksaPasanganMedia({ driver: "r2", mediaBaseUrl, appUrl: APP }),
    ).toBeNull();
  });

  it("aturan BENTUK didahulukan atas aturan PASANGAN", () => {
    // Keduanya salah sekaligus. Yang dilaporkan harus bentuknya: pesan
    // "lakukan rebuild dengan URL yang benar" tak berguna bila nilai yang
    // dipakai membangun ulang itu sendiri tak bisa diurai.
    expect(
      periksaPasanganMedia({
        driver: "r2",
        mediaBaseUrl: "merriva.id/media",
        appUrl: APP,
      })?.kode,
    ).toBe("media-url-tak-sah");
  });
});

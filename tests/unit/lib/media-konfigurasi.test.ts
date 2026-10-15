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
    ["mediaBaseUrl bukan URL", "bukan-url", APP],
    ["keduanya kosong", "", ""],
  ])("%s → null, bukan lemparan", (_n, mediaBaseUrl, appUrl) => {
    // Nilai kosong sudah punya gerbangnya sendiri di `getMediaBaseUrl()`.
    // Menebak di sini hanya menghasilkan health merah dengan sebab yang salah.
    expect(() =>
      periksaPasanganMedia({ driver: "r2", mediaBaseUrl, appUrl }),
    ).not.toThrow();
    expect(
      periksaPasanganMedia({ driver: "r2", mediaBaseUrl, appUrl }),
    ).toBeNull();
  });
});

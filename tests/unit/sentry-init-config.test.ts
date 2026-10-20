import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Yang dikunci berkas ini bukan penyaringnya, melainkan bahwa konfigurasi
 * BENAR-BENAR MEMASANGNYA — dan memasangnya pada mode yang membuatnya
 * dipanggil.
 *
 * `tests/unit/lib/sentry-scrub.test.ts` sudah membuktikan `scrubSentryEvent`
 * bekerja. Itu tidak cukup, dan SDK v11 menunjukkan kenapa: ia menjadikan span
 * streaming sebagai default, dan di mode itu `beforeSendTransaction`
 * **no-op** — panduan migrasi resminya menulis itu hitam di atas putih. Jadi
 * penyaring yang sempurna bisa terpasang rapi di konfigurasi, lulus seluruh
 * unit test-nya sendiri, dan tak pernah dipanggil satu kali pun di produksi.
 * Token tamu `?g={token}` lolos ke atribut span tanpa satu test berubah warna.
 *
 * Hal kedua yang dikunci: baseline `dataCollection`. v11 mengganti
 * `sendDefaultPii` dengannya DAN membalik default-nya menjadi lebih permisif —
 * dibiarkan kosong ia mengumpulkan IP, cookie, header, dan badan request.
 * Panduan migrasinya menyuruh menyetelnya eksplisit; test ini yang memastikan
 * perintah itu tidak terlupakan pada bump berikutnya.
 */

const { init, captureRouterTransitionStart } = vi.hoisted(() => ({
  init: vi.fn<(opsi: Record<string, unknown>) => void>(),
  captureRouterTransitionStart: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ init, captureRouterTransitionStart }));

const BERKAS = [
  ["server", "@/sentry.server.config"],
  ["edge", "@/sentry.edge.config"],
  ["klien", "@/instrumentation-client"],
] as const;

/**
 * Muat ulang modul konfigurasi dengan DSN terisi, lalu ambil argumen init.
 *
 * `scrubSentryEvent` ikut diimpor ULANG di sini, bukan di atas berkas:
 * `vi.resetModules()` membuat modul konfigurasi menarik salinan BARU
 * `sentry-scrub`, sehingga pembandingan identitas terhadap impor statis akan
 * selalu gagal — dengan pesan "no visual difference" yang menyesatkan.
 */
async function muat(modul: string): Promise<{
  opsi: Record<string, unknown>;
  scrub: unknown;
}> {
  vi.resetModules();
  init.mockClear();
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://abc@o1.ingest.sentry.io/2");
  await import(modul);
  expect(init).toHaveBeenCalledTimes(1);
  const { scrubSentryEvent } = await import("@/lib/sentry-scrub");
  return { opsi: init.mock.calls[0][0], scrub: scrubSentryEvent };
}

/** Pintasan untuk butir yang hanya memeriksa opsi. */
async function opsiInit(modul: string): Promise<Record<string, unknown>> {
  return (await muat(modul)).opsi;
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe.each(BERKAS)("konfigurasi Sentry — %s", (_nama, modul) => {
  it("memasang scrubSentryEvent di KEDUA kait", async () => {
    const { opsi, scrub } = await muat(modul);
    expect(opsi.beforeSend).toBe(scrub);
    expect(opsi.beforeSendTransaction).toBe(scrub);
  });

  it("traceLifecycle 'static' — tanpa ini beforeSendTransaction no-op di v11", async () => {
    // Inilah baris yang menentukan apakah penyaring di atas pernah dipanggil
    // sama sekali. Menghapusnya tidak memerahkan satu pun test lain.
    expect((await opsiInit(modul)).traceLifecycle).toBe("static");
  });

  it("dataCollection eksplisit, bukan dibiarkan ke default v11", async () => {
    const dc = (await opsiInit(modul)).dataCollection as Record<
      string,
      unknown
    >;
    expect(dc).toBeTruthy();
    // Keempatnya adalah kategori yang default v11 justru MENYALAKAN.
    expect(dc.userInfo).toBe(false); // IP tamu
    expect(dc.cookies).toBe(false); // sesi unggah Momen, auth pemilik
    expect(dc.httpBodies).toEqual([]); // badan Server Action (guestToken)
    expect(dc.urlQueryParams).toBe(false); // `?g={token}`
  });

  it("tanpa DSN, Sentry tidak diinisialisasi sama sekali", async () => {
    // Keadaan produksi HARI INI. Bila ini pecah, build tanpa DSN akan
    // memanggil init dengan `dsn: undefined` dan perilakunya jadi tebakan.
    vi.resetModules();
    init.mockClear();
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    await import(modul);
    expect(init).not.toHaveBeenCalled();
  });
});

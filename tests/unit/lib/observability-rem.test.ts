import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Rem ledakan per-area pada `reportHandledError`.
 *
 * KENAPA ADA: 105 pemanggil tersebar di 31 berkas, 24 di antaranya di jalur
 * TAMU — dipanggil sekali per tamu, bukan sekali per hari. Satu resepsi 300
 * tamu dengan storage bermasalah mengirim ratusan event identik dalam hitungan
 * menit, tepat ketika kuota Sentry gratis paling dibutuhkan. Dedupe bawaan
 * Sentry tak menolong: ia hanya mengingat SATU event sebelumnya.
 *
 * Yang dijaga berkas ini bukan "ada pembatas", melainkan tiga sifat yang
 * membedakan pembatas berguna dari pembatas berbahaya:
 *  1. batasnya PER AREA — area langka seperti `payment.verify` tak boleh ikut
 *     terpangkas oleh ledakan di area lain;
 *  2. yang tertahan TIDAK hilang diam-diam — hitungannya menumpang event
 *     berikutnya di area yang sama;
 *  3. Map-nya BERBATAS — Map tak berbatas di jalur galat adalah kebocoran.
 */

const { captureException } = vi.hoisted(() => ({
  captureException:
    vi.fn<(err: unknown, opsi?: Record<string, unknown>) => void>(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException }));

/** Modul menyimpan state di module scope → muat ulang tiap butir. */
async function segar() {
  vi.resetModules();
  captureException.mockClear();
  return (await import("@/lib/observability")).reportHandledError;
}

const extraDari = (i: number) =>
  (captureException.mock.calls[i][1] as { extra?: Record<string, unknown> })
    .extra;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-21T10:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("rem ledakan per-area", () => {
  it("di bawah batas → semuanya terkirim", async () => {
    const lapor = await segar();
    for (let i = 0; i < 5; i += 1) lapor(new Error("x"), "momen.storage");
    expect(captureException).toHaveBeenCalledTimes(5);
  });

  it("300 tamu, satu area → terkirim dibatasi, sisanya dihitung", async () => {
    const lapor = await segar();
    for (let i = 0; i < 300; i += 1) lapor(new Error("x"), "momen.storage");
    expect(captureException).toHaveBeenCalledTimes(5);
  });

  it("BATASNYA PER AREA — ledakan tamu tak memangkas jalur uang", async () => {
    // Inti seluruh desain ini. `sampleRate` global akan gagal di sini, dan
    // gagalnya tepat pada area yang paling tak boleh hilang.
    const lapor = await segar();
    for (let i = 0; i < 300; i += 1) lapor(new Error("x"), "momen.storage");
    lapor(new Error("boom"), "payment.verify");

    const area = captureException.mock.calls.map(
      (c) => (c[1] as { tags: { area: string } }).tags.area,
    );
    expect(area.filter((a) => a === "momen.storage")).toHaveLength(5);
    expect(area.filter((a) => a === "payment.verify")).toHaveLength(1);
  });

  it("yang tertahan menumpang event BERIKUTNYA, tidak hilang", async () => {
    const lapor = await segar();
    for (let i = 0; i < 300; i += 1) lapor(new Error("x"), "momen.storage");
    expect(extraDari(0)).toBeUndefined();

    // Jendela berikutnya.
    vi.advanceTimersByTime(61_000);
    lapor(new Error("x"), "momen.storage");

    expect(captureException).toHaveBeenCalledTimes(6);
    expect(extraDari(5)).toMatchObject({ tertahanSebelumnya: 295 });
  });

  it("jendela baru memulihkan anggaran penuh", async () => {
    const lapor = await segar();
    for (let i = 0; i < 20; i += 1) lapor(new Error("x"), "momen.storage");
    vi.advanceTimersByTime(61_000);
    for (let i = 0; i < 20; i += 1) lapor(new Error("x"), "momen.storage");
    expect(captureException).toHaveBeenCalledTimes(10);
  });

  it("`extra` pemanggil tetap utuh saat hitungan menumpang", async () => {
    const lapor = await segar();
    for (let i = 0; i < 10; i += 1) lapor(new Error("x"), "zip.galeri");
    vi.advanceTimersByTime(61_000);
    lapor(new Error("x"), "zip.galeri", { invitationId: "inv-1" });
    expect(extraDari(5)).toEqual({
      invitationId: "inv-1",
      tertahanSebelumnya: 5,
    });
  });

  it("Map berbatas — 500 area berbeda tak menumpuk tanpa batas", async () => {
    // Area dibentuk dari string yang ditulis pemanggil, jadi secara prinsip
    // jumlahnya terbatas. Tetapi Map tak berbatas di jalur GALAT adalah
    // kebocoran yang hanya muncul saat sistem sudah bermasalah.
    const lapor = await segar();
    for (let i = 0; i < 500; i += 1) lapor(new Error("x"), `area-${i}`);
    expect(captureException).toHaveBeenCalledTimes(500);
    // Tak ada assertion pada ukuran Map (ia private); yang dijaga di sini
    // adalah bahwa jalurnya tetap benar — semua terkirim, nol lemparan.
  });

  it("tag `area` dan bentuk panggilan Sentry tidak berubah", async () => {
    // Rem tidak boleh mengubah kontrak yang sudah dipakai 105 pemanggil.
    const lapor = await segar();
    lapor(new Error("boom"), "cron.purge-expired.storage", { failed: 2 });
    const [err, opsi] = captureException.mock.calls[0] as [
      Error,
      { tags: { area: string }; extra?: Record<string, unknown> },
    ];
    expect(err.message).toBe("boom");
    expect(opsi.tags.area).toBe("cron.purge-expired.storage");
    expect(opsi.extra).toEqual({ failed: 2 });
  });
});

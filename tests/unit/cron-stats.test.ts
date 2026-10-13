import { describe, expect, it } from "vitest";

import { copy } from "@/lib/copy";
import { fetchCronStatus } from "@/server/cron/status";

/**
 * `cron_runs.stats` yang akhirnya dirender di `/admin` (DECISIONS #74).
 *
 * Kolomnya sudah lama diisi `recordCronRun` tetapi TAK PERNAH ditampilkan, jadi
 * `notified`, `notifyTruncated`, `budgetHabis`, `tanpaTxn`, `cancelFailed`,
 * `warnFailed`, `heldForWarning`, dan `backstop` hanya bisa dibaca lewat SQL.
 * DECISIONS #69 dan #73 mencatatnya sebagai titik buta — dua kali — sebelum
 * ditutup.
 *
 * Yang dijaga di sini adalah sifat yang membuat panel ini tak membusuk: **kunci
 * tanpa label tetap tampil apa adanya**. Statistik baru ditambahkan tiap kali
 * ada fitur cron baru, dan angka yang hilang dari panel karena lupa diberi label
 * adalah justru kegagalan yang panel ini ada untuk mencegah.
 */

const label = copy.admin.overview.cron.statLabel;

describe("label statistik", () => {
  it("memberi label untuk kunci yang ditulis keempat cron hari ini", () => {
    // Daftar ini disalin dari `recordCronRun(...)` di keempat route. Bila ada
    // yang hilang, panel menampilkan nama mentahnya — tetap terbaca, hanya
    // kurang ramah. Test ini menjaga agar yang SUDAH ada tak terhapus.
    const ditulis = [
      // expire-orders
      "scanned",
      "activated",
      "keptPaid",
      "expired",
      "skipped",
      "cancelFailed",
      "tanpaTxn",
      "mudaScanned",
      "mudaActivated",
      "mudaPending",
      "budgetHabis",
      // expire-invitations
      "notified",
      "notifyNoOwner",
      "notifyFailed",
      "notifyTruncated",
      // purge-expired
      "purged",
      "storageFailed",
      "heldForWarning",
      "backstop",
      "warned",
      "warnFinal",
      "warnNoOwner",
      "warnFailed",
    ];
    const tanpaLabel = ditulis.filter((k) => !label[k]);
    expect(tanpaLabel).toEqual([]);
  });

  it("labelnya bahasa Indonesia, bukan nama kunci yang disalin", () => {
    // Menyalin kunci sebagai "label" akan terlihat seperti sudah diberi label
    // padahal tidak — lebih buruk daripada tak memberi label sama sekali.
    for (const [k, v] of Object.entries(label)) {
      expect(v, `label untuk ${k} sama dengan kuncinya`).not.toBe(k);
      expect(v.length).toBeGreaterThan(2);
    }
  });

  it("tak ada label kosong", () => {
    for (const [k, v] of Object.entries(label)) {
      expect(v.trim(), `label ${k} kosong`).not.toBe("");
    }
  });
});

describe("kunci tak dikenal tetap terbaca", () => {
  it("fallback `statLabel[k] ?? k` menghasilkan nama kuncinya", () => {
    // Sifat yang menjaga panel dari pembusukan: statistik yang ditambahkan
    // kelak muncul di panel TANPA perubahan kode, hanya tanpa label ramah.
    const k = "statistikBaruYangBelumAdaLabelnya";
    expect(label[k] ?? k).toBe(k);
  });
});

describe("stats disaring ke angka saja", () => {
  const admin = (stats: unknown) => ({
    from: () => ({
      select: () =>
        Promise.resolve({
          data: [
            {
              name: "expire-orders",
              last_run_at: new Date().toISOString(),
              last_ok_at: null,
              ok: true,
              last_error: null,
              runs: 1,
              failures: 0,
              stats,
            },
          ],
          error: null,
        }),
    }),
  });

  const ambil = async (stats: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await fetchCronStatus(admin(stats) as any);
    return rows.find((r) => r.name === "expire-orders")!.stats;
  };

  it("angka diteruskan, termasuk nol", async () => {
    // Nol BERMAKNA: "0 diaktifkan" berbeda dari "tak ada angkanya".
    expect(await ambil({ activated: 0, scanned: 3 })).toEqual({
      activated: 0,
      scanned: 3,
    });
  });

  it("nilai non-angka DIBUANG, bukan dirender", async () => {
    // Kolomnya `jsonb`, jadi isinya bisa apa pun. Tanpa saringan ini panel admin
    // bisa menampilkan `[object Object]`.
    expect(
      await ambil({ ok: 2, pesan: "halo", nested: { a: 1 }, daftar: [1, 2] }),
    ).toEqual({ ok: 2 });
  });

  it("NaN/Infinity dibuang", async () => {
    expect(
      await ambil({ a: Number.NaN, b: Number.POSITIVE_INFINITY, c: 1 }),
    ).toEqual({
      c: 1,
    });
  });

  it.each([
    ["null", null],
    ["array", [1, 2]],
    ["string", "halo"],
  ])("stats %s → objek kosong, bukan crash", async (_n, v) => {
    expect(await ambil(v)).toEqual({});
  });

  it("baris cron yang tak ada → stats kosong", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await fetchCronStatus(admin({}) as any);
    expect(rows.find((r) => r.name === "purge-expired")!.stats).toEqual({});
  });
});

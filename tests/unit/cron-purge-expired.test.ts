import { describe, expect, it, vi } from "vitest";

import { POST, retentionCutoffIso } from "@/app/api/cron/purge-expired/route";
import type { HasilSapuMusik } from "@/server/cron/music-sweep";

// Hanya untuk blok "langkah sapu musik" di bawah; `retentionCutoffIso` murni.
vi.mock("@/server/cron/auth", () => ({ isAuthorizedCron: () => true }));
vi.mock("@/server/email/notify", () => ({ sendPurgeWarning: vi.fn() }));
const { recordCronRun, reportHandledError, sapuMusikUsang, storage } =
  vi.hoisted(() => ({
    recordCronRun:
      vi.fn<
        (
          name: string,
          ok: boolean,
          stats?: Record<string, unknown>,
          error?: unknown,
        ) => Promise<void>
      >(),
    reportHandledError:
      vi.fn<
        (err: unknown, area: string, extra?: Record<string, unknown>) => void
      >(),
    sapuMusikUsang:
      vi.fn<
        (admin: unknown, storage: unknown, now: Date) => Promise<HasilSapuMusik>
      >(),
    storage: { delete: vi.fn((_p: string) => Promise.resolve()) },
  }));
vi.mock("@/server/cron/record", () => ({ recordCronRun }));
vi.mock("@/lib/observability", () => ({ reportHandledError }));
vi.mock("@/server/cron/music-sweep", () => ({ sapuMusikUsang }));
vi.mock("@/lib/storage", () => ({ getStorage: () => storage }));
// Tak ada undangan untuk diperingatkan/dipurge: yang diuji hanya langkah musik.
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "in", "is", "not", "lt", "order"])
        q[m] = () => q;
      q.limit = () => Promise.resolve({ data: [], error: null });
      return q;
    },
  }),
}));

/**
 * Cutoff retensi (UU PDP §5): purge undangan yang `active_until` lewat 6 bulan.
 * Bug di sini = purge terlalu dini (kehilangan data dalam grace period) atau
 * terlambat (menyimpan data pribadi melebihi kebijakan). Diuji dengan `now`
 * tetap agar deterministik.
 */
describe("retentionCutoffIso — cutoff 6 bulan kalender (UTC)", () => {
  it("mengurangi 6 bulan dari now", () => {
    expect(retentionCutoffIso(new Date("2026-08-11T00:00:00.000Z"))).toBe(
      "2026-02-11T00:00:00.000Z",
    );
  });

  it("menangani underflow tahun (Januari − 6 bln → Juli tahun lalu)", () => {
    expect(retentionCutoffIso(new Date("2026-01-15T12:00:00.000Z"))).toBe(
      "2025-07-15T12:00:00.000Z",
    );
  });

  it("tidak memodifikasi Date input (fungsi murni)", () => {
    const now = new Date("2026-08-11T09:30:00.000Z");
    retentionCutoffIso(now);
    expect(now.toISOString()).toBe("2026-08-11T09:30:00.000Z");
  });
});

describe("POST — langkah sapu musik unggahan (DECISIONS #121)", () => {
  const panggil = () =>
    POST(new Request("http://localhost/api/cron/purge-expired"));

  it("galat penyapu DILAPORKAN tetapi tak menggagalkan run retensi", async () => {
    sapuMusikUsang.mockRejectedValue(new Error("music_uploads: kedip"));

    const res = await panggil();
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, musicSweepFailed: 1 });
    expect(reportHandledError).toHaveBeenCalledWith(
      expect.any(Error),
      "cron.purge-expired.music",
    );
    expect(recordCronRun).toHaveBeenCalledTimes(1);
    const [nama, ok, stats] = recordCronRun.mock.calls[0]!;
    expect(nama).toBe("purge-expired");
    expect(ok).toBe(true);
    expect(stats).toMatchObject({ musicSweepFailed: 1, musicSwept: 0 });
  });

  it("hasil penyapu masuk statistik; objek gagal dihapus ikut dilaporkan", async () => {
    sapuMusikUsang.mockResolvedValue({
      scanned: 7,
      swept: 3,
      failed: 2,
      truncated: true,
    });

    const res = await panggil();
    const body = (await res.json()) as Record<string, unknown>;

    // Driver storage yang SAMA dengan purge dioper ke penyapu.
    expect(sapuMusikUsang.mock.calls[0]![1]).toBe(storage);
    const stats = {
      musicScanned: 7,
      musicSwept: 3,
      musicFailed: 2,
      musicTruncated: 1,
      musicSweepFailed: 0,
    };
    expect(body).toMatchObject({ ok: true, ...stats });
    expect(recordCronRun.mock.calls[0]![2]).toMatchObject(stats);
    expect(reportHandledError).toHaveBeenCalledWith(
      expect.any(Error),
      "cron.purge-expired.music",
      expect.objectContaining({ failed: 2 }),
    );
  });

  it("sapuan mulus tidak melapor apa pun", async () => {
    sapuMusikUsang.mockResolvedValue({
      scanned: 1,
      swept: 1,
      failed: 0,
      truncated: false,
    });

    await panggil();

    expect(reportHandledError).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock service-role client sebelum import modul yang memakainya.
const fakeAdmin = { from: vi.fn(), rpc: vi.fn() };
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => fakeAdmin,
}));

import { getAdminMetrics } from "@/server/admin/metrics";

/**
 * Query invitations dipanggil berurutan (Promise.all mempertahankan urutan
 * array): total, active, converted, new24h, new7d → masing-masing me-resolve
 * `{count}`. Revenue lewat RPC `admin_month_revenue` → me-resolve
 * `{data:[{total,cnt}]}` + merekam `p_since` (batas bulan WIB).
 */
function setup(invCounts: number[], revenue: { total: number; cnt: number }) {
  let i = 0;
  const captured = { since: "" };

  const invBuilder = () => {
    const count = invCounts[i++] ?? 0;
    const b = {
      eq: () => b,
      in: () => b,
      gte: () => b,
      not: () => b,
      then: (res: (v: { count: number }) => unknown) => res({ count }),
    };
    return b;
  };

  fakeAdmin.from.mockImplementation(() => ({ select: () => invBuilder() }));
  fakeAdmin.rpc.mockImplementation((_fn: string, args: { p_since: string }) => {
    captured.since = args.p_since;
    return Promise.resolve({ data: [revenue] });
  });

  return captured;
}

beforeEach(() => {
  fakeAdmin.from.mockReset();
  fakeAdmin.rpc.mockReset();
});

describe("getAdminMetrics", () => {
  it("menghitung konversi & revenue dari hasil query", async () => {
    setup([10, 4, 6, 2, 5], { total: 348_000, cnt: 2 });

    const m = await getAdminMetrics(new Date("2026-07-15T03:00:00Z"));

    expect(m.totalInvitations).toBe(10);
    expect(m.activeInvitations).toBe(4);
    expect(m.convertedInvitations).toBe(6);
    expect(m.newInvitations24h).toBe(2);
    expect(m.newInvitations7d).toBe(5);
    expect(m.conversionRate).toBeCloseTo(0.6, 5);
    expect(m.revenueThisMonthIdr).toBe(348_000);
    expect(m.paidOrdersThisMonth).toBe(2);
  });

  it("konversi = 0 saat belum ada undangan (tanpa divide-by-zero)", async () => {
    setup([0, 0, 0, 0, 0], { total: 0, cnt: 0 });

    const m = await getAdminMetrics(new Date("2026-07-15T03:00:00Z"));

    expect(m.totalInvitations).toBe(0);
    expect(m.conversionRate).toBe(0);
    expect(m.revenueThisMonthIdr).toBe(0);
    expect(m.paidOrdersThisMonth).toBe(0);
  });

  it("revenue bulan berjalan memakai batas bulan WIB (bukan UTC)", async () => {
    // 15 Juli 03:00 UTC = 15 Juli 10:00 WIB → awal bulan WIB = 1 Juli 00:00 WIB
    // = 30 Juni 17:00 UTC.
    const captured = setup([1, 0, 0, 0, 0], { total: 0, cnt: 0 });

    await getAdminMetrics(new Date("2026-07-15T03:00:00Z"));

    expect(captured.since).toBe("2026-06-30T17:00:00.000Z");
  });

  it("awal bulan WIB dekat pergantian bulan menghitung bulan yang benar", async () => {
    // 1 Agustus 02:00 UTC = 1 Agustus 09:00 WIB → awal bulan WIB = 1 Agustus
    // 00:00 WIB = 31 Juli 17:00 UTC (bukan Juli awal).
    const captured = setup([1, 0, 0, 0, 0], { total: 0, cnt: 0 });

    await getAdminMetrics(new Date("2026-08-01T02:00:00Z"));

    expect(captured.since).toBe("2026-07-31T17:00:00.000Z");
  });
});

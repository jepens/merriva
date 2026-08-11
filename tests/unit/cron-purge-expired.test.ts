import { describe, expect, it } from "vitest";

import { retentionCutoffIso } from "@/app/api/cron/purge-expired/route";

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

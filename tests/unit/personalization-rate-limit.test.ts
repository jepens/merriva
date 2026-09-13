import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Rem jaringan personalisasi `?g=` (`viewGuestByTokenAction`) WAJIB di-scope per
 * undangan (AUDIT-2026-09-04 PER-3). Tanpa scope, semua tamu di WiFi venue yang
 * sama berbagi SATU bucket 300/menit lintas SEMUA undangan: resepsi ramai
 * membuat tamu acara lain di jaringan itu kehilangan sapaan personal.
 *
 * Memakai limiter & keying ASLI; `next/headers` palsu hanya menyuplai alamat.
 */

vi.mock("next/headers", () => ({
  headers: () =>
    Promise.resolve(new Headers({ "cf-connecting-ip": "203.0.113.7" })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = () =>
        Promise.resolve({
          data:
            table === "invitations" ? { id: "inv-1", status: "active" } : null,
          error: null,
        });
      return chain;
    },
  }),
}));

import { __resetRateLimit } from "@/lib/rate-limit";
import { viewGuestByTokenAction } from "@/server/actions/personalization";

const TOKEN = "tok-0123456789";
const VIEW_LIMIT = 300;

beforeEach(() => {
  __resetRateLimit();
});

describe("viewGuestByTokenAction — rem jaringan per undangan", () => {
  it("plafon per undangan ditegakkan (slug ter-normalisasi berbagi bucket)", async () => {
    for (let i = 0; i < VIEW_LIMIT; i += 1) {
      const slug = i % 2 === 0 ? "andi-sinta" : " Andi-Sinta ";
      expect((await viewGuestByTokenAction(slug, TOKEN)).status).toBe("none");
    }
    expect(await viewGuestByTokenAction("andi-sinta", TOKEN)).toEqual({
      status: "rate",
    });
  });

  it("undangan LAIN di jaringan yang sama tidak ikut terkunci", async () => {
    for (let i = 0; i < VIEW_LIMIT + 1; i += 1) {
      await viewGuestByTokenAction("andi-sinta", TOKEN);
    }
    expect((await viewGuestByTokenAction("budi-rina", TOKEN)).status).not.toBe(
      "rate",
    );
  });
});

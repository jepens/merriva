import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Gerbang identitas pelaku usaha di checkout (PP 80/2019, Permendag 31/2020).
 *
 * KENAPA TEST INI ADA: selama `copy.marketing.legal.merchant` kosong, halaman
 * legal menanganinya dengan ANGGUN — field kosong tak dirender, jadi `/syarat`
 * dan `/refund` tetap terbaca benar, hanya tanpa identitas siapa pun.
 * Keanggunan itulah bahayanya: tak ada galat, tak ada bagian yang rusak, tak
 * ada satu pun tanda bahwa sesuatu yang diwajibkan hukum sedang hilang.
 *
 * Yang dijaga: (1) di produksi, tombol bayar MATI selama identitas belum ada —
 * lebih baik begitu daripada menerima uang lalu akun merchant ditangguhkan
 * aggregator; (2) di dev & test gerbangnya TIDAK menghalangi, supaya alur
 * pembayaran tetap bisa ditelusuri; (3) kelalaiannya DILAPORKAN, bukan hanya
 * ditolak diam-diam.
 */

const { reportHandledError } = vi.hoisted(() => ({
  reportHandledError: vi.fn(),
}));
vi.mock("@/lib/observability", () => ({ reportHandledError }));

const { merchantIdentityReady } = vi.hoisted(() => ({
  merchantIdentityReady: vi.fn(() => false),
}));
vi.mock("@/lib/merchant", () => ({ merchantIdentityReady }));

const { serverRef } = vi.hoisted(() => ({
  serverRef: { current: null as never },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => Promise.resolve(serverRef.current),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => {
    throw new Error("admin client tak boleh tersentuh saat gerbang menutup");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createCheckoutAction } from "@/server/actions/checkout";

const INV = "44444444-4444-4444-8444-444444444444";

function makeClient() {
  const from = () => {
    const c: Record<string, unknown> = {};
    c.select = () => c;
    c.eq = () => c;
    c.maybeSingle = () => Promise.resolve({ data: null, error: null });
    return c;
  };
  return {
    from: vi.fn(from),
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  merchantIdentityReady.mockReturnValue(false);
  serverRef.current = makeClient() as never;
});

describe("produksi tanpa identitas pelaku usaha", () => {
  it("menolak checkout dan memberi jalan keluar, bukan 'coba lagi'", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const res = await createCheckoutAction(INV, "premium");

    expect(res.status).toBe("error");
    if (res.status !== "error") return;
    // Pembeli tak bisa memperbaikinya sendiri; pesannya harus menunjukkan jalan.
    expect(res.message).toMatch(/halo@merriva\.id/);
  });

  it("MELAPORKAN kelalaiannya — bukan menolak diam-diam", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await createCheckoutAction(INV, "premium");

    expect(reportHandledError).toHaveBeenCalledTimes(1);
    expect(reportHandledError.mock.calls[0]?.[1]).toBe(
      "checkout.merchant-identity",
    );
  });

  it("tak menyentuh database sama sekali", async () => {
    // Gerbang berdiri SEBELUM order dibuat: tak boleh ada baris `orders`
    // setengah jadi untuk pembayaran yang memang tak boleh terjadi.
    vi.stubEnv("NODE_ENV", "production");
    const client = makeClient();
    serverRef.current = client as never;

    await createCheckoutAction(INV, "premium");

    expect(client.from).not.toHaveBeenCalled();
  });
});

describe("gerbang terbuka", () => {
  it("identitas lengkap → lanjut (gagal belakangan karena undangan tak ada)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    merchantIdentityReady.mockReturnValue(true);

    const res = await createCheckoutAction(INV, "premium");

    // Gagalnya karena undangan tiruan tak ditemukan — BUKAN karena gerbang:
    // galat itu tak membawa pesan sama sekali.
    expect(res.status).toBe("error");
    if (res.status === "error") {
      expect(res.message ?? "").not.toMatch(/halo@merriva\.id/);
    }
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("di luar produksi TIDAK menghalangi, walau identitas kosong", async () => {
    // Alur pembayaran harus tetap bisa ditelusuri di dev & staging.
    vi.stubEnv("NODE_ENV", "development");

    await createCheckoutAction(INV, "premium");

    expect(reportHandledError).not.toHaveBeenCalled();
  });
});

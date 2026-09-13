import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Jalur aktivasi OTORITATIF KEDUA add-on Album Momen (AUDIT-2026-09-04 KUA-2b).
 *
 * Invarian yang dijaga:
 *  - poll SAJA tak pernah cukup: aktivasi hanya terjadi lewat inti bersama
 *    `verifyAndActivate` (yang memanggil `transactiondetail` OTORITATIF);
 *  - hasil verifikasi "belum lunas" / transien TIDAK PERNAH mengaktifkan;
 *  - album yang sudah ada = kondisi berhenti (tak memanggil Pakasir lagi);
 *  - bukan pemilik → tak ada rekonsiliasi sama sekali;
 *  - kuitansi hanya pada transisi `activated`, bukan `already_paid`.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/request-ip", () => ({
  checkClientRateLimit: () =>
    Promise.resolve({ ok: true, remaining: 9, retryAfterMs: 0 }),
}));

const { verifyAndActivate, notifyOrderPaid, findLatestMomenOrder } = vi.hoisted(
  () => ({
    verifyAndActivate: vi.fn(),
    notifyOrderPaid: vi.fn(() => Promise.resolve()),
    findLatestMomenOrder: vi.fn(),
  }),
);
vi.mock("@/server/payment/reconcile", () => ({ verifyAndActivate }));
vi.mock("@/server/email/notify", () => ({ notifyOrderPaid }));
vi.mock("@/server/momen/orders", () => ({ findLatestMomenOrder }));

const { refs } = vi.hoisted(() => ({
  refs: { server: null as unknown, admin: null as unknown },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => Promise.resolve(refs.server),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => refs.admin,
}));

import { checkMomenPaymentStatusAction } from "@/server/actions/momen-payment-status";

const INV = "44444444-4444-4444-8444-444444444444";
const ALBUM = "11111111-1111-4111-8111-111111111111";

/** Klien RLS palsu: `inv` null = bukan pemilik / tak ada baris. */
function serverClient(inv: unknown) {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.maybeSingle = () => Promise.resolve({ data: inv, error: null });
  return {
    from: () => chain,
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
  };
}

/** Klien admin palsu: hanya dipakai untuk membaca `momen_albums`. */
function adminClient(album: unknown) {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.maybeSingle = () => Promise.resolve({ data: album, error: null });
  return { from: () => chain };
}

const PENDING_ORDER = {
  orderCode: "MRV-1",
  amountIdr: 199000,
  status: "pending",
  packageName: "Momen 50",
};

beforeEach(() => {
  vi.clearAllMocks();
  refs.server = serverClient({ id: INV, slug: "andi-sinta" });
  refs.admin = adminClient(null);
  findLatestMomenOrder.mockResolvedValue(PENDING_ORDER);
});

describe("checkMomenPaymentStatusAction — kondisi berhenti", () => {
  it("album sudah ada → active, TIDAK memanggil Pakasir lagi", async () => {
    refs.admin = adminClient({ id: ALBUM });

    const res = await checkMomenPaymentStatusAction(INV);

    expect(res).toEqual({ status: "active" });
    expect(verifyAndActivate).not.toHaveBeenCalled();
  });

  it("bukan pemilik (RLS 0 baris) → error, tanpa rekonsiliasi", async () => {
    refs.server = serverClient(null);

    const res = await checkMomenPaymentStatusAction(INV);

    expect(res).toEqual({ status: "error" });
    expect(verifyAndActivate).not.toHaveBeenCalled();
    expect(findLatestMomenOrder).not.toHaveBeenCalled();
  });

  it("tak ada order add-on → none", async () => {
    findLatestMomenOrder.mockResolvedValue(null);

    expect(await checkMomenPaymentStatusAction(INV)).toEqual({
      status: "none",
    });
    expect(verifyAndActivate).not.toHaveBeenCalled();
  });

  it("order kedaluwarsa → expired, tanpa rekonsiliasi", async () => {
    findLatestMomenOrder.mockResolvedValue({
      ...PENDING_ORDER,
      status: "expired",
    });

    expect(await checkMomenPaymentStatusAction(INV)).toEqual({
      status: "expired",
    });
    expect(verifyAndActivate).not.toHaveBeenCalled();
  });

  it("order PAID tetapi album tak ada → review (anomali, bukan aktivasi ulang)", async () => {
    findLatestMomenOrder.mockResolvedValue({
      ...PENDING_ORDER,
      status: "paid",
    });

    expect(await checkMomenPaymentStatusAction(INV)).toEqual({
      status: "review",
    });
    expect(verifyAndActivate).not.toHaveBeenCalled();
  });
});

describe("checkMomenPaymentStatusAction — verifikasi otoritatif", () => {
  it("API belum konfirmasi lunas → pending, TIDAK aktif", async () => {
    verifyAndActivate.mockResolvedValue({ kind: "not_confirmed" });

    expect(await checkMomenPaymentStatusAction(INV)).toEqual({
      status: "pending",
    });
    expect(notifyOrderPaid).not.toHaveBeenCalled();
  });

  it("amount tak cocok → error, TIDAK aktif", async () => {
    verifyAndActivate.mockResolvedValue({ kind: "mismatch" });

    expect(await checkMomenPaymentStatusAction(INV)).toEqual({
      status: "error",
    });
    expect(notifyOrderPaid).not.toHaveBeenCalled();
  });

  it.each(["verify_error", "rpc_error"])(
    "kegagalan transien (%s) → pending (fail-closed, klien poll lagi)",
    async (kind) => {
      verifyAndActivate.mockResolvedValue({ kind });

      expect(await checkMomenPaymentStatusAction(INV)).toEqual({
        status: "pending",
      });
      expect(notifyOrderPaid).not.toHaveBeenCalled();
    },
  );

  it("undangan ditangguhkan admin (held) → review, tak aktif diam-diam", async () => {
    verifyAndActivate.mockResolvedValue({
      kind: "ok",
      result: "held",
      slug: "andi-sinta",
    });

    expect(await checkMomenPaymentStatusAction(INV)).toEqual({
      status: "review",
    });
  });

  it("terverifikasi lunas → active + kuitansi add-on dikirim sekali", async () => {
    verifyAndActivate.mockResolvedValue({
      kind: "ok",
      result: "activated",
      slug: "andi-sinta",
    });

    expect(await checkMomenPaymentStatusAction(INV)).toEqual({
      status: "active",
    });
    // Order code diteruskan apa adanya; nominal dari DB, bukan dari klien.
    expect(verifyAndActivate).toHaveBeenCalledWith(expect.anything(), {
      order_code: "MRV-1",
      amount_idr: 199000,
    });
    expect(notifyOrderPaid).toHaveBeenCalledTimes(1);
    expect(notifyOrderPaid).toHaveBeenCalledWith(expect.anything(), "MRV-1");
  });

  it("already_paid tanpa album → review, dan TIDAK mengirim kuitansi lagi", async () => {
    verifyAndActivate.mockResolvedValue({
      kind: "ok",
      result: "already_paid",
      slug: "andi-sinta",
    });

    expect(await checkMomenPaymentStatusAction(INV)).toEqual({
      status: "review",
    });
    expect(notifyOrderPaid).not.toHaveBeenCalled();
  });
});

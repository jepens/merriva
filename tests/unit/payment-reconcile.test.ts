import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PaymentVerification } from "@/lib/payment/types";

// Mock gateway: verifikasi OTORITATIF disuntik agar `verifyAndActivate` teruji
// tanpa jaringan. `vi.hoisted` agar fn tersedia di dalam factory `vi.mock`.
const { verifyTransaction } = vi.hoisted(() => ({
  verifyTransaction: vi.fn(),
}));
vi.mock("@/lib/payment", () => ({
  getPaymentGateway: () => ({
    verifyTransaction,
    createPaymentLink: () => "",
  }),
}));

import { verifyAndActivate } from "@/server/payment/reconcile";

const ORDER = { order_code: "MRV-8F3K2", amount_idr: 99000 };

const paid: PaymentVerification = {
  orderCode: "MRV-8F3K2",
  amountIdr: 99000,
  status: "paid",
  paymentMethod: "qris",
  paidAt: "2026-07-29T08:07:02.819+07:00",
};

/** Admin palsu: rpc mengembalikan {data, error} yang ditentukan test. */
function fakeAdmin(rpcResult: { data: unknown; error: unknown }) {
  // Deklarasikan param (fn, args) agar `rpc.mock.calls` bertipe tuple untuk asersi.
  const rpc = vi.fn((_fn: string, _args: unknown) =>
    Promise.resolve(rpcResult),
  );
  // Cast: hanya `.rpc` yang dipakai `verifyAndActivate`.
  return {
    admin: { rpc } as unknown as Parameters<typeof verifyAndActivate>[0],
    rpc,
  };
}

beforeEach(() => {
  verifyTransaction.mockReset();
});

describe("verifyAndActivate — fail-closed sebelum aktivasi", () => {
  it("verifyTransaction throw (jaringan/HTTP) → verify_error, RPC tak dipanggil", async () => {
    verifyTransaction.mockRejectedValue(new Error("HTTP 503"));
    const { admin, rpc } = fakeAdmin({ data: null, error: null });

    const out = await verifyAndActivate(admin, ORDER);

    expect(out).toEqual({ kind: "verify_error" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("API belum konfirmasi lunas → not_confirmed, RPC tak dipanggil", async () => {
    verifyTransaction.mockResolvedValue({ ...paid, status: "pending" });
    const { admin, rpc } = fakeAdmin({ data: null, error: null });

    const out = await verifyAndActivate(admin, ORDER);

    expect(out).toEqual({ kind: "not_confirmed" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("amount OTORITATIF tak cocok → mismatch, RPC tak dipanggil", async () => {
    verifyTransaction.mockResolvedValue({ ...paid, amountIdr: 88000 });
    const { admin, rpc } = fakeAdmin({ data: null, error: null });

    const out = await verifyAndActivate(admin, ORDER);

    expect(out).toEqual({ kind: "mismatch" });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("verifyAndActivate — aktivasi terverifikasi", () => {
  it("lunas + cocok → RPC dipanggil dengan field OTORITATIF; result diteruskan", async () => {
    verifyTransaction.mockResolvedValue(paid);
    const { admin, rpc } = fakeAdmin({
      data: [{ result: "activated", slug: "andi-sinta" }],
      error: null,
    });

    const out = await verifyAndActivate(admin, ORDER);

    expect(out).toEqual({
      kind: "ok",
      result: "activated",
      slug: "andi-sinta",
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe("activate_paid_order");
    // amount & metode & waktu bayar HANYA dari sumber OTORITATIF.
    expect(args).toMatchObject({
      p_order_code: "MRV-8F3K2",
      p_amount: 99000,
      p_payment_method: "qris",
      p_paid_at: "2026-07-29T08:07:02.819+07:00",
    });
  });

  it("tanpa rawOverride → p_raw menyimpan respons transactiondetail (source status_poll)", async () => {
    verifyTransaction.mockResolvedValue(paid);
    const { admin, rpc } = fakeAdmin({
      data: [{ result: "activated", slug: "x" }],
      error: null,
    });

    await verifyAndActivate(admin, ORDER);

    const [, args] = rpc.mock.calls[0];
    expect((args as { p_raw: unknown }).p_raw).toMatchObject({
      source: "status_poll",
      transaction: { orderCode: "MRV-8F3K2", status: "paid" },
    });
  });

  it("dengan rawOverride (payload webhook) → p_raw = override", async () => {
    verifyTransaction.mockResolvedValue(paid);
    const { admin, rpc } = fakeAdmin({
      data: [{ result: "activated", slug: "x" }],
      error: null,
    });
    const webhookPayload = { order_id: "MRV-8F3K2", status: "completed" };

    await verifyAndActivate(admin, ORDER, webhookPayload);

    const [, args] = rpc.mock.calls[0];
    expect((args as { p_raw: unknown }).p_raw).toEqual(webhookPayload);
  });

  it.each([["already_paid"], ["held"], ["invalid"], ["not_found"]] as const)(
    "meneruskan result RPC '%s'",
    async (result) => {
      verifyTransaction.mockResolvedValue(paid);
      const { admin } = fakeAdmin({
        data: [{ result, slug: null }],
        error: null,
      });

      const out = await verifyAndActivate(admin, ORDER);

      expect(out).toEqual({ kind: "ok", result, slug: null });
    },
  );

  it("RPC error → rpc_error (transien)", async () => {
    verifyTransaction.mockResolvedValue(paid);
    const { admin } = fakeAdmin({ data: null, error: { message: "boom" } });

    const out = await verifyAndActivate(admin, ORDER);

    expect(out).toEqual({ kind: "rpc_error" });
  });

  it("RPC tak mengembalikan baris (bentuk tak dikenal) → rpc_error", async () => {
    verifyTransaction.mockResolvedValue(paid);
    const { admin } = fakeAdmin({ data: [], error: null });

    const out = await verifyAndActivate(admin, ORDER);

    expect(out).toEqual({ kind: "rpc_error" });
  });
});

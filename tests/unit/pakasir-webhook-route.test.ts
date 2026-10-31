import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route webhook Pakasir di masa peralihan ke BinderPay (DECISIONS #102).
 * Saklar `getPaymentGateway` berlaku GLOBAL, jadi verifikasi route ini ikut
 * bertanya ke BinderPay begitu `BINDERPAY_PARTNER_ID` terisi. Yang dijaga:
 *   - `txn_id` yang diverifikasi HANYA dari baris order. Query BinderPay
 *     menggemakan pasangan rujukan apa pun, jadi `txn_id` pilihan pemanggil
 *     (payload) bisa meminjam transaksi lunas milik order LAIN;
 *   - sesudah peralihan, webhook Pakasir tak diverifikasi sama sekali — ia
 *     dilaporkan untuk ditangani manual, bukan di-ack senyap "belum lunas".
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/request-ip", () => ({
  checkClientRateLimit: vi.fn(async () => ({ ok: true })),
}));

const { refs, verifyAndActivate, reportHandledError } = vi.hoisted(() => ({
  refs: { order: null as unknown, lookups: 0 },
  verifyAndActivate: vi.fn(
    async (_admin: unknown, _order: unknown, _raw: unknown) =>
      ({ kind: "not_confirmed" }) as unknown,
  ),
  reportHandledError: vi.fn((_e: unknown, _area: string, _x?: unknown) => {}),
}));

vi.mock("@/server/payment/reconcile", () => ({ verifyAndActivate }));
vi.mock("@/server/email/notify", () => ({ notifyOrderPaid: vi.fn() }));
vi.mock("@/lib/observability", () => ({ reportHandledError }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = async () => {
        refs.lookups += 1;
        return { data: refs.order, error: null };
      };
      return chain;
    },
  }),
}));

import { POST } from "@/app/api/webhooks/pakasir/route";

const RAHASIA = "rahasia-webhook";

const webhook = (body: unknown) =>
  new Request("https://merriva.id/api/webhooks/pakasir", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Secret": RAHASIA },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.stubEnv("PAKASIR_WEBHOOK_SECRET", RAHASIA);
  vi.stubEnv("BINDERPAY_PARTNER_ID", "");
  refs.order = null;
  refs.lookups = 0;
  verifyAndActivate.mockClear();
  reportHandledError.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("txn_id yang diverifikasi", () => {
  it("order TANPA txn_id: payload membawa txn_id lain → yang diverifikasi tetap null", async () => {
    refs.order = {
      id: "o1",
      order_code: "MRV-BARU01",
      amount_idr: 99000,
      status: "pending",
      txn_id: null,
    };
    await POST(
      webhook({
        order_id: "MRV-BARU01",
        amount: 99000,
        txn_id: "bp-kontrak-lunas-milik-order-lain",
      }),
    );
    expect(verifyAndActivate).toHaveBeenCalledTimes(1);
    expect(verifyAndActivate.mock.calls[0][1]).toEqual({
      order_code: "MRV-BARU01",
      amount_idr: 99000,
      txn_id: null,
    });
  });
});

describe("sesudah peralihan ke BinderPay", () => {
  it("webhook Pakasir yang sah → 200 tanpa verifikasi, tanpa lookup, DILAPORKAN", async () => {
    vi.stubEnv("BINDERPAY_PARTNER_ID", "BP584400");
    refs.order = {
      id: "o1",
      order_code: "MRV-LAMA01",
      amount_idr: 99000,
      status: "pending",
      txn_id: "pakasir-txn",
    };

    const res = await POST(
      webhook({ order_id: "MRV-LAMA01", amount: 99000, txn_id: "pakasir-txn" }),
    );

    expect(res.status).toBe(200);
    expect(verifyAndActivate).not.toHaveBeenCalled();
    expect(refs.lookups).toBe(0);
    expect(reportHandledError.mock.calls[0][1]).toBe(
      "payment.webhook.pakasir-pasca-peralihan",
    );
    expect(reportHandledError.mock.calls[0][2]).toEqual({
      orderCode: "MRV-LAMA01",
    });
  });

  it("X-Secret salah tetap 401 — laporan hanya untuk pemanggil yang sah", async () => {
    vi.stubEnv("BINDERPAY_PARTNER_ID", "BP584400");
    const res = await POST(
      new Request("https://merriva.id/api/webhooks/pakasir", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Secret": "salah" },
        body: JSON.stringify({ order_id: "MRV-LAMA01", amount: 99000 }),
      }),
    );
    expect(res.status).toBe(401);
    expect(reportHandledError).not.toHaveBeenCalled();
  });
});

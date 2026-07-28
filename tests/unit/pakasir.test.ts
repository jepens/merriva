import { describe, expect, it } from "vitest";

import {
  buildPakasirPaymentUrl,
  mapPakasirStatus,
  parseTransactionDetail,
} from "@/lib/payment/pakasir";
import { pakasirWebhookSchema } from "@/lib/payment/webhook";

// Contoh respons transactiondetail (dok pakasir.com/p/docs).
const detail = (over: Record<string, unknown> = {}) => ({
  transaction: {
    amount: 99000,
    order_id: "MRV-8F3K2",
    project: "merriva",
    status: "completed",
    payment_method: "qris",
    completed_at: "2026-07-29T08:07:02.819+07:00",
    ...over,
  },
});

describe("buildPakasirPaymentUrl", () => {
  it("membangun URL payment link dengan order_id & redirect ter-encode", () => {
    const url = buildPakasirPaymentUrl("merriva", {
      orderCode: "MRV-8F3K2",
      amountIdr: 99000,
      redirectUrl: "https://merriva.id/dashboard?status=ok",
    });

    expect(url).toContain("https://app.pakasir.com/pay/merriva/99000?");
    expect(url).toContain("order_id=MRV-8F3K2");
    // redirect harus di-URL-encode
    expect(url).toContain(
      "redirect=https%3A%2F%2Fmerriva.id%2Fdashboard%3Fstatus%3Dok",
    );
    expect(url).not.toContain("qris_only");
  });

  it("menambahkan qris_only=1 bila diminta", () => {
    const url = buildPakasirPaymentUrl("merriva", {
      orderCode: "MRV-ABCDE",
      amountIdr: 199000,
      redirectUrl: "https://merriva.id/ok",
      qrisOnly: true,
    });

    expect(url).toContain("qris_only=1");
    expect(url).toContain("/pay/merriva/199000?");
  });
});

describe("mapPakasirStatus", () => {
  it("hanya 'completed' → paid; sisanya → pending (fail-closed)", () => {
    expect(mapPakasirStatus("completed")).toBe("paid");
    expect(mapPakasirStatus("pending")).toBe("pending");
    expect(mapPakasirStatus("failed")).toBe("pending");
    expect(mapPakasirStatus(undefined)).toBe("pending");
    expect(mapPakasirStatus(null)).toBe("pending");
    expect(mapPakasirStatus("COMPLETED")).toBe("pending"); // case-sensitive
  });
});

describe("parseTransactionDetail", () => {
  it("respons lunas → status paid + field ter-ekstrak", () => {
    const v = parseTransactionDetail(detail());
    expect(v).toEqual({
      orderCode: "MRV-8F3K2",
      amountIdr: 99000,
      status: "paid",
      paymentMethod: "qris",
      paidAt: "2026-07-29T08:07:02.819+07:00",
    });
  });

  it("status belum lunas → status pending (tak mengaktifkan)", () => {
    expect(parseTransactionDetail(detail({ status: "pending" }))?.status).toBe(
      "pending",
    );
  });

  it("bentuk tak dikenal → null (gagal-verifikasi/fail-closed)", () => {
    expect(parseTransactionDetail(null)).toBeNull();
    expect(parseTransactionDetail({})).toBeNull();
    expect(parseTransactionDetail({ transaction: {} })).toBeNull(); // tanpa order_id/amount
    expect(
      parseTransactionDetail({
        transaction: { order_id: "X", amount: "99000" },
      }),
    ).toBeNull(); // amount bukan number
  });
});

describe("pakasirWebhookSchema", () => {
  const valid = {
    amount: 99000,
    order_id: "MRV-8F3K2",
    project: "merriva",
    status: "completed",
    payment_method: "qris",
    completed_at: "2026-07-29T08:07:02.819+07:00",
  };

  it("menerima payload valid", () => {
    expect(pakasirWebhookSchema.safeParse(valid).success).toBe(true);
  });

  it("menolak amount non-integer / non-number & field wajib hilang", () => {
    expect(
      pakasirWebhookSchema.safeParse({ ...valid, amount: "99000" }).success,
    ).toBe(false);
    expect(
      pakasirWebhookSchema.safeParse({ ...valid, amount: 99000.5 }).success,
    ).toBe(false);
    const { order_id: _drop, ...noOrder } = valid;
    expect(pakasirWebhookSchema.safeParse(noOrder).success).toBe(false);
  });
});

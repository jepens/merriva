import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildPakasirPaymentUrl,
  mapPakasirStatus,
  PakasirGateway,
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

describe("PakasirGateway.cancelTransaction", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("melempar bila api_key belum di-set (tak memanggil jaringan)", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const gw = new PakasirGateway("merriva"); // tanpa api_key
    await expect(gw.cancelTransaction("MRV-8F3K2", 99000)).rejects.toThrow(
      /PAKASIR_API_KEY/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POST /api/transactioncancel dgn body {project,order_id,amount,api_key}; sukses saat 2xx", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
    const gw = new PakasirGateway("merriva", "secret-key");

    await expect(
      gw.cancelTransaction("MRV-8F3K2", 99000),
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://app.pakasir.com/api/transactioncancel");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      project: "merriva",
      order_id: "MRV-8F3K2",
      amount: 99000,
      api_key: "secret-key",
    });
  });

  it("melempar saat non-OK; pesan error TIDAK membocorkan api_key", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("gagal", { status: 400 }),
    );
    const gw = new PakasirGateway("merriva", "secret-key");

    let message = "";
    try {
      await gw.cancelTransaction("MRV-8F3K2", 99000);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("HTTP 400");
    expect(message).not.toContain("secret-key");
  });
});

describe("PakasirGateway.simulatePayment (sandbox, uji-only)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("DILARANG di production → melempar tanpa memanggil jaringan", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const gw = new PakasirGateway("merriva", "secret-key");
    await expect(gw.simulatePayment("MRV-8F3K2", 99000)).rejects.toThrow(
      /production/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POST /api/paymentsimulation dgn body lengkap; sukses saat 2xx", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
    const gw = new PakasirGateway("merriva", "secret-key");

    await expect(
      gw.simulatePayment("MRV-8F3K2", 99000),
    ).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://app.pakasir.com/api/paymentsimulation");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      project: "merriva",
      order_id: "MRV-8F3K2",
      amount: 99000,
      api_key: "secret-key",
    });
  });

  it("melempar saat non-OK; pesan TIDAK membocorkan api_key", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("gagal", { status: 500 }),
    );
    const gw = new PakasirGateway("merriva", "secret-key");

    let message = "";
    try {
      await gw.simulatePayment("MRV-8F3K2", 99000);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("HTTP 500");
    expect(message).not.toContain("secret-key");
  });
});

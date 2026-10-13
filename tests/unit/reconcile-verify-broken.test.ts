import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `verifyAndActivate`: membedakan TRANSIEN dari KONTRAK PUTUS, dan melaporkan
 * `mismatch` (AUDIT-2026-10-13, DECISIONS #73).
 *
 * Dua kegagalan yang dulu menjadi satu `verify_error`:
 *  - "jaringan kedip / 429 / 5xx" — sembuh sendiri, biarkan dicoba lagi;
 *  - "kontrak API putus" (401/400/404/bentuk tak dikenal) — TIDAK akan sembuh,
 *    dan menyatukannya membuat yang parah tenggelam di antara yang biasa.
 *
 * Itu risiko nyata, bukan teori: `transaction-status` v2 TIDAK TERDOKUMENTASI,
 * jadi bila Pakasir mengubah atau menghapusnya, laporan inilah satu-satunya
 * yang akan memberi tahu kita — dan poller berhenti berputar sia-sia.
 *
 * `mismatch` juga dulu senyap di ketiga pemanggil, padahal artinya pelanggan
 * kemungkinan SUDAH membayar nominal yang salah (jebakan `find-or-create`
 * Pakasir v2) dan satu-satunya jalan keluarnya manual.
 */

const { verifyTransaction } = vi.hoisted(() => ({
  verifyTransaction: vi.fn(),
}));
vi.mock("@/lib/payment", () => ({
  getPaymentGateway: () => ({ verifyTransaction }),
}));

const { reportHandledError } = vi.hoisted(() => ({
  reportHandledError: vi.fn(),
}));
vi.mock("@/lib/observability", () => ({ reportHandledError }));

import { PakasirError } from "@/lib/payment/pakasir";
import { verifyAndActivate } from "@/server/payment/reconcile";

const ORDER = { order_code: "MRV-8F3K2Q", amount_idr: 99000, txn_id: "abc" };

const admin = {
  rpc: vi.fn(async () => ({
    data: [{ result: "activated", slug: "andi-sinta" }],
    error: null,
  })),
};

const jalankan = () =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  verifyAndActivate(admin as any, ORDER);

const laporan = () => reportHandledError.mock.calls;

beforeEach(() => {
  vi.clearAllMocks();
  admin.rpc.mockResolvedValue({
    data: [{ result: "activated", slug: "andi-sinta" }],
    error: null,
  });
});

describe("klasifikasi kegagalan verifikasi", () => {
  it.each([
    ["429 rate limit", new PakasirError("rate limit", 429, true)],
    ["503 gangguan Pakasir", new PakasirError("nanti", 503, true)],
    [
      "bentuk respons tak dikenal (transien)",
      new PakasirError("bentuk", null, true),
    ],
  ])("%s → verify_error (TRANSIEN, dicoba lagi)", async (_n, err) => {
    verifyTransaction.mockRejectedValue(err);
    expect(await jalankan()).toEqual({ kind: "verify_error" });
    expect(laporan()[0][1]).toBe("payment.verify");
  });

  it.each([
    [
      "401 api_key salah",
      new PakasirError("Api key doesn't match", 401, false),
    ],
    ["400 nominal/method", new PakasirError("Minimum amount", 400, false)],
    [
      "404 transaksi tak ada",
      new PakasirError("Transaction not found", 404, false),
    ],
    ["txn_id tak tersimpan", new PakasirError("tak punya txn_id", null, false)],
  ])("%s → verify_broken + area laporan BERBEDA", async (_n, err) => {
    verifyTransaction.mockRejectedValue(err);
    expect(await jalankan()).toEqual({ kind: "verify_broken" });
    expect(laporan()[0][1]).toBe("payment.verify.broken");
  });

  it("galat BUKAN PakasirError (DNS, abort timeout) → transien", async () => {
    // Fail-safe ke arah yang benar: galat yang tak bisa kita klasifikasikan
    // diperlakukan sembuh-sendiri, karena memperlakukannya "putus" akan
    // menghentikan poll untuk gangguan jaringan biasa.
    verifyTransaction.mockRejectedValue(new Error("fetch failed"));
    expect(await jalankan()).toEqual({ kind: "verify_error" });
    expect(laporan()[0][1]).toBe("payment.verify");
  });

  it("keduanya SAMA-SAMA dilaporkan — `transient` memilah, bukan membungkam", async () => {
    verifyTransaction.mockRejectedValue(new PakasirError("x", 429, true));
    await jalankan();
    expect(laporan()).toHaveLength(1);
    reportHandledError.mockClear();
    verifyTransaction.mockRejectedValue(new PakasirError("y", 401, false));
    await jalankan();
    expect(laporan()).toHaveLength(1);
  });

  it("orderCode ikut di laporan, tanpa nominal/PII", async () => {
    verifyTransaction.mockRejectedValue(new PakasirError("x", 401, false));
    await jalankan();
    expect(laporan()[0][2]).toEqual({ orderCode: ORDER.order_code });
  });
});

describe("mismatch nominal", () => {
  const lunasDengan = (amountIdr: number) =>
    verifyTransaction.mockResolvedValue({
      orderCode: ORDER.order_code,
      amountIdr,
      status: "paid",
      paymentMethod: null,
      paidAt: "2026-10-13T09:00:00.000Z",
    });

  it("nominal beda → mismatch, dan RPC aktivasi TIDAK dipanggil", async () => {
    lunasDengan(10000);
    expect(await jalankan()).toEqual({ kind: "mismatch" });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("DILAPORKAN — dulu senyap, padahal pelanggan mungkin sudah membayar", async () => {
    lunasDengan(10000);
    await jalankan();
    const [err, area, extra] = laporan()[0];
    expect(area).toBe("payment.mismatch");
    expect(extra).toMatchObject({ orderCode: ORDER.order_code });
    // Kedua nominal masuk pesan: tanpa keduanya, yang membaca Sentry tak tahu
    // apakah pelanggan membayar lebih atau kurang.
    expect((err as Error).message).toContain("10000");
    expect((err as Error).message).toContain("99000");
  });

  it("nominal cocok → lanjut aktivasi, tanpa laporan", async () => {
    lunasDengan(99000);
    expect(await jalankan()).toMatchObject({ kind: "ok", result: "activated" });
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("belum lunas → not_confirmed, dan itu BUKAN galat", async () => {
    verifyTransaction.mockResolvedValue({
      orderCode: ORDER.order_code,
      amountIdr: 99000,
      status: "pending",
      paymentMethod: null,
      paidAt: null,
    });
    expect(await jalankan()).toEqual({ kind: "not_confirmed" });
    expect(reportHandledError).not.toHaveBeenCalled();
  });
});

describe("txn_id diteruskan ke gateway", () => {
  it("verifikasi v2 menerima txn_id dari baris order", async () => {
    verifyTransaction.mockResolvedValue({
      orderCode: ORDER.order_code,
      amountIdr: 99000,
      status: "paid",
      paymentMethod: null,
      paidAt: null,
    });
    await jalankan();
    expect(verifyTransaction).toHaveBeenCalledWith(
      ORDER.order_code,
      ORDER.amount_idr,
      "abc",
    );
  });

  it("txn_id absen diteruskan sebagai null, bukan undefined", async () => {
    // Gateway membedakan keduanya untuk melempar galat yang jelas.
    verifyTransaction.mockRejectedValue(
      new PakasirError("tak punya txn_id", null, false),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await verifyAndActivate(admin as any, {
      order_code: ORDER.order_code,
      amount_idr: ORDER.amount_idr,
    });
    expect(verifyTransaction).toHaveBeenCalledWith(
      ORDER.order_code,
      ORDER.amount_idr,
      null,
    );
  });
});

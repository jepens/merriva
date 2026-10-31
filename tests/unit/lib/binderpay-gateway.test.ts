import { generateKeyPairSync } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BinderPayError,
  BinderPayGateway,
  MASA_BERLAKU_QR_MS,
  feeQris,
  mapStatusBinderPay,
  pokokUntukHarga,
  rupiahDariNilai,
} from "@/lib/payment/binderpay";
import { verifikasiTandaTangan } from "@/lib/payment/binderpay-signature";
import { UMUR_MAKS_ORDER_PENDING_MS } from "@/lib/payment/types";

/**
 * Driver BinderPay (DECISIONS #99). Angka & bentuk respons di sini BUKAN
 * karangan: semuanya disalin dari jawaban sandbox sungguhan (probe 30–31 Okt
 * 2026). Yang dijaga:
 *   - pelanggan tak pernah ditagih LEBIH dari harga katalog (fee ditanggung
 *     merchant, SPEC §4.8), dan untuk harga katalog sekarang tagihannya PAS;
 *   - nominal yang dilaporkan ke `reconcile.ts` hanya sama dengan harga order
 *     bila pokok dari BinderPay persis pokok yang kita kirim;
 *   - tiap panggilan membawa X-EXTERNAL-ID SEGAR (id berulang ditolak 409);
 *   - tanda tangan dibuat atas bodi yang PERSIS dikirim.
 */

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const BASE = "https://api-sandbox.binderpay.id";
const ORDER = "MRV-8F3K2Q";
const KONTRAK = "bp-sandbox-1067b837-5a7d-4a45-88cc-b0d1e178fff9";
const QR = "00020101021126580011IDfe3383a9-f282-4bed-aefa-530ba4affced0303URE";
const KEMBALI = "https://merriva.id/dashboard/undangan/x/bayar";

const gw = () =>
  new BinderPayGateway({
    partnerId: "BP584400",
    baseUrl: BASE,
    kunciPrivatPem: privateKey,
  });

const JSON_ = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

let panggilan: { url: string; init: RequestInit }[] = [];

function pasangFetch(balas: (url: string, init: RequestInit) => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init: RequestInit = {}) => {
      const url = String(input);
      panggilan.push({ url, init });
      return balas(url, init);
    }),
  );
}

const header = (i: number) =>
  panggilan[i].init.headers as Record<string, string>;
const bodi = (i: number) =>
  JSON.parse(String(panggilan[i].init.body)) as Record<string, unknown>;

/** Jawaban generate sandbox untuk pokok tertentu (bentuk persis probe). */
const generateOk = (pokok: number, ref = ORDER) => ({
  responseCode: "2004700",
  responseMessage: "Success",
  partnerReferenceNo: ref,
  qrContent: QR,
  qrUrl: "https://sandbox.binderpay.id/qr/e0f6e96e",
  terminalId: "",
  amount: { value: `${pokok + feeQris(pokok)}.00`, currency: "IDR" },
  feeAmount: { value: `${feeQris(pokok)}.00`, currency: "IDR" },
  additionalInfo: { contractId: KONTRAK, isStatic: false },
});

const queryOk = (status: string, pokok: number, fee = feeQris(pokok)) => ({
  responseCode: "2005100",
  responseMessage: "Success",
  originalPartnerReferenceNo: ORDER,
  serviceCode: "47",
  latestTransactionStatus: status,
  paidTime: status === "00" ? "2026-10-30T20:21:22+07:00" : "",
  amount: { value: `${pokok}.00`, currency: "IDR" },
  feeAmount: { value: `${fee}.00`, currency: "IDR" },
  additionalInfo: { issuer: "QRIS", rrn: "SANDBOX-x", buyerReff: "winpay" },
});

beforeEach(() => {
  panggilan = [];
  vi.unstubAllGlobals();
});
afterEach(() => vi.unstubAllGlobals());

describe("fee & pokok — fee ditanggung merchant (SPEC §4.8)", () => {
  it("fee = 0,7% dibulatkan BIASA — angka yang diukur di sandbox", () => {
    expect(feeQris(10000)).toBe(70);
    expect(feeQris(10071)).toBe(70); // 70,497
    expect(feeQris(10072)).toBe(71); // 70,504
    expect(feeQris(197617)).toBe(1383);
    expect(feeQris(98312)).toBe(688);
  });

  it.each([
    [99000, 98312],
    [199000, 197617],
    [349000, 346574],
    [649000, 644489],
    [1099000, 1091360],
  ])(
    "harga %i → pokok %i, dan pelanggan membayar PAS harganya",
    (harga, pokok) => {
      expect(pokokUntukHarga(harga)).toBe(pokok);
      expect(pokok + feeQris(pokok)).toBe(harga);
    },
  );

  it("untuk SETIAP harga: tagihan tak pernah melebihi harga, paling murah Rp1 di bawahnya", () => {
    for (let harga = 1000; harga <= 1_500_000; harga += 1) {
      const p = pokokUntukHarga(harga);
      const tagihan = p + feeQris(p);
      if (tagihan > harga || harga - tagihan > 1) {
        throw new Error(`harga ${harga}: pokok ${p} → tagihan ${tagihan}`);
      }
      // TERBESAR: pokok berikutnya sudah melewati harga.
      if (p + 1 + feeQris(p + 1) <= harga) {
        throw new Error(`harga ${harga}: pokok ${p} bukan yang terbesar`);
      }
    }
  });
});

describe("parser kecil", () => {
  it("hanya 00 yang lunas", () => {
    expect(mapStatusBinderPay("00")).toBe("paid");
    for (const k of ["01", "02", "03", "07", "99", undefined]) {
      expect(mapStatusBinderPay(k)).toBe("pending");
    }
    expect(mapStatusBinderPay("05")).toBe("expired");
    expect(mapStatusBinderPay("06")).toBe("failed");
  });

  it("nilai rupiah: hanya bilangan bulat (dengan/tanpa .00)", () => {
    expect(rupiahDariNilai("10000.00")).toBe(10000);
    expect(rupiahDariNilai("35490")).toBe(35490);
    expect(rupiahDariNilai("10000.50")).toBeNull();
    expect(rupiahDariNilai(10000)).toBeNull();
    expect(rupiahDariNilai("")).toBeNull();
  });
});

describe("createPaymentLink — qr-mpm-generate", () => {
  it("mengirim POKOK yang dikurangi, ditandatangani atas bodi yang PERSIS dikirim", async () => {
    pasangFetch(() => JSON_(generateOk(197617)));
    const sebelum = Date.now();

    const hasil = await gw().createPaymentLink({
      orderCode: ORDER,
      amountIdr: 199000,
      redirectUrl: KEMBALI,
    });

    // Tak ada halaman hosted: "link bayar" adalah halaman kita sendiri.
    expect(hasil).toEqual({ url: KEMBALI, txnId: KONTRAK, qrContent: QR });

    expect(panggilan).toHaveLength(1);
    expect(panggilan[0].url).toBe(`${BASE}/v1.0/qr/qr-mpm-generate`);
    const b = bodi(0);
    expect(b.partnerReferenceNo).toBe(ORDER);
    expect(b.amount).toEqual({ value: "197617.00", currency: "IDR" });
    expect(b.additionalInfo).toEqual({ isStatic: false });
    // QR mati SEBELUM order bisa di-expire cron — dengan jarak nyata, bukan
    // sekadar "kurang dari".
    const berlaku = Date.parse(String(b.validityPeriod));
    expect(berlaku - sebelum).toBeGreaterThan(MASA_BERLAKU_QR_MS - 5_000);
    expect(berlaku - sebelum).toBeLessThan(
      UMUR_MAKS_ORDER_PENDING_MS - 30 * 60_000,
    );

    const h = header(0);
    expect(h["CHANNEL-ID"]).toBe("QRIS");
    expect(h["X-PARTNER-ID"]).toBe("BP584400");
    expect(h["X-TIMESTAMP"]).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+07:00$/);
    expect(h["X-EXTERNAL-ID"]).toMatch(/^\d{19}$/);
    expect(
      verifikasiTandaTangan(
        {
          metode: "POST",
          path: "/v1.0/qr/qr-mpm-generate",
          bodi: String(panggilan[0].init.body),
          waktu: h["X-TIMESTAMP"],
        },
        h["X-SIGNATURE"],
        publicKey,
      ),
    ).toBe(true);
  });

  it("tagihan MELEBIHI harga (tarif BinderPay naik) → gagal, pelanggan tak ditagih lebih", async () => {
    pasangFetch(() =>
      JSON_({
        ...generateOk(197617),
        amount: { value: "199100.00", currency: "IDR" },
        feeAmount: { value: "1483.00", currency: "IDR" },
      }),
    );
    await expect(
      gw().createPaymentLink({
        orderCode: ORDER,
        amountIdr: 199000,
        redirectUrl: KEMBALI,
      }),
    ).rejects.toMatchObject({ name: "BinderPayError", transient: false });
  });

  it("pokok yang digemakan berbeda dari yang dikirim → gagal", async () => {
    pasangFetch(() => JSON_(generateOk(197000)));
    await expect(
      gw().createPaymentLink({
        orderCode: ORDER,
        amountIdr: 199000,
        redirectUrl: KEMBALI,
      }),
    ).rejects.toBeInstanceOf(BinderPayError);
  });

  it.each([
    [
      "tanpa contractId",
      { ...generateOk(197617), additionalInfo: { isStatic: false } },
    ],
    ["tanpa qrContent", { ...generateOk(197617), qrContent: "" }],
    ["nomor order lain", generateOk(197617, "MRV-LAIN01")],
  ])(
    "%s → gagal, tak pernah mengembalikan link setengah jadi",
    async (_l, jawaban) => {
      pasangFetch(() => JSON_(jawaban));
      await expect(
        gw().createPaymentLink({
          orderCode: ORDER,
          amountIdr: 199000,
          redirectUrl: KEMBALI,
        }),
      ).rejects.toBeInstanceOf(BinderPayError);
    },
  );

  it("nomor order ganda dijawab 500 5004700 — galat, bukan link", async () => {
    pasangFetch(() =>
      JSON_(
        { responseCode: "5004700", responseMessage: "Internal Server Error" },
        500,
      ),
    );
    await expect(
      gw().createPaymentLink({
        orderCode: ORDER,
        amountIdr: 199000,
        redirectUrl: KEMBALI,
      }),
    ).rejects.toMatchObject({ status: 500 });
  });
});

describe("verifyTransaction — qr-mpm-query (BACA saja)", () => {
  it("lunas dengan pokok PERSIS yang dikirim → dilaporkan sebesar harga order", async () => {
    pasangFetch(() => JSON_(queryOk("00", 197617)));

    const v = await gw().verifyTransaction(ORDER, 199000, KONTRAK);

    expect(v).toEqual({
      orderCode: ORDER,
      amountIdr: 199000,
      status: "paid",
      paymentMethod: "qris",
      paidAt: "2026-10-30T20:21:22+07:00",
    });
    expect(panggilan[0].url).toBe(`${BASE}/v1.0/qr/qr-mpm-query`);
    expect(bodi(0)).toEqual({
      originalPartnerReferenceNo: ORDER,
      serviceCode: "47",
      additionalInfo: { contractId: KONTRAK },
    });
  });

  it("lunas dengan pokok LAIN → dilaporkan yang benar-benar dibayar, supaya reconcile menolaknya", async () => {
    pasangFetch(() => JSON_(queryOk("00", 10000)));

    const v = await gw().verifyTransaction(ORDER, 199000, KONTRAK);

    expect(v.status).toBe("paid");
    expect(v.amountIdr).toBe(10070);
    expect(v.amountIdr).not.toBe(199000);
  });

  it("rujukan tak dikenal dijawab 200 'Initiated' bernominal 0 — bukan lunas", async () => {
    pasangFetch(() => JSON_(queryOk("01", 0, 0)));

    const v = await gw().verifyTransaction(ORDER, 199000, KONTRAK);

    expect(v.status).toBe("pending");
  });

  it("tanpa txn_id → galat TETAP, tanpa satu panggilan pun", async () => {
    pasangFetch(() => JSON_(queryOk("00", 197617)));
    await expect(
      gw().verifyTransaction(ORDER, 199000, null),
    ).rejects.toMatchObject({
      transient: false,
    });
    expect(panggilan).toHaveLength(0);
  });

  it("X-EXTERNAL-ID SEGAR di tiap panggilan (id berulang ditolak 409)", async () => {
    pasangFetch(() => JSON_(queryOk("01", 197617)));
    await gw().verifyTransaction(ORDER, 199000, KONTRAK);
    await gw().verifyTransaction(ORDER, 199000, KONTRAK);
    expect(header(0)["X-EXTERNAL-ID"]).not.toBe(header(1)["X-EXTERNAL-ID"]);
  });

  it.each([
    [401, "4015100", false],
    [400, "4005102", false],
    [409, "4095100", true],
    [429, "4295100", true],
    [500, "5005100", true],
  ])("HTTP %i (%s) → transient=%s", async (status, kode, transient) => {
    pasangFetch(() =>
      JSON_({ responseCode: kode, responseMessage: "x" }, status),
    );
    await expect(
      gw().verifyTransaction(ORDER, 199000, KONTRAK),
    ).rejects.toMatchObject({
      status,
      transient,
    });
  });

  it("HTTP 200 dengan responseCode bukan 2xx → tetap galat (penolakan pun JSON)", async () => {
    pasangFetch(() =>
      JSON_({ responseCode: "4045101", responseMessage: "x" }, 200),
    );
    await expect(
      gw().verifyTransaction(ORDER, 199000, KONTRAK),
    ).rejects.toBeInstanceOf(BinderPayError);
  });

  it("jawaban bukan JSON → galat transien", async () => {
    pasangFetch(
      () => new Response("<html>bad gateway</html>", { status: 502 }),
    );
    await expect(
      gw().verifyTransaction(ORDER, 199000, KONTRAK),
    ).rejects.toMatchObject({
      transient: true,
    });
  });

  it("HTTP 200 berisi JSON TANPA responseCode → transien (bukan penolakan BinderPay)", async () => {
    pasangFetch(() => JSON_({ message: "maintenance" }, 200));
    await expect(
      gw().verifyTransaction(ORDER, 199000, KONTRAK),
    ).rejects.toMatchObject({
      transient: true,
    });
  });
});

describe("cancelTransaction — qr-mpm-cancel", () => {
  /** Jawaban sandbox persis (31 Okt 2026); pembatalan ulang dijawab sama. */
  const cancelOk = {
    responseCode: "2007700",
    responseMessage: "Request has been processed successfully",
    originalPartnerReferenceNo: ORDER,
    cancelTime: "2026-10-31T02:39:00+07:00",
    additionalInfo: { contractId: KONTRAK },
  };

  it("membatalkan dengan pasangan nomor order + txn_id dari baris order, ditandatangani", async () => {
    pasangFetch(() => JSON_(cancelOk));

    await gw().cancelTransaction(ORDER, 199000, KONTRAK);

    expect(panggilan).toHaveLength(1);
    expect(panggilan[0].url).toBe(`${BASE}/v1.0/qr/qr-mpm-cancel`);
    expect(bodi(0)).toEqual({
      originalPartnerReferenceNo: ORDER,
      reason: "Order kedaluwarsa",
      additionalInfo: { contractId: KONTRAK },
    });
    const h = header(0);
    expect(
      verifikasiTandaTangan(
        {
          metode: "POST",
          path: "/v1.0/qr/qr-mpm-cancel",
          bodi: String(panggilan[0].init.body),
          waktu: h["X-TIMESTAMP"],
        },
        h["X-SIGNATURE"],
        publicKey,
      ),
    ).toBe(true);
  });

  it("transaksi SUDAH dibayar (409 4097700) → galat berpesan jelas untuk laporan cron", async () => {
    pasangFetch(() =>
      JSON_(
        {
          responseCode: "4097700",
          responseMessage:
            "Transaction has already been paid and cannot be cancelled",
        },
        409,
      ),
    );
    await expect(
      gw().cancelTransaction(ORDER, 199000, KONTRAK),
    ).rejects.toThrow(/already been paid/);
  });

  it("rujukan tak dikenal (404 4047701) → galat yang terlihat cron", async () => {
    pasangFetch(() =>
      JSON_(
        { responseCode: "4047701", responseMessage: "Transaction not found" },
        404,
      ),
    );
    await expect(
      gw().cancelTransaction(ORDER, 199000, KONTRAK),
    ).rejects.toMatchObject({
      status: 404,
      transient: false,
    });
  });

  it("tanpa txn_id → galat TETAP, tanpa satu panggilan pun", async () => {
    pasangFetch(() => JSON_(cancelOk));
    await expect(
      gw().cancelTransaction(ORDER, 199000, null),
    ).rejects.toMatchObject({
      transient: false,
    });
    expect(panggilan).toHaveLength(0);
  });
});

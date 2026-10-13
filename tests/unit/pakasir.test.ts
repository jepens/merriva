import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PakasirError,
  PakasirGateway,
  buildPakasirPayUrl,
  mapPakasirStatus,
  parseTransactionStatus,
} from "@/lib/payment/pakasir";

/**
 * Integrasi Pakasir **API v2** (AUDIT-2026-10-13, DECISIONS #72).
 *
 * v1 dihentikan 20 Oktober 2026. Bentuk yang diuji di sini SELURUHNYA berasal
 * dari pemanggilan API sandbox sungguhan, BUKAN dari dokumen — dokumen Pakasir
 * terbukti salah dua kali dalam satu hari (menulis `expired_at` padahal API
 * mengirim `expires_at`; menjanjikan `va_number: ""` yang sebenarnya tak ada).
 *
 * Yang paling berharga di berkas ini adalah dua gerbang yang TIDAK terlihat
 * perlu sampai seseorang memahami `find-or-create`:
 *   1. `createPaymentLink` memverifikasi NOMINAL sesudah membuat. Respons
 *      `payment_link` hanya `{txn_id, payment_link}` — tak ada nominal di
 *      dalamnya — sementara find-or-create berkunci `order_id` SAJA dan
 *      mengembalikan transaksi LAMA bila order_id pernah dipakai dengan nominal
 *      lain, dengan HTTP 200 dan tanpa galat. Di v1 nominal ada di dalam URL
 *      sehingga mustahil berbeda; v2 menghapus jaminan itu.
 *   2. `verifyTransaction` adalah operasi BACA. Ia tidak boleh "memulihkan"
 *      `txn_id` yang hilang dengan membuat transaksi, karena jalurnya dipicu
 *      endpoint webhook publik.
 */

const OK = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const SLUG = "merriva";
const TXN = "g6ikm4iq";
const ORDER = "MRV-8F3K2Q";

let panggilan: { url: string; init: RequestInit }[] = [];

function pasangFetch(
  balas: (url: string, init: RequestInit) => Response | Promise<Response>,
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init: RequestInit = {}) => {
      const url = String(input);
      panggilan.push({ url, init });
      return balas(url, init);
    }),
  );
}

const gw = () => new PakasirGateway(SLUG, "kunci-uji"); // gitleaks:allow

beforeEach(() => {
  panggilan = [];
  vi.unstubAllGlobals();
});
afterEach(() => vi.unstubAllGlobals());

describe("buildPakasirPayUrl", () => {
  const LINK = `https://app.pakasir.com/pay-v2/${TXN}`;

  it("menempel redirect sebagai query param", () => {
    const u = buildPakasirPayUrl(LINK, {
      redirectUrl: "https://merriva.id/dashboard/undangan/x/bayar",
    });
    expect(new URL(u).searchParams.get("redirect")).toBe(
      "https://merriva.id/dashboard/undangan/x/bayar",
    );
  });

  it("qris_only hanya ikut bila diminta", () => {
    expect(
      new URL(
        buildPakasirPayUrl(LINK, { redirectUrl: "https://a.test" }),
      ).searchParams.get("qris_only"),
    ).toBeNull();
    expect(
      new URL(
        buildPakasirPayUrl(LINK, {
          redirectUrl: "https://a.test",
          qrisOnly: true,
        }),
      ).searchParams.get("qris_only"),
    ).toBe("1");
  });

  it("tetap benar bila link SUDAH punya query string", () => {
    // Memakai `URL`, bukan konkatenasi `?`. Bila Pakasir kelak mengembalikan
    // link ber-query, menempel `?` akan menghasilkan URL rusak yang baru
    // terlihat saat pelanggan mengkliknya.
    const u = buildPakasirPayUrl(`${LINK}?ref=abc`, {
      redirectUrl: "https://merriva.id/x",
    });
    const q = new URL(u).searchParams;
    expect(q.get("ref")).toBe("abc");
    expect(q.get("redirect")).toBe("https://merriva.id/x");
    expect(u.split("?").length).toBe(2);
  });
});

describe("mapPakasirStatus", () => {
  it("hanya `completed` berarti lunas", () => {
    expect(mapPakasirStatus("completed")).toBe("paid");
  });

  it.each(["pending", "failed", "COMPLETED", "", null, undefined, 1])(
    "%s diperlakukan BELUM lunas (fail-closed)",
    (v) => {
      expect(mapPakasirStatus(v)).toBe("pending");
    },
  );
});

describe("parseTransactionStatus", () => {
  const NYATA = {
    txn_id: TXN,
    order_id: ORDER,
    amount: 500,
    is_sandbox: true,
    status: "completed",
    completed_at: "2026-10-13T09:03:59.556Z",
  };

  it("mem-parse bentuk NYATA v2", () => {
    const p = parseTransactionStatus(NYATA);
    expect(p).toMatchObject({
      orderCode: ORDER,
      amountIdr: 500,
      status: "paid",
      paidAt: "2026-10-13T09:03:59.556Z",
      txnId: TXN,
      isSandbox: true,
    });
  });

  it("paymentMethod SELALU null — v2 tak mengirim field itu", () => {
    // Bukan kehilangan: v1 pun mengembalikan "" untuk transaksi payment_link.
    expect(parseTransactionStatus(NYATA)?.paymentMethod).toBeNull();
  });

  it.each([
    ["tanpa order_id", { amount: 500 }],
    ["tanpa amount", { order_id: ORDER }],
    ["amount bukan angka", { order_id: ORDER, amount: "500" }],
    ["bukan objek", "halo"],
    ["null", null],
  ])("%s → null (pemanggil memperlakukan gagal-verifikasi)", (_n, data) => {
    expect(parseTransactionStatus(data)).toBeNull();
  });

  it("tak mewajibkan field yang hanya dijamin DOKUMEN", () => {
    // `is_sandbox`, `status`, `completed_at`, `txn_id` boleh hilang semuanya.
    expect(
      parseTransactionStatus({ order_id: ORDER, amount: 99000 }),
    ).toMatchObject({
      orderCode: ORDER,
      amountIdr: 99000,
      status: "pending",
      txnId: null,
    });
  });
});

describe("createPaymentLink", () => {
  const buatOk = (amount = 99000) =>
    pasangFetch((url) =>
      url.includes("create-transaction")
        ? OK({
            txn_id: TXN,
            payment_link: `https://app.pakasir.com/pay-v2/${TXN}`,
          })
        : OK({ txn_id: TXN, order_id: ORDER, amount, status: "pending" }),
    );

  it("memakai header X-Api-Key, bukan query string", async () => {
    buatOk();
    await gw().createPaymentLink({
      orderCode: ORDER,
      amountIdr: 99000,
      redirectUrl: "https://merriva.id/x",
    });
    const h = panggilan[0].init.headers as Record<string, string>;
    expect(h["X-Api-Key"]).toBe("kunci-uji"); // gitleaks:allow
    // Di v1 api_key ada di URL, sehingga bisa masuk log proxy mana pun.
    expect(panggilan[0].url).not.toContain("kunci-uji");
  });

  it("POST ke path v2 dengan slug & order_id ter-encode", async () => {
    buatOk();
    await gw().createPaymentLink({
      orderCode: ORDER,
      amountIdr: 99000,
      redirectUrl: "https://merriva.id/x",
    });
    expect(panggilan[0].url).toBe(
      `https://app.pakasir.com/api/v2/create-transaction/${SLUG}/${ORDER}`,
    );
    expect(panggilan[0].init.method).toBe("POST");
    expect(JSON.parse(String(panggilan[0].init.body))).toEqual({
      method: "payment_link",
      amount: 99000,
    });
  });

  it("mengembalikan txnId + url berisi redirect", async () => {
    buatOk();
    const r = await gw().createPaymentLink({
      orderCode: ORDER,
      amountIdr: 99000,
      redirectUrl: "https://merriva.id/x",
    });
    expect(r.txnId).toBe(TXN);
    expect(new URL(r.url).searchParams.get("redirect")).toBe(
      "https://merriva.id/x",
    );
  });

  it("MELEMPAR bila nominal transaksi tak cocok dengan order", async () => {
    // Gerbang terpenting di berkas ini. find-or-create berkunci order_id SAJA:
    // order_code yang pernah dipakai (mis. sisa run E2E) mengembalikan transaksi
    // LAMA ber-nominal lain dengan HTTP 200. Tanpa gerbang ini pelanggan melihat
    // dan membayar nominal yang salah, lalu aktivasinya ditolak `mismatch` —
    // sudah membayar, tak mendapat apa pun.
    buatOk(10000);
    await expect(
      gw().createPaymentLink({
        orderCode: ORDER,
        amountIdr: 99000,
        redirectUrl: "https://merriva.id/x",
      }),
    ).rejects.toThrow(/nominal transaksi/i);
  });

  it("MELEMPAR bila order_id yang digemakan tak cocok", async () => {
    pasangFetch((url) =>
      url.includes("create-transaction")
        ? OK({
            txn_id: TXN,
            payment_link: `https://app.pakasir.com/pay-v2/${TXN}`,
          })
        : OK({ txn_id: TXN, order_id: "ORDER-LAIN", amount: 99000 }),
    );
    await expect(
      gw().createPaymentLink({
        orderCode: ORDER,
        amountIdr: 99000,
        redirectUrl: "https://merriva.id/x",
      }),
    ).rejects.toThrow(/order_id/i);
  });

  it("MELEMPAR bila payment_link mengarah ke host LAIN (open-redirect)", async () => {
    // URL ini dipakai mengarahkan browser pelanggan. Ia datang dari body respons
    // API, jadi host-nya wajib diperiksa.
    pasangFetch(() =>
      OK({ txn_id: TXN, payment_link: "https://jahat.test/ambil" }),
    );
    await expect(
      gw().createPaymentLink({
        orderCode: ORDER,
        amountIdr: 99000,
        redirectUrl: "https://merriva.id/x",
      }),
    ).rejects.toThrow(/host tak dikenal/i);
  });

  it.each([
    [
      "respons tanpa txn_id",
      { payment_link: "https://app.pakasir.com/pay-v2/x" },
    ],
    ["respons tanpa payment_link", { txn_id: TXN }],
  ])("%s → melempar", async (_n, body) => {
    pasangFetch(() => OK(body));
    await expect(
      gw().createPaymentLink({
        orderCode: ORDER,
        amountIdr: 99000,
        redirectUrl: "https://merriva.id/x",
      }),
    ).rejects.toThrow(/bentuk respons tak dikenal/i);
  });
});

describe("klasifikasi galat (menentukan retry Pakasir)", () => {
  const panggil = async (status: number, body: unknown) => {
    pasangFetch(() => OK(body, status));
    try {
      await gw().createPaymentLink({
        orderCode: ORDER,
        amountIdr: 99000,
        redirectUrl: "https://merriva.id/x",
      });
      return null;
    } catch (e) {
      return e as PakasirError;
    }
  };

  it("429 TRANSIEN — plafon 2/detik nyata, dan 429 harus dicoba lagi", async () => {
    const e = await panggil(429, {
      message: "Rate limit exceeded",
      data: null,
    });
    expect(e?.transient).toBe(true);
    expect(e?.message).toContain("Rate limit exceeded");
  });

  it("5xx TRANSIEN", async () => {
    expect((await panggil(503, { message: "nanti" }))?.transient).toBe(true);
  });

  it("401 TIDAK transien — api_key salah tak membaik dengan diulang", async () => {
    // Memetakannya transien membuat Pakasir mengulang selamanya dan justru
    // memperburuk plafon 2/detik yang sama.
    const e = await panggil(401, {
      message: "Api key doesn't match",
      data: null,
    });
    expect(e?.transient).toBe(false);
  });

  it("400 TIDAK transien, dan pesan Pakasir dibawa apa adanya", async () => {
    const e = await panggil(400, {
      message: "Minimum amount for payment_link is Rp 500",
      data: null,
    });
    expect(e?.transient).toBe(false);
    expect(e?.message).toContain("Minimum amount for payment_link");
  });

  it("pesan galat tak pernah memuat api_key", async () => {
    const e = await panggil(400, { message: "apa pun" });
    expect(e?.message).not.toContain("kunci-uji");
  });
});

describe("verifyTransaction", () => {
  it("GET status v2 berkunci txn_id", async () => {
    pasangFetch(() =>
      OK({ txn_id: TXN, order_id: ORDER, amount: 99000, status: "completed" }),
    );
    const v = await gw().verifyTransaction(ORDER, 99000, TXN);
    expect(panggilan[0].url).toBe(
      `https://app.pakasir.com/api/v2/transaction-status/${SLUG}/${TXN}`,
    );
    expect(v.status).toBe("paid");
  });

  it("txn_id KOSONG → melempar, dan TIDAK memanggil apa pun", async () => {
    // Verifikasi adalah operasi BACA. Memulihkan txn_id dengan memanggil
    // create-transaction akan menjadikannya operasi TULIS yang bisa dipicu
    // endpoint webhook publik — pemanggil tak dikenal menerbitkan link hidup.
    pasangFetch(() => OK({}));
    await expect(gw().verifyTransaction(ORDER, 99000, null)).rejects.toThrow(
      /tak punya txn_id/i,
    );
    expect(panggilan).toHaveLength(0);
  });

  it("gema order_id tak cocok → melempar (jangan terima transaksi order lain)", async () => {
    pasangFetch(() =>
      OK({ order_id: "ORDER-LAIN", amount: 99000, status: "completed" }),
    );
    await expect(gw().verifyTransaction(ORDER, 99000, TXN)).rejects.toThrow(
      /tak cocok/i,
    );
  });

  it("HTTP non-OK → melempar (FAIL-CLOSED)", async () => {
    pasangFetch(() =>
      OK({ message: "Transaction not found", data: null }, 404),
    );
    await expect(gw().verifyTransaction(ORDER, 99000, TXN)).rejects.toThrow();
  });

  it("bentuk tak dikenal → melempar (FAIL-CLOSED)", async () => {
    pasangFetch(() => OK({ sesuatu: "lain" }));
    await expect(gw().verifyTransaction(ORDER, 99000, TXN)).rejects.toThrow(
      /bentuk respons tak dikenal/i,
    );
  });

  it("mengembalikan nominal dari API, bukan yang diminta", async () => {
    // `reconcile.ts` yang membandingkannya; gateway tak boleh menutupi selisih.
    pasangFetch(() =>
      OK({ order_id: ORDER, amount: 10000, status: "completed" }),
    );
    expect((await gw().verifyTransaction(ORDER, 99000, TXN)).amountIdr).toBe(
      10000,
    );
  });
});

describe("cancelTransaction", () => {
  it("POST ke cancel v2 berkunci txn_id", async () => {
    pasangFetch(() => OK({ ok: true }));
    await gw().cancelTransaction(ORDER, 99000, TXN);
    expect(panggilan[0].url).toBe(
      `https://app.pakasir.com/api/v2/cancel-transaction/${SLUG}/${TXN}`,
    );
    expect(panggilan[0].init.method).toBe("POST");
  });

  it("txn_id kosong → melempar tanpa memanggil", async () => {
    pasangFetch(() => OK({}));
    await expect(gw().cancelTransaction(ORDER, 99000, null)).rejects.toThrow(
      /tak punya txn_id/i,
    );
    expect(panggilan).toHaveLength(0);
  });
});

describe("simulatePayment", () => {
  it("DILARANG di production", async () => {
    const lama = process.env.NODE_ENV;
    vi.stubEnv("NODE_ENV", "production");
    pasangFetch(() => OK({ success: true }));
    await expect(gw().simulatePayment(ORDER, 500)).rejects.toThrow(/dilarang/i);
    expect(panggilan).toHaveLength(0);
    vi.stubEnv("NODE_ENV", lama ?? "test");
  });

  it("tetap memakai endpoint v1 — tak ada padanan v2", async () => {
    // `/api/v2/payment-simulation/...` dijawab {"message":"Not found"} (route tak
    // ada). Diverifikasi bahwa simulasi v1 MEMANG melunasi transaksi buatan v2.
    pasangFetch(() => OK({ success: true }));
    await gw().simulatePayment(ORDER, 500);
    expect(panggilan[0].url).toBe(
      "https://app.pakasir.com/api/paymentsimulation",
    );
  });
});

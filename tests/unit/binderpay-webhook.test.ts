import { generateKeyPairSync } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route callback QRIS BinderPay (`/api/webhooks/binderpay`, DECISIONS #99),
 * dipanggil langsung dengan callback yang DITANDATANGANI sungguhan (pasangan
 * kunci dibuat di sini). Yang dijaga:
 *   - tanda tangan dihitung atas path SNAP TETAP `/v1.0/qr/qr-mpm-notify`,
 *     bukan path URL kita — tanda tangan atas path URL ditolak;
 *   - callback yang tak sah ditolak SEBELUM menyentuh DB;
 *   - verifikasi memakai `txn_id` dari BARIS ORDER, bukan isi callback;
 *   - BinderPay mengulang sampai HTTP 200, jadi transien → 5xx, final → 200.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/request-ip", () => ({
  checkClientRateLimit: vi.fn(async () => ({ ok: true })),
}));

const { refs, verifyAndActivate, notifyOrderPaid, reportHandledError } =
  vi.hoisted(() => ({
    refs: {
      order: null as unknown,
      lookupError: null as unknown,
      lookups: 0,
    },
    verifyAndActivate: vi.fn(
      async (_admin: unknown, _order: unknown, _raw: unknown) =>
        ({ kind: "ok", result: "activated", slug: "andi-sinta" }) as unknown,
    ),
    notifyOrderPaid: vi.fn(async (_admin: unknown, _code: string) => "sent"),
    reportHandledError: vi.fn((_e: unknown, _area: string, _x?: unknown) => {}),
  }));

vi.mock("@/server/payment/reconcile", () => ({ verifyAndActivate }));
vi.mock("@/server/email/notify", () => ({ notifyOrderPaid }));
vi.mock("@/lib/observability", () => ({ reportHandledError }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = async () => {
        refs.lookups += 1;
        return { data: refs.order, error: refs.lookupError };
      };
      return chain;
    },
  }),
}));

import { POST } from "@/app/api/webhooks/binderpay/route";
import {
  stempelWaktuWib,
  tandaTangani,
} from "@/lib/payment/binderpay-signature";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const PARTNER = "BP584400";
const ORDER = "MRV-QRIS01";

/** Bentuk callback QRIS dari dokumentasi BinderPay. */
const CALLBACK = {
  originalReferenceNo: "38740",
  originalPartnerReferenceNo: ORDER,
  latestTransactionStatus: "00",
  amount: { value: "35490", currency: "IDR" },
  feeAmount: { value: "550.00", currency: "IDR" },
  additionalInfo: {
    channel: "QRIS",
    contractId: "bp-dari-callback-JANGAN-DIPAKAI",
    brandName: "DANA",
    rrn: "737659758297",
    buyerRef: "BUDI SANTOSO",
    terminalId: "A01",
  },
};

function permintaan(
  muatan: unknown,
  opsi: {
    path?: string;
    waktu?: string;
    /** `null` = header tak dikirim sama sekali. */
    partner?: string | null;
    tandaTangan?: string;
    bodiMentah?: string;
  } = {},
) {
  const bodi = opsi.bodiMentah ?? JSON.stringify(muatan);
  const waktu = opsi.waktu ?? stempelWaktuWib(Date.now());
  const tandaTangan =
    opsi.tandaTangan ??
    tandaTangani(
      {
        metode: "POST",
        path: opsi.path ?? "/v1.0/qr/qr-mpm-notify",
        bodi,
        waktu,
      },
      privateKey,
    );
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-TIMESTAMP": waktu,
    "X-SIGNATURE": tandaTangan,
    "X-EXTERNAL-ID": "1793366300048001",
  };
  if (opsi.partner !== null) headers["X-PARTNER-ID"] = opsi.partner ?? PARTNER;
  return new Request("https://merriva.id/api/webhooks/binderpay", {
    method: "POST",
    headers,
    body: bodi,
  });
}

const PENDING = {
  order_code: ORDER,
  amount_idr: 199000,
  status: "pending",
  txn_id: "bp-sandbox-dari-baris-order",
};

beforeEach(() => {
  vi.stubEnv("BINDERPAY_PARTNER_ID", PARTNER);
  vi.stubEnv(
    "BINDERPAY_PUBLIC_KEY_B64",
    Buffer.from(publicKey).toString("base64"),
  );
  refs.order = PENDING;
  refs.lookupError = null;
  refs.lookups = 0;
  verifyAndActivate.mockClear();
  notifyOrderPaid.mockClear();
  reportHandledError.mockClear();
  verifyAndActivate.mockResolvedValue({
    kind: "ok",
    result: "activated",
    slug: "andi-sinta",
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("callback sah", () => {
  it("diverifikasi dengan txn_id dari BARIS ORDER, lalu dijawab 2005200", async () => {
    const res = await POST(permintaan(CALLBACK));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      responseCode: "2005200",
      responseMessage: "Successful",
    });
    expect(verifyAndActivate).toHaveBeenCalledTimes(1);
    expect(verifyAndActivate.mock.calls[0][1]).toEqual({
      order_code: ORDER,
      amount_idr: 199000,
      txn_id: "bp-sandbox-dari-baris-order",
    });
    expect(notifyOrderPaid).toHaveBeenCalledWith(expect.anything(), ORDER);
  });

  it("yang disimpan ke raw_notification hanya daftar putih — NAMA pembayar dibuang", async () => {
    await POST(permintaan(CALLBACK));

    const disimpan = verifyAndActivate.mock.calls[0][2];
    expect(disimpan).toEqual({
      originalReferenceNo: "38740",
      originalPartnerReferenceNo: ORDER,
      latestTransactionStatus: "00",
      amount: { value: "35490", currency: "IDR" },
      feeAmount: { value: "550.00", currency: "IDR" },
      additionalInfo: {
        channel: "QRIS",
        contractId: "bp-dari-callback-JANGAN-DIPAKAI",
        brandName: "DANA",
        rrn: "737659758297",
      },
    });
    expect(JSON.stringify(disimpan)).not.toContain("BUDI SANTOSO");
  });

  it("tanpa header X-PARTNER-ID → tetap diproses (dokumentasi tak menjanjikannya)", async () => {
    const res = await POST(permintaan(CALLBACK, { partner: null }));
    expect(res.status).toBe(200);
    expect(verifyAndActivate).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["verify_error", 503],
    ["verify_broken", 503],
    ["rpc_error", 500],
    ["mismatch", 200],
  ])("hasil %s → HTTP %i", async (kind, status) => {
    verifyAndActivate.mockResolvedValue({ kind });
    const res = await POST(permintaan(CALLBACK));
    expect(res.status).toBe(status);
    expect(notifyOrderPaid).not.toHaveBeenCalled();
  });

  it("callback berkata LUNAS tetapi query belum → 503 agar BinderPay mengulang, dan dilaporkan", async () => {
    verifyAndActivate.mockResolvedValue({ kind: "not_confirmed" });
    const res = await POST(permintaan(CALLBACK));
    expect(res.status).toBe(503);
    expect(reportHandledError.mock.calls.map((c) => c[1])).toContain(
      "payment.webhook.unconfirmed",
    );
  });

  it("callback BUKAN lunas dan query pun belum → 200, tak ada yang perlu diulang", async () => {
    verifyAndActivate.mockResolvedValue({ kind: "not_confirmed" });
    const res = await POST(
      permintaan({ ...CALLBACK, latestTransactionStatus: "05" }),
    );
    expect(res.status).toBe(200);
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("order tak dikenal / sudah bukan pending → 200 tanpa verifikasi", async () => {
    refs.order = null;
    expect((await POST(permintaan(CALLBACK))).status).toBe(200);
    refs.order = { ...PENDING, status: "paid" };
    expect((await POST(permintaan(CALLBACK))).status).toBe(200);
    expect(verifyAndActivate).not.toHaveBeenCalled();
  });

  it("galat DB saat mencari order → 503 (200 bersifat final)", async () => {
    refs.lookupError = { message: "timeout" };
    expect((await POST(permintaan(CALLBACK))).status).toBe(503);
  });
});

describe("callback tak sah ditolak SEBELUM menyentuh DB", () => {
  it("tanda tangan atas path URL kita (bukan path SNAP) → 401", async () => {
    const res = await POST(
      permintaan(CALLBACK, { path: "/api/webhooks/binderpay" }),
    );
    expect(res.status).toBe(401);
    expect(refs.lookups).toBe(0);
  });

  it("bodi diubah setelah ditandatangani → 401", async () => {
    const asli = JSON.stringify(CALLBACK);
    const waktu = stempelWaktuWib(Date.now());
    const tandaTangan = tandaTangani(
      { metode: "POST", path: "/v1.0/qr/qr-mpm-notify", bodi: asli, waktu },
      privateKey,
    );
    const res = await POST(
      permintaan(CALLBACK, {
        waktu,
        tandaTangan,
        bodiMentah: asli.replace("00", "01"),
      }),
    );
    expect(res.status).toBe(401);
    expect(refs.lookups).toBe(0);
  });

  it("stempel waktu basi (replay) → 401", async () => {
    const res = await POST(
      permintaan(CALLBACK, {
        waktu: stempelWaktuWib(Date.now() - 10 * 60_000),
      }),
    );
    expect(res.status).toBe(401);
    expect(refs.lookups).toBe(0);
  });

  it("tanpa tanda tangan → 401", async () => {
    const res = await POST(permintaan(CALLBACK, { tandaTangan: "" }));
    expect(res.status).toBe(401);
  });
});

describe("kasus tepi", () => {
  it("X-PARTNER-ID lain → DILAPORKAN (dengan nilainya), tetapi query tetap yang memutuskan", async () => {
    // Header ini belum terukur di produksi. Membuang callback karenanya akan
    // mematikan setiap callback sah bila BinderPay mengirim nilai lain.
    verifyAndActivate.mockResolvedValue({ kind: "not_confirmed" });
    const res = await POST(
      permintaan(
        { ...CALLBACK, latestTransactionStatus: "01" },
        {
          partner: "BP000001",
        },
      ),
    );
    expect(res.status).toBe(200);
    expect(verifyAndActivate).toHaveBeenCalledTimes(1);
    expect(reportHandledError.mock.calls[0][1]).toBe(
      "payment.webhook.partner-lain",
    );
    expect(reportHandledError.mock.calls[0][2]).toEqual({
      partnerId: "BP000001",
    });
  });

  it("BinderPay belum dipakai di environment ini → 200, tanpa apa pun", async () => {
    vi.stubEnv("BINDERPAY_PARTNER_ID", "");
    const res = await POST(permintaan(CALLBACK));
    expect(res.status).toBe(200);
    expect(refs.lookups).toBe(0);
  });

  it("kunci publik belum diisi → tetap diproses (bukti dari query) dan DILAPORKAN", async () => {
    vi.stubEnv("BINDERPAY_PUBLIC_KEY_B64", "");
    const res = await POST(permintaan(CALLBACK));
    expect(res.status).toBe(200);
    expect(verifyAndActivate).toHaveBeenCalledTimes(1);
    expect(reportHandledError.mock.calls.map((c) => c[1])).toContain(
      "payment.webhook.binderpay-key-unset",
    );
  });

  it("bentuk payload tak dikenal → 503 (BinderPay mengulang)", async () => {
    const res = await POST(permintaan({ status: "00" }));
    expect(res.status).toBe(503);
  });

  it("bodi melebihi 8 KB → 413", async () => {
    const res = await POST(
      permintaan(CALLBACK, { bodiMentah: "x".repeat(9000) }),
    );
    expect(res.status).toBe(413);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPaymentGateway } from "@/lib/payment";
import { BinderPayGateway } from "@/lib/payment/binderpay";
import { PakasirGateway } from "@/lib/payment/pakasir";

/**
 * Pemilihan gateway (DECISIONS #99): BinderPay terpilih begitu
 * `BINDERPAY_PARTNER_ID` terisi, Pakasir sampai saat itu. Yang dijaga:
 *   - konfigurasi BinderPay yang SETENGAH terisi gagal keras, tak pernah jatuh
 *     diam-diam ke Pakasir;
 *   - host sandbox tak pernah dipakai produksi — Payment Simulator sandbox bisa
 *     "melunasi" transaksi mana pun.
 */

const KUNCI_B64 = Buffer.from("-----BEGIN PRIVATE KEY-----").toString("base64");

beforeEach(() => {
  vi.stubEnv("BINDERPAY_PARTNER_ID", "");
  vi.stubEnv("BINDERPAY_BASE_URL", "");
  vi.stubEnv("BINDERPAY_PRIVATE_KEY_B64", "");
  vi.stubEnv("PAKASIR_PROJECT_SLUG", "merriva");
});
afterEach(() => vi.unstubAllEnvs());

const pasangBinderPay = (baseUrl = "https://api.binderpay.id/") => {
  vi.stubEnv("BINDERPAY_PARTNER_ID", "BP584400");
  vi.stubEnv("BINDERPAY_BASE_URL", baseUrl);
  vi.stubEnv("BINDERPAY_PRIVATE_KEY_B64", KUNCI_B64);
};

describe("getPaymentGateway", () => {
  it("tanpa BINDERPAY_PARTNER_ID → Pakasir", () => {
    expect(getPaymentGateway()).toBeInstanceOf(PakasirGateway);
  });

  it("BINDERPAY_PARTNER_ID terisi → BinderPay", () => {
    pasangBinderPay();
    expect(getPaymentGateway()).toBeInstanceOf(BinderPayGateway);
  });

  it.each(["BINDERPAY_BASE_URL", "BINDERPAY_PRIVATE_KEY_B64"])(
    "%s kosong → galat, BUKAN jatuh ke Pakasir",
    (nama) => {
      pasangBinderPay();
      vi.stubEnv(nama, "");
      expect(() => getPaymentGateway()).toThrow(nama);
    },
  );

  it("host sandbox di produksi → galat", () => {
    pasangBinderPay("https://api-sandbox.binderpay.id");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getPaymentGateway()).toThrow(/sandbox/);
  });

  it("host sandbox di luar produksi → boleh (pengujian lokal)", () => {
    pasangBinderPay("https://api-sandbox.binderpay.id");
    vi.stubEnv("NODE_ENV", "development");
    expect(getPaymentGateway()).toBeInstanceOf(BinderPayGateway);
  });
});

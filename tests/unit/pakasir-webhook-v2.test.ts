import { afterEach, describe, expect, it, vi } from "vitest";

import {
  checkWebhookSecret,
  pakasirWebhookSchema,
} from "@/lib/payment/webhook";

/**
 * Payload & autentikasi webhook Pakasir — v1 DAN v2 (AUDIT-2026-10-13).
 *
 * Yang dijaga di sini adalah satu kegagalan yang akan SENYAP dan PERMANEN:
 * payload v2 **tidak lagi mengirim `project`**, sementara skema lama
 * MEWAJIBKANNYA. Handler menjawab 400 untuk bentuk tak dikenal, dan 400
 * diperlakukan Pakasir sebagai final sehingga ia berhenti mencoba ulang. Jadi
 * begitu Pakasir beralih ke v2, SETIAP webhook pembayaran akan ditolak selamanya
 * dan tak satu pun undangan teraktivasi lewat jalur itu — tanpa galat yang
 * terlihat di mana pun.
 *
 * Bentuk v2 di bawah diambil dari dokumen resmi `pakasir.com/p/webhook`, dan
 * bentuk v1 dari integrasi yang berjalan sekarang. Keduanya harus diterima:
 * tak ada yang tahu persis kapan Pakasir berganti, dan skema yang hanya menerima
 * salah satu akan merusak jalur uang di hari peralihan.
 */

const V1 = {
  amount: 99000,
  order_id: "MRV-8F3K2Q",
  project: "merriva",
  status: "completed",
  payment_method: "qris",
  completed_at: "2026-10-13T09:03:59.556Z",
};

const V2 = {
  txn_id: "vwiqpcriq",
  order_id: "MRV-8F3K2Q",
  amount: 99000,
  is_sandbox: false,
  status: "completed",
  completed_at: "2026-10-13T09:03:59.556Z",
};

describe("skema menerima KEDUA versi", () => {
  it("payload v1 diterima", () => {
    expect(pakasirWebhookSchema.safeParse(V1).success).toBe(true);
  });

  it("payload v2 diterima — TANPA `project`", () => {
    // Inti perbaikannya. Skema lama menolak ini, dan penolakannya permanen.
    expect("project" in V2).toBe(false);
    expect(pakasirWebhookSchema.safeParse(V2).success).toBe(true);
  });

  it("v2 membawa `txn_id` dan `is_sandbox` yang ikut terbaca", () => {
    const p = pakasirWebhookSchema.parse(V2);
    expect(p.txn_id).toBe("vwiqpcriq");
    expect(p.is_sandbox).toBe(false);
  });
});

describe("hanya dua field yang WAJIB", () => {
  it("order_id + amount cukup", () => {
    // Dokumen Pakasir sudah terbukti salah dua kali dalam satu hari, jadi parser
    // ini tak mewajibkan apa pun yang hanya dijamin dokumen.
    expect(
      pakasirWebhookSchema.safeParse({ order_id: "MRV-X", amount: 1 }).success,
    ).toBe(true);
  });

  it.each([
    ["tanpa order_id", { amount: 1 }],
    ["order_id kosong", { order_id: "", amount: 1 }],
    ["tanpa amount", { order_id: "MRV-X" }],
    ["amount negatif", { order_id: "MRV-X", amount: -1 }],
    ["amount pecahan", { order_id: "MRV-X", amount: 1.5 }],
    ["amount string", { order_id: "MRV-X", amount: "1" }],
  ])("%s ditolak", (_n, body) => {
    expect(pakasirWebhookSchema.safeParse(body).success).toBe(false);
  });

  it("field tambahan yang belum dikenal tidak menggagalkan parse", () => {
    // Pakasir boleh menambah field kapan saja; itu bukan alasan menolak
    // pembayaran yang sah.
    expect(
      pakasirWebhookSchema.safeParse({ ...V2, sesuatu_baru: "x" }).success,
    ).toBe(true);
  });
});

describe("checkWebhookSecret", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("env belum diisi → `unset`, BUKAN penolakan", () => {
    // Menolak akan mematikan SELURUH aktivasi pembayaran bila pemilik belum
    // menyalin secret-nya saat deploy pertama — kegagalan yang jauh lebih mahal
    // daripada webhook tak tersaring, karena lapisan otoritatif tetap berjalan.
    vi.stubEnv("PAKASIR_WEBHOOK_SECRET", "");
    expect(checkWebhookSecret("apa pun")).toBe("unset");
    expect(checkWebhookSecret(null)).toBe("unset");
  });

  it("cocok → ok", () => {
    vi.stubEnv("PAKASIR_WEBHOOK_SECRET", "rahasia-uji"); // gitleaks:allow
    expect(checkWebhookSecret("rahasia-uji")).toBe("ok");
  });

  it("tak cocok → mismatch", () => {
    vi.stubEnv("PAKASIR_WEBHOOK_SECRET", "rahasia-uji"); // gitleaks:allow
    expect(checkWebhookSecret("salah")).toBe("mismatch");
  });

  it("header HILANG padahal env terisi → mismatch", () => {
    vi.stubEnv("PAKASIR_WEBHOOK_SECRET", "rahasia-uji"); // gitleaks:allow
    expect(checkWebhookSecret(null)).toBe("mismatch");
  });

  it("panjang berbeda → mismatch, bukan melempar", () => {
    // `timingSafeEqual` MELEMPAR bila panjang buffer berbeda; tanpa penjaga
    // panjang, satu header pendek akan menjadi 500 alih-alih 401.
    vi.stubEnv("PAKASIR_WEBHOOK_SECRET", "rahasia-panjang-sekali"); // gitleaks:allow
    expect(() => checkWebhookSecret("x")).not.toThrow();
    expect(checkWebhookSecret("x")).toBe("mismatch");
  });

  it("perbandingan tak sensitif terhadap urutan byte yang mirip", () => {
    vi.stubEnv("PAKASIR_WEBHOOK_SECRET", "abcdef"); // gitleaks:allow
    expect(checkWebhookSecret("abcdeg")).toBe("mismatch");
    expect(checkWebhookSecret("bbcdef")).toBe("mismatch");
  });
});

import { describe, expect, it } from "vitest";

import { MASA_BERLAKU_QR_MS } from "@/lib/payment/binderpay";
import { qrisUntukOrder } from "@/server/payment/qris";

/**
 * QR di halaman bayar kita (DECISIONS #99). Halaman tak boleh menampilkan QR
 * yang tak bisa lagi menghasilkan aktivasi: order yang bukan `pending`, atau
 * QR yang masa berlakunya habis.
 */

const DIBUAT = "2026-10-31T01:00:00.000Z";
const T0 = Date.parse(DIBUAT);
const ORDER = {
  status: "pending",
  qr_content: "00020101021126580011IDfe3383a9",
  created_at: DIBUAT,
};

describe("qrisUntukOrder", () => {
  it("order pending dengan QR yang masih berlaku → PNG + batas berlaku WIB", async () => {
    const qr = await qrisUntukOrder(ORDER, T0 + 60_000);
    expect(qr?.png).toMatch(/^data:image\/png;base64,/);
    // 01:00Z + 23 jam = 00:00Z keesokan hari = 07:00 WIB.
    expect(qr?.berlakuSampai).toContain("07.00");
  });

  it.each([
    ["sudah lunas", { ...ORDER, status: "paid" }],
    ["sudah di-expire", { ...ORDER, status: "expired" }],
    [
      "tanpa QR (Pakasir: halaman bayar hosted)",
      { ...ORDER, qr_content: null },
    ],
  ])("%s → null", async (_l, order) => {
    expect(await qrisUntukOrder(order, T0 + 60_000)).toBeNull();
  });

  it("tepat saat QR mati → null; sedetik sebelumnya → masih tampil", async () => {
    expect(await qrisUntukOrder(ORDER, T0 + MASA_BERLAKU_QR_MS)).toBeNull();
    expect(
      await qrisUntukOrder(ORDER, T0 + MASA_BERLAKU_QR_MS - 1000),
    ).not.toBeNull();
  });
});

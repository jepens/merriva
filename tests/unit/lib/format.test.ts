import { describe, expect, it } from "vitest";

import { formatIdr, formatPaymentMethod } from "@/lib/format";

describe("formatIdr", () => {
  it("memformat ribuan gaya Indonesia dengan prefiks Rp", () => {
    expect(formatIdr(99000)).toBe("Rp99.000");
    expect(formatIdr(199000)).toBe("Rp199.000");
    expect(formatIdr(0)).toBe("Rp0");
    expect(formatIdr(1500000)).toBe("Rp1.500.000");
  });

  it("membulatkan ke bawah (integer IDR) & aman untuk nilai tak wajar", () => {
    expect(formatIdr(99000.9)).toBe("Rp99.000");
    expect(formatIdr(Number.NaN)).toBe("Rp0");
    expect(formatIdr(Number.POSITIVE_INFINITY)).toBe("Rp0");
  });
});

/**
 * `orders.payment_method` menyimpan nilai MENTAH dari Pakasir dan BOLEH null
 * walau ordernya lunas. Dua invarian yang dikunci di sini: helper ini tak pernah
 * mengarang label untuk channel yang belum pernah kita lihat (pada bukti
 * pembayaran, kode vendor lebih jujur daripada tebakan), dan tak pernah
 * mencetak string "null" ke layar pelanggan.
 */
describe("formatPaymentMethod", () => {
  const labels = { qris: "QRIS", manual: "Dicatat manual oleh tim Merriva" };

  it("nilai kosong dalam bentuk apa pun → null, bukan teks", () => {
    expect(formatPaymentMethod(null, labels)).toBeNull();
    expect(formatPaymentMethod(undefined, labels)).toBeNull();
    expect(formatPaymentMethod("", labels)).toBeNull();
    expect(formatPaymentMethod("   ", labels)).toBeNull();
  });

  it("mencocokkan label tanpa peduli besar-kecil huruf", () => {
    expect(formatPaymentMethod("qris", labels)).toBe("QRIS");
    expect(formatPaymentMethod("QRIS", labels)).toBe("QRIS");
    expect(formatPaymentMethod(" QrIs ", labels)).toBe("QRIS");
    expect(formatPaymentMethod("manual", labels)).toBe(
      "Dicatat manual oleh tim Merriva",
    );
  });

  it("channel tak dikenal DITERUSKAN apa adanya — tak pernah dikarang", () => {
    expect(formatPaymentMethod("va_bca", labels)).toBe("va_bca");
    expect(formatPaymentMethod("gopay", labels)).toBe("gopay");
    // Peta kosong pun tak boleh menghasilkan "undefined".
    expect(formatPaymentMethod("qris", {})).toBe("qris");
  });
});

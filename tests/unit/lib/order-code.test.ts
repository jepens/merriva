import { describe, expect, it } from "vitest";

import { generateOrderCode } from "@/lib/order";
import { ORDER_CODE_RE, orderCodeSchema } from "@/lib/validation/order";

/**
 * Kode order adalah kunci halaman kuitansi (`/dashboard/pesanan/[kode]`) dan
 * satu-satunya pegangan pelanggan saat mengajukan refund. Dua sumber
 * kebenarannya hidup di berkas terpisah — generator di `lib/order.ts`, penjaga
 * bentuk di `lib/validation/order.ts` — jadi yang dikunci di sini adalah bahwa
 * keduanya tidak bisa menyimpang diam-diam.
 */

describe("orderCodeSchema", () => {
  it("menerima SELURUH keluaran generator (alfabet & panjang tak menyimpang)", () => {
    for (let i = 0; i < 300; i += 1) {
      const kode = generateOrderCode();
      expect(kode, `kode ke-${i}`).toMatch(ORDER_CODE_RE);
      expect(orderCodeSchema.safeParse(kode).success).toBe(true);
    }
  });

  it("menolak kode 5 karakter — fixture lama beredar dan menyesatkan", () => {
    // `"MRV-8F3K2"` dipakai di fixture test email; menyalinnya ke sini akan
    // menghasilkan penolakan yang TAMPAK seperti bug di kode, padahal
    // fixture-nya yang kurang satu karakter (CODE_LEN = 6).
    expect(orderCodeSchema.safeParse("MRV-8F3K2").success).toBe(false);
  });

  it("menolak karakter ambigu yang sengaja tak ada di alfabet", () => {
    // O/0 dan I/1 dibuang justru agar kode bisa diketik ulang dari kuitansi
    // cetak tanpa salah baca.
    for (const kode of [
      "MRV-OOOOOO",
      "MRV-000000",
      "MRV-IIIIII",
      "MRV-111111",
    ]) {
      expect(orderCodeSchema.safeParse(kode).success, kode).toBe(false);
    }
  });

  it("menolak bentuk lain, termasuk yang berbahaya bila diteruskan ke query", () => {
    for (const kode of [
      "",
      "mrv-abcdef",
      "MRV8F3K2Q",
      "MRVX-8F3K2Q",
      "MRV-8F3K2Q7",
      "DROP TABLE orders",
      "MRV-8F3K2Q' or '1'='1",
      `MRV-${"A".repeat(40)}`,
    ]) {
      expect(
        orderCodeSchema.safeParse(kode).success,
        JSON.stringify(kode),
      ).toBe(false);
    }
  });
});

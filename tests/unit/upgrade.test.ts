import { describe, expect, it } from "vitest";

import { BASIC_LIMITS } from "@/lib/limits";
import {
  daysUntil,
  upgradeDifference,
  upgradeOptions,
  type UpgradeCandidate,
} from "@/lib/upgrade";

/**
 * Hitungan upgrade paket (AUDIT-2026-10-01 B3).
 *
 * Yang dijaga di sini adalah GERBANG UANG, bukan aritmetika: angka yang
 * dikembalikan fungsi-fungsi ini menjadi `orders.amount_idr` dan sekaligus
 * angka yang dipampang di halaman upgrade. Satu `>=` yang seharusnya `>` cukup
 * untuk membuat payment link Pakasir sebesar Rp0, dan satu tanda yang terbalik
 * cukup untuk menjual Premium seharga minus.
 */

const paket = (code: string, priceIdr: number): UpgradeCandidate => ({
  code,
  name: code,
  priceIdr,
  durationMonths: 6,
  limits: BASIC_LIMITS,
});

describe("upgradeDifference", () => {
  it("selisih harga untuk kenaikan yang sah", () => {
    expect(upgradeDifference(99_000, 199_000)).toBe(100_000);
  });

  it("paket yang SAMA bukan upgrade → null, bukan 0", () => {
    // Order Rp0 akan membuat payment link Pakasir tanpa makna, dan RPC-nya
    // mencocokkan `amount_idr` — webhook ber-amount 0 akan "cocok" dengan apa
    // pun yang juga 0.
    expect(upgradeDifference(199_000, 199_000)).toBeNull();
  });

  it("penurunan paket ditolak, bukan dibalik tandanya", () => {
    // Tanpa ini nominalnya negatif dan baru ditolak `amount_idr >= 0` di DB,
    // yaitu SETELAH pelanggan dialihkan ke halaman pembayaran.
    expect(upgradeDifference(199_000, 99_000)).toBeNull();
  });

  it("tier gratis sebagai paket sekarang tetap menghasilkan selisih penuh", () => {
    expect(upgradeDifference(0, 199_000)).toBe(199_000);
  });

  it("nominal pecahan & negatif ditolak — uang di produk ini integer IDR", () => {
    expect(upgradeDifference(99_000.5, 199_000)).toBeNull();
    expect(upgradeDifference(99_000, 199_000.99)).toBeNull();
    expect(upgradeDifference(-1, 199_000)).toBeNull();
    expect(upgradeDifference(99_000, -1)).toBeNull();
    expect(upgradeDifference(Number.NaN, 199_000)).toBeNull();
    expect(upgradeDifference(99_000, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("upgradeOptions", () => {
  it("hanya paket yang lebih mahal, termurah selisihnya dulu", () => {
    const options = upgradeOptions(99_000, [
      paket("premium", 199_000),
      paket("basic", 99_000),
      paket("plus", 149_000),
    ]);
    expect(options.map((o) => o.code)).toEqual(["plus", "premium"]);
    expect(options.map((o) => o.differenceIdr)).toEqual([50_000, 100_000]);
  });

  it("paket sekarang tersaring tanpa membandingkan kode", () => {
    // Penyaringnya selisih, bukan `code`: dua paket berharga sama tak boleh
    // pernah ditawarkan sebagai "upgrade" satu terhadap yang lain — pelanggan
    // akan membayar Rp0 untuk kenaikan yang tak ada.
    const options = upgradeOptions(199_000, [
      paket("premium", 199_000),
      paket("premium-lama", 199_000),
    ]);
    expect(options).toEqual([]);
  });

  it("sudah di paket tertinggi → tak ada pilihan", () => {
    const options = upgradeOptions(199_000, [
      paket("basic", 99_000),
      paket("premium", 199_000),
    ]);
    expect(options).toEqual([]);
  });

  it("katalog kosong tak melempar", () => {
    expect(upgradeOptions(99_000, [])).toEqual([]);
  });
});

describe("daysUntil", () => {
  const now = Date.parse("2026-10-04T12:00:00.000Z");

  it("sisa hari dibulatkan KE ATAS", () => {
    // Pelanggan dengan sisa 30 jam melihat "2 hari", bukan "1" — membulatkan ke
    // bawah membuat produk terdengar lebih buruk daripada kenyataannya.
    expect(daysUntil("2026-10-06T18:00:00.000Z", now)).toBe(3);
    expect(daysUntil("2026-10-05T18:00:00.000Z", now)).toBe(2);
  });

  it("tepat hari ini → 0, bukan negatif", () => {
    expect(daysUntil("2026-10-04T12:00:00.000Z", now)).toBe(0);
    expect(daysUntil("2026-10-01T12:00:00.000Z", now)).toBe(0);
  });

  it("tanpa masa aktif / tak terbaca → null, bukan 0", () => {
    // 0 akan tampil sebagai "berakhir hari ini" — klaim yang tak bisa
    // dipastikan dari data yang tak ada.
    expect(daysUntil(null, now)).toBeNull();
    expect(daysUntil("bukan tanggal", now)).toBeNull();
  });
});

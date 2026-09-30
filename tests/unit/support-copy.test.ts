import { describe, expect, it } from "vitest";

import { copy } from "@/lib/copy";

/**
 * Invarian teks untuk saluran dukungan & riwayat pesanan (AUDIT-2026-10-01
 * A4/A5). Yang dikunci di sini bukan kata-katanya, melainkan tiga hal yang
 * dulu salah dan mudah kembali salah tanpa terasa.
 */

describe("copy.support — satu alamat untuk seluruh produk", () => {
  it("alamat dukungan sama dengan alamat kontak legal", () => {
    // Dulu `halo@merriva.id` ditulis literal di satu tempat saja. Begitu ada
    // tempat kedua, alamat bisa bercabang diam-diam: pelanggan membaca satu
    // alamat di /privasi dan alamat lain di dashboard.
    expect(copy.support.email).toBe(copy.marketing.legal.contactEmail);
    expect(copy.support.email).toContain("@");
  });

  it("subject & body mailto memuat kode order saat kodenya ada", () => {
    const kode = "MRV-8F3K2Q";
    expect(copy.support.mailSubjectOrder(kode)).toContain(kode);
    expect(copy.support.mailBodyOrder(kode)).toContain(kode);
    // Varian tanpa kode tak boleh menyebut kode sama sekali.
    expect(copy.support.mailSubject).not.toContain("order ");
  });
});

describe("kartu pembayaran tertahan tak lagi menyuruh tanpa memberi alamat", () => {
  /**
   * Cacat A5 yang sebenarnya: kalimat "Hubungi kami" muncul TEPAT di layar yang
   * tampil saat uang pelanggan sudah keluar tetapi undangannya belum aktif —
   * tanpa satu pun alamat di halaman itu. Alamatnya kini dirender
   * `SupportContact`, jadi kalimat yang menyuruh tanpa alamat harus hilang dan
   * tidak boleh kembali.
   */
  const menyuruh = /hubungi kami\.?$|hubungi kami bila butuh bantuan/i;

  it("paymentStatus.reviewBody tak lagi menggantung", () => {
    expect(copy.paymentStatus.reviewBody).not.toMatch(menyuruh);
  });

  it("momen.payment.reviewBody tak menyuruh menyebut kode yang tak ada di layar", () => {
    // State `error` pada poller tidak merender ringkasan order, jadi teksnya
    // tak boleh menunjuk "kode pesanan di atas".
    expect(copy.momen.payment.reviewBody).not.toContain("di atas");
  });
});

describe("copy.dashboard.orders", () => {
  it("setiap nilai enum order_status punya label pelanggan", () => {
    // Drift tertangkap bila enum bertambah: label admin adalah satu-satunya
    // daftar lengkap yang sudah ada di produk.
    expect(Object.keys(copy.dashboard.orders.statusLabel).sort()).toEqual(
      Object.keys(copy.admin.orderStatusLabel).sort(),
    );
  });

  it("label pelanggan TIDAK memakai nada operasional milik admin", () => {
    // Blok admin dipakai dropdown filter di /admin/order; memindahkannya akan
    // mematikan dropdown itu tanpa satu pun galat TypeScript.
    expect(copy.dashboard.orders.statusLabel).not.toBe(
      copy.admin.orderStatusLabel,
    );
    expect(copy.dashboard.orders.statusLabel.refunded).toBe(
      "Dana dikembalikan",
    );
  });

  it("methodLabel hanya memuat channel yang benar-benar diketahui", () => {
    // Menambah tebakan di sini membuat `formatPaymentMethod` berhenti
    // meneruskan nilai mentah, dan kuitansi mulai menampilkan label karangan.
    expect(Object.keys(copy.dashboard.orders.methodLabel).sort()).toEqual([
      "manual",
      "qris",
    ]);
  });

  it("kebijakan refund menunjukkan DI MANA kode order bisa dilihat", () => {
    const cara = copy.marketing.legal.refund.sections
      .flatMap((s) => s.body)
      .join(" ");
    expect(cara).toContain("kode order");
    expect(cara).toContain("Pesanan");
  });
});

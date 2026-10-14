import { describe, expect, it } from "vitest";

import { copy } from "@/lib/copy";
import { merchantIdentityReady } from "@/lib/merchant";

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

describe("404 dashboard memakai nada PEMILIK, bukan tamu", () => {
  it("teks pemilik tak menyiratkan undangannya mati", () => {
    // Teks 404 global ditulis untuk TAMU ("undangannya sudah tidak aktif") dan
    // menanamkan kecemasan palsu saat pemilik sekadar salah menyalin id.
    expect(copy.notFoundPage.ownerBody).not.toContain("tidak aktif");
    expect(copy.notFoundPage.ownerBody).toContain("tidak terpengaruh");
  });

  it("CTA mengembalikan pemilik ke pekerjaannya, bukan ke halaman jualan", () => {
    expect(copy.notFoundPage.cta).toContain("beranda");
    expect(copy.notFoundPage.ownerCta).toContain("daftar undangan");
  });
});

describe("Syarat & Ketentuan mencerminkan perilaku kode, bukan sebaliknya", () => {
  const t = copy.marketing.legal.terms;
  const teks = t.sections
    .flatMap((s) => [s.heading, ...s.body])
    .join(" ")
    .toLowerCase();

  it("menyebut retensi 6 bulan yang benar-benar dijalankan cron purge", () => {
    // Klausul yang tak cocok dengan kode adalah masalah yang lebih besar
    // daripada tak punya klausul — pelajaran dari /privasi (DECISIONS #58).
    expect(teks).toContain("enam bulan");
    expect(teks).toContain("dihapus permanen");
  });

  it("menyebut penangguhan konten — hak yang adminSuspendInvitation sudah jalankan", () => {
    expect(teks).toContain("menangguhkan");
  });

  it("membatasi tanggung jawab sebesar yang dibayarkan", () => {
    // Keputusan pemilik 2026-10-03. Tanpa batas tertulis, acara pernikahan yang
    // gagal adalah kerugian yang bisa dinilai sangat besar.
    expect(teks).toContain("sebesar biaya paket yang anda bayarkan");
    expect(teks).toContain("kerugian tidak langsung");
  });

  it("tidak mengurangi hak konsumen yang dijamin undang-undang", () => {
    // Klausul pembatas yang mengklaim meniadakan hak memaksa justru batal
    // demi hukum dan melemahkan seluruh dokumen.
    expect(teks).toContain("bersifat memaksa");
  });

  it("merujuk Kebijakan Refund sebagai bagian tak terpisahkan", () => {
    expect(teks).toContain("kebijakan refund");
  });

  it("identitas penjual punya SATU sumber, dipakai seluruh halaman legal", () => {
    const m = copy.marketing.legal.merchant;
    expect(Object.keys(m).sort()).toEqual([
      "address",
      "form",
      "name",
      "owner",
      "taxId",
    ]);
    expect(m.form).toBe("Usaha perseorangan");
  });

  it("identitas pelaku usaha TERISI — nama & alamat, minimum PP 80/2019", () => {
    // Diisi 15 Okt 2026. Ratchet, bukan sekadar pemeriksaan: begitu terisi, ia
    // tak boleh kembali kosong tanpa ada yang tahu — `createCheckoutAction`
    // bergantung padanya (DECISIONS #88), jadi mengosongkannya berarti
    // mematikan tombol bayar di produksi tanpa satu pun galat yang menunjuk
    // ke sini.
    expect(merchantIdentityReady()).toBe(true);
    const m = copy.marketing.legal.merchant as Record<string, string>;
    expect(m.name.trim()).not.toBe("");
    expect(m.address.trim()).not.toBe("");
  });
});

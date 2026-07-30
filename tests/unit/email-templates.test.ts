import { describe, expect, it } from "vitest";

import {
  escapeHtml,
  renderExpiryReminderEmail,
  renderReceiptEmail,
} from "@/lib/email/templates";

describe("escapeHtml", () => {
  it("meng-escape karakter HTML berbahaya", () => {
    expect(escapeHtml(`<script>&"'`)).toBe("&lt;script&gt;&amp;&quot;&#39;");
  });
});

describe("renderReceiptEmail", () => {
  const base = {
    name: "Andi",
    packageName: "Basic",
    amountIdr: 99000,
    orderCode: "MRV-8F3K2",
    paidAtLabel: "30 Januari 2027, 14.00 WIB",
    activeUntilLabel: "30 Juli 2027",
    invitationUrl: "https://merriva.id/andi-sinta",
  };

  it("subject tetap; html memuat nominal terformat, kode order, link, & paket", () => {
    const r = renderReceiptEmail(base);
    expect(r.subject).toBe("Pembayaran berhasil — undangan Anda kini aktif");
    expect(r.html).toContain("Rp99.000");
    expect(r.html).toContain("MRV-8F3K2");
    expect(r.html).toContain("https://merriva.id/andi-sinta");
    expect(r.html).toContain("Basic");
    expect(r.html).toContain("Halo Andi,");
    // tombol CTA menaut ke undangan
    expect(r.html).toContain('href="https://merriva.id/andi-sinta"');
  });

  it("text plain memuat info inti + URL", () => {
    const r = renderReceiptEmail(base);
    expect(r.text).toContain("Rp99.000");
    expect(r.text).toContain("MRV-8F3K2");
    expect(r.text).toContain("https://merriva.id/andi-sinta");
    expect(r.text).toContain("30 Januari 2027, 14.00 WIB");
  });

  it("tanpa nama → sapaan generik; tanpa paidAt/activeUntil → baris dihilangkan", () => {
    const r = renderReceiptEmail({
      ...base,
      name: null,
      paidAtLabel: null,
      activeUntilLabel: null,
    });
    expect(r.html).toContain("Halo,");
    expect(r.html).not.toContain("Tanggal bayar");
    expect(r.html).not.toContain("Aktif hingga");
  });

  it("meng-escape nama pengguna (cegah injeksi HTML)", () => {
    const r = renderReceiptEmail({ ...base, name: "<b>x</b>" });
    expect(r.html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(r.html).not.toContain("<b>x</b>");
  });
});

describe("renderExpiryReminderEmail", () => {
  const base = {
    name: "Sinta",
    daysLeft: 14,
    activeUntilLabel: "30 Juli 2027",
    invitationUrl: "https://merriva.id/andi-sinta",
    renewUrl: "https://merriva.id/dashboard/undangan/abc/aktifkan",
  };

  it("subject menyebut jumlah hari; html memuat tautan perpanjang & lihat", () => {
    const r = renderExpiryReminderEmail(base);
    expect(r.subject).toBe("Masa aktif undangan berakhir dalam 14 hari");
    expect(r.html).toContain("14 hari");
    expect(r.html).toContain("30 Juli 2027");
    expect(r.html).toContain(
      'href="https://merriva.id/dashboard/undangan/abc/aktifkan"',
    );
    expect(r.html).toContain('href="https://merriva.id/andi-sinta"');
  });

  it("text plain memuat kedua URL", () => {
    const r = renderExpiryReminderEmail(base);
    expect(r.text).toContain(
      "https://merriva.id/dashboard/undangan/abc/aktifkan",
    );
    expect(r.text).toContain("https://merriva.id/andi-sinta");
  });
});

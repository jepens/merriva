import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SupportContact } from "@/components/support-contact";
import { copy } from "@/lib/copy";

/**
 * Kontak dukungan (AUDIT-2026-10-01 A5). Dua sifat yang dikunci di sini gampang
 * hilang saat seseorang "merapikan" komponen ini nanti:
 *
 *  1. Alamatnya harus ada sebagai TEKS, bukan hanya di atribut `href`. Halaman
 *     ini banyak dibuka dari WebView WhatsApp, tempat `mailto:` sering tidak
 *     membuka aplikasi apa pun — tanpa teks yang bisa disalin, pelanggan yang
 *     panik hanya menekan tombol yang diam.
 *  2. Kode order harus masuk mailto, karena state `error` pada poller tidak
 *     merender ringkasan order sehingga kodenya belum tentu ada di layar,
 *     sementara kebijakan refund mewajibkan pelanggan menyebutkannya.
 */

afterEach(cleanup);

const EMAIL = copy.support.email;

function anchor(): HTMLAnchorElement {
  const a = document.querySelector<HTMLAnchorElement>('a[href^="mailto:"]');
  if (!a) throw new Error("tautan mailto tidak ditemukan");
  return a;
}

describe("SupportContact", () => {
  it("merender alamat sebagai teks yang bisa dipilih, bukan hanya href", () => {
    render(<SupportContact />);

    // Bukan `getByRole("link")` — itu lolos walau alamatnya cuma di href.
    const teks = screen.getAllByText(EMAIL);
    expect(teks.length).toBeGreaterThan(0);
    expect(
      teks.some(
        (el) => el.tagName === "SPAN" && el.className.includes("select-all"),
      ),
    ).toBe(true);
  });

  it("kode order masuk ke SUBJECT dan BODY mailto, ter-encode", () => {
    const kode = "MRV-8F3K2Q";
    render(<SupportContact orderCode={kode} />);

    const href = anchor().getAttribute("href")!;
    expect(href.startsWith(`mailto:${EMAIL}?`)).toBe(true);

    const url = new URL(href);
    expect(url.searchParams.get("subject")).toBe(
      copy.support.mailSubjectOrder(kode),
    );
    expect(url.searchParams.get("body")).toBe(copy.support.mailBodyOrder(kode));
    // Teks pendukung ikut berubah: ia meminta pelanggan menyebut kodenya.
    expect(screen.getByText(copy.support.bodyWithOrder)).toBeTruthy();
  });

  it("orderCode kosong diperlakukan sama dengan tanpa kode", () => {
    // `bayar/page.tsx` mengirim `order?.order_code ?? ""` — bila string kosong
    // diteruskan begitu saja, subject menjadi "… — order " yang menggantung.
    render(<SupportContact orderCode="" />);

    const href = anchor().getAttribute("href")!;
    expect(href).not.toContain("undefined");
    expect(href).not.toContain("null");

    const url = new URL(href);
    expect(url.searchParams.get("subject")).toBe(copy.support.mailSubject);
    expect(screen.getByText(copy.support.body)).toBeTruthy();
    expect(screen.queryByText(copy.support.bodyWithOrder)).toBeNull();
  });

  it("spasi saja pada orderCode juga dianggap tanpa kode", () => {
    render(<SupportContact orderCode="   " />);
    const url = new URL(anchor().getAttribute("href")!);
    expect(url.searchParams.get("subject")).toBe(copy.support.mailSubject);
  });

  it('variant "line" merender satu paragraf beranchor, tanpa tombol', () => {
    render(<SupportContact variant="line" />);

    expect(
      screen.getByText(copy.support.footerLine, { exact: false }),
    ).toBeTruthy();
    expect(screen.queryByText(copy.support.cta)).toBeNull();
    expect(anchor().textContent).toBe(EMAIL);
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GuestPrivacyNote } from "@/components/public/guest-privacy-note";
import { copy } from "@/lib/copy";

/**
 * Pemberitahuan privasi di TITIK PENGUMPULAN data tamu (AUDIT-2026-10-01).
 *
 * Subjek data terbesar produk ini bukan pelanggan, melainkan pihak ketiga:
 * ratusan tamu per undangan yang menyerahkan nama, nomor WhatsApp, ucapan, dan
 * — di Album Momen — foto wajahnya, tanpa pernah punya hubungan apa pun dengan
 * Merriva. Sebelum ini tak satu pun formulir publik menyebut ke mana data itu
 * pergi; `/privasi` hanya tertaut dari footer halaman marketing yang takkan
 * pernah tamu buka.
 */

afterEach(cleanup);

describe("GuestPrivacyNote", () => {
  it("menyebut TUAN RUMAH sebagai pengelola, bukan Merriva", () => {
    render(<GuestPrivacyNote />);

    // Tuan rumahlah pengendali datanya; Merriva hanya pemroses. Teks yang
    // menyebut Merriva lebih dulu akan salah secara hukum DAN menyesatkan tamu
    // soal kepada siapa ia harus meminta penghapusan.
    expect(
      screen.getByText(copy.guestPrivacy.note, { exact: false }),
    ).toBeTruthy();
    expect(copy.guestPrivacy.note).toContain("tuan rumah");
  });

  it("menaut kebijakan privasi ke tab baru, tanpa membocorkan halaman asal", () => {
    render(<GuestPrivacyNote />);

    const a = screen.getByRole("link", { name: copy.guestPrivacy.link });
    expect(a.getAttribute("href")).toBe("/privasi");
    // Tab baru: tamu yang sedang mengisi RSVP tak boleh kehilangan isiannya.
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toContain("noopener");
  });

  it("bukan tautan next/link — halaman undangan punya anggaran bundel", () => {
    render(<GuestPrivacyNote />);

    // `next/link` mem-prefetch tujuannya; mem-prefetch halaman marketing dari
    // halaman undangan membebani tamu tanpa manfaat apa pun bagi mereka.
    const a = screen.getByRole("link", { name: copy.guestPrivacy.link });
    expect(a.tagName).toBe("A");
    expect(a.hasAttribute("data-prefetch")).toBe(false);
  });
});

describe("kebijakan privasi mencerminkan apa yang BENAR-BENAR dikumpulkan", () => {
  const teks = copy.marketing.legal.privacy.sections
    .flatMap((s) => [s.heading, ...s.body])
    .join(" ")
    .toLowerCase();

  it("menyebut foto Album Momen dan pengenal perangkat tamu", () => {
    // `momen_photos` menyimpan guest_name, device_id (UUID localStorage), dan
    // path foto. Tak satu pun disebut sebelum audit ini.
    expect(teks).toContain("album momen");
    expect(teks).toContain("pengenal perangkat");
    expect(teks).toContain("wajah");
  });

  it("menyebut tempat data diproses (transfer lintas negara)", () => {
    expect(teks).toContain("singapura");
    expect(teks).toContain("luar indonesia");
  });

  it("menyatakan dasar pemrosesan, bukan menjanjikan tarik persetujuan", () => {
    // Dulu kebijakan menjanjikan hak "menarik persetujuan" padahal tak ada
    // persetujuan yang pernah dikumpulkan — klaim yang justru melemahkan posisi
    // hukumnya sendiri.
    expect(teks).toContain("dasar pemrosesan");
    expect(teks).toContain("pelaksanaan perjanjian");
    expect(teks).not.toContain("menarik persetujuan");
  });

  it("membagi peran pengendali/pemroses, tak hanya melimpahkan ke pengguna", () => {
    expect(teks).toContain("pengendali data");
    expect(teks).toContain("pemroses");
  });

  it("menyebut Sentry sebagai pemroses beserta penyaringannya", () => {
    expect(teks).toContain("sentry");
    expect(teks).toContain("token tamu");
  });
});

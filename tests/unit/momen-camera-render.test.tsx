import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Smoke test render `MomenCamera` — penjaga regresi KUA-1
 * (AUDIT-2026-09-04): kelas layar pernah dirangkai lewat template literal
 * `${on ? " mn-on" : ""}`, lalu prettier-plugin-tailwindcss membuang spasi di
 * awal string kondisional sehingga class menyatu ("mn-masukmn-on"),
 * `.mn-screen.mn-on` tak pernah cocok, dan SELURUH halaman kamera tamu render
 * kosong (`display:none`) — fitur berbayar tidak dapat dipakai sama sekali,
 * tanpa satu pun test merah.
 *
 * Yang di-assert di sini adalah TOKEN kelas (`classList.contains`), bukan string
 * className, supaya penyatuan class pasti tertangkap.
 */

// Server Actions tak boleh benar-benar dimuat di jsdom (next/headers, supabase
// service_role, Turnstile). Komponen hanya perlu referensi fungsinya.
vi.mock("@/server/actions/momen-guest", () => ({
  startMomenSessionAction: vi.fn(),
  uploadMomenPhotoAction: vi.fn(),
}));

import { MomenCamera } from "@/components/public/momen/momen-camera";

afterEach(cleanup);

const baseProps = {
  slug: "andi-sinta",
  quotaPerGuest: 5,
  defaultFilter: "hangat",
  allowLibraryUpload: true,
  revealAtIso: null,
  heroTitle: "Andi & Sinta",
  dateLabel: "Sabtu, 12 Des 2026",
  // null → widget Turnstile tak dirender (tak ada skrip eksternal di test).
  turnstileSiteKey: null,
  initialPhotos: [],
  // Galeri ber-paginasi (PER-4): kursor null = tak ada halaman berikutnya.
  initialCursor: null,
  totalPhotos: 0,
  photographers: 0,
};

function screens(root: HTMLElement) {
  return {
    masuk: root.querySelector(".mn-masuk"),
    kamera: root.querySelector(".mn-kamera"),
    habis: root.querySelector(".mn-habis"),
    galeri: root.querySelector(".mn-galeri"),
  };
}

describe("MomenCamera — kelas layar (regresi KUA-1)", () => {
  it("layar masuk aktif: token `mn-on` ADA dan terpisah dari `mn-masuk`", () => {
    const { container } = render(<MomenCamera {...baseProps} />);
    const s = screens(container);

    expect(s.masuk).not.toBeNull();
    // Inti regresi: `mn-on` harus token tersendiri, bukan tersambung.
    expect(s.masuk!.classList.contains("mn-screen")).toBe(true);
    expect(s.masuk!.classList.contains("mn-masuk")).toBe(true);
    expect(s.masuk!.classList.contains("mn-on")).toBe(true);
  });

  it("hanya SATU layar yang aktif; sisanya tanpa `mn-on`", () => {
    const { container } = render(<MomenCamera {...baseProps} />);
    const s = screens(container);

    expect(s.kamera!.classList.contains("mn-on")).toBe(false);
    expect(s.habis!.classList.contains("mn-on")).toBe(false);
    expect(s.galeri!.classList.contains("mn-on")).toBe(false);
    expect(container.querySelectorAll(".mn-screen.mn-on")).toHaveLength(1);
  });

  it("tak ada class menyatu (`mn-masukmn-on` dsb.) di seluruh pohon", () => {
    const { container } = render(<MomenCamera {...baseProps} />);
    for (const el of container.querySelectorAll("[class]")) {
      for (const token of el.classList) {
        // Dua nama kelas ber-prefix `mn-` yang menempel = gejala bug ini.
        expect(token).not.toMatch(/^mn-.+mn-/);
      }
    }
  });

  it("chip filter & pip jatah memakai token terpisah", () => {
    const { container } = render(<MomenCamera {...baseProps} />);

    // Filter bawaan "hangat" harus tertandai terpilih.
    expect(container.querySelectorAll(".mn-fchip.mn-on")).toHaveLength(1);
    // Belum ada jepretan → tak ada pip terpakai, tetapi pip-nya tetap sebanyak jatah.
    expect(container.querySelectorAll(".mn-pip")).toHaveLength(
      baseProps.quotaPerGuest,
    );
    expect(container.querySelectorAll(".mn-pip.mn-used")).toHaveLength(0);
  });

  it("lightbox tertutup: `.mn-lightbox` ada tetapi tanpa `mn-on`", () => {
    const { container } = render(<MomenCamera {...baseProps} />);
    const lb = container.querySelector(".mn-lightbox");

    expect(lb).not.toBeNull();
    expect(lb!.classList.contains("mn-on")).toBe(false);
  });
});

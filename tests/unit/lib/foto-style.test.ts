import { describe, expect, it } from "vitest";

import { fotoStyle } from "@/themes/_shared/foto";

/**
 * Gaya foto bernama — SATU helper untuk sepuluh tema (THEME-CONTRACT §3).
 *
 * Bingkai penyesuaian di editor memakai helper yang sama persis, jadi inilah
 * yang membuat "yang dilihat pemilik = yang dilihat tamu" benar. Begitu
 * keduanya berbeda, pemilik mengatur framing terhadap pratinjau yang berbohong.
 */

describe("titik fokus", () => {
  it("dipetakan ke objectPosition DAN transformOrigin", () => {
    // Keduanya harus sama. Bila transformOrigin tertinggal di tengah,
    // memperbesar menarik gambar ke arah tengah wadah dan wajah yang sudah
    // dibidik justru bergeser keluar.
    const s = fotoStyle({ x: 0.25, y: 0.8, zoom: 1.6 });
    expect(s.objectPosition).toBe("25% 80%");
    expect(s.transformOrigin).toBe("25% 80%");
  });

  it("tengah = 50% 50%", () => {
    expect(fotoStyle({ x: 0.5, y: 0.5, zoom: 1 }).objectPosition).toBe(
      "50% 50%",
    );
  });

  it("sudut tetap dalam 0–100%", () => {
    expect(fotoStyle({ x: 0, y: 1, zoom: 1 }).objectPosition).toBe("0% 100%");
  });
});

describe("perbesaran", () => {
  it("zoom 1 TIDAK memancarkan transform", () => {
    // `scale(1)` membuat lapisan komposit baru tanpa guna, di halaman yang
    // mengejar LCP < 2,5 dtk dan sering dibuka di WebView WhatsApp.
    expect(fotoStyle({ x: 0.5, y: 0.5, zoom: 1 }).transform).toBeUndefined();
  });

  it("zoom 1: kuncinya HILANG, bukan bernilai undefined", () => {
    // Bedanya tak terlihat di peramban — React mengabaikan keduanya. Tetapi
    // helper ini dipakai juga oleh `/api/og`, dan satori MELEMPAR pada
    // `transform: undefined` ("Invalid `transform` value"). Karena `zoom: 1`
    // adalah bawaan setiap foto yang baru diunggah, bentuk yang salah membuat
    // pratinjau tautan gagal 500 justru pada kasus yang paling sering.
    const s = fotoStyle({ x: 0.5, y: 0.5, zoom: 1 });
    expect(Object.keys(s)).not.toContain("transform");
    expect(Object.keys(s)).not.toContain("transformOrigin");
    // Dan tak satu pun kunci lain boleh bernilai undefined, dengan alasan sama.
    expect(Object.values(s).every((v) => v !== undefined)).toBe(true);
  });

  it("zoom > 1 memancarkan scale", () => {
    expect(fotoStyle({ x: 0.5, y: 0.5, zoom: 2.5 }).transform).toBe(
      "scale(2.5)",
    );
  });
});

describe("pemangkasan", () => {
  it("selalu `cover` — wadah tema tak boleh terisi sebagian", () => {
    // Dengan `contain`, wadah berbentuk lengkung/oval akan memperlihatkan pita
    // kosong di tepi dan bentuk khas temanya rusak.
    expect(fotoStyle({ x: 0.5, y: 0.5, zoom: 1 }).objectFit).toBe("cover");
  });
});

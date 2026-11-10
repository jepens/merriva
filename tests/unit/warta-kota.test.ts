import { describe, expect, it } from "vitest";

import { kotaDari } from "@/themes/warta/kota";

/**
 * Dateline koran tema `warta` ("Reported from …", "Printed in …", ticker
 * sampul) menyebut kota dari alamat acara pertama. Lebih baik tak menyebut kota
 * daripada mencetak "Lt." atau sepotong nama jalan — daftar ini dari tinjauan
 * 10 Nov 2026 (alamat realistis Indonesia yang dulu lolos keliru).
 */
describe("kotaDari", () => {
  it.each([
    ["Jl. Prawirotaman No. 21, Yogyakarta", "Yogyakarta"],
    ["Jl. Sudirman Kav. 52-53, Jakarta Selatan 12190", "Jakarta Selatan"],
    ["Jl. Cendana No. 18, Bandung 40115", "Bandung"],
    ["Jl. Margonda Raya No. 1, Depok", "Depok"],
    ["Jl. Malioboro No. 5, Yogyakarta, Indonesia", "Yogyakarta"],
    ["Bandung, Indonesia", "Bandung"],
    ["Jl. Gajah Mada, Kota Denpasar", "Kota Denpasar"],
  ])("%s → %s", (alamat, kota) => {
    expect(kotaDari(alamat)).toBe(kota);
  });

  it.each([
    "Gedung X, Lt. 3",
    "Jl. Cendana No. 18",
    "Jl. Sudirman Kav. 52-53",
    "Hotel Mulia Senayan, Ballroom Lantai 2",
    "Jl. Mawar No. 3, Blok C",
    "Jl. Melati, Gg. Mawar",
    "Jl. Setiabudi 12, Kec. Sukajadi",
    "Perumahan Griya, RT 02/RW 05",
    "Masjid Agung",
    "Gedung Serbaguna",
    "Indonesia",
    "Jl. A, 40115",
    "Jl. A, Sebuah Nama Wilayah Yang Panjang Sekali",
    "",
    null,
    undefined,
  ])("%s → null", (alamat) => {
    expect(kotaDari(alamat)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { namedPhotoPathsFromContent } from "@/lib/media";

/**
 * `namedPhotoPathsFromContent` — panen prefix foto bernama dari `content` untuk
 * hapus draft (DECISIONS #127). Cermin pemanenan `purge_invitation_data`
 * (migrasi 20261111090000; pgTAP `purge_named_photos.test.sql`): kunci yang
 * sama, bentuk yang sama, saringan terikat undangan yang sama.
 *
 * Fixture memakai bentuk yang ditulis editor (`photoSchema` → OBJEK
 * `{path,x,y,zoom}`) DAN bentuk STRING lama yang masih diterima — pelajaran
 * `purge_named_photos.test.sql`: test di atas bentuk karangan hijau sementara
 * bentuk nyata lolos.
 */

const INV = "0d810000-0000-4000-8000-0000000000a1";
const INV_LAIN = "0d810000-0000-4000-8000-0000000000a2";
const foto = (n: number, inv = INV) =>
  `inv/${inv}/foto/0d810000-0000-4000-8000-0000000000c${n}`;
const objek = (path: string) => ({ path, x: 0.5, y: 0.4, zoom: 1.2 });

describe("namedPhotoPathsFromContent", () => {
  it("memanen sampul, kedua mempelai, logo, dan foto cerita — bentuk OBJEK", () => {
    const content = {
      coverPhoto: objek(foto(1)),
      groom: { name: "Andi", photo: objek(foto(2)) },
      bride: { name: "Sinta", photo: objek(foto(3)) },
      logo: objek(foto(4)),
      story: [
        {
          title: "Pertama bertemu",
          date: "Maret 2019",
          narrative: "Di kampus.",
          photo: objek(foto(5)),
        },
      ],
    };

    expect(namedPhotoPathsFromContent(content, INV).sort()).toEqual(
      [foto(1), foto(2), foto(3), foto(4), foto(5)].sort(),
    );
  });

  it("bentuk STRING lama tetap dipanen — di foto bernama maupun foto cerita", () => {
    const content = {
      coverPhoto: foto(1),
      groom: { name: "Andi", photo: foto(2) },
      story: [{ title: "Menikah", photo: foto(6) }],
    };

    expect(namedPhotoPathsFromContent(content, INV).sort()).toEqual(
      [foto(1), foto(2), foto(6)].sort(),
    );
  });

  it("entri cerita tanpa foto dilewati, bukan menghasilkan path kosong", () => {
    const content = {
      story: [
        { title: "Lamaran", date: "Juni 2025", narrative: "Bersama keluarga." },
        { title: "Menikah", photo: objek(foto(6)) },
      ],
    };

    expect(namedPhotoPathsFromContent(content, INV)).toEqual([foto(6)]);
  });

  it.each([
    ["undangan LAIN (foto bernama)", { coverPhoto: objek(foto(1, INV_LAIN)) }],
    ["undangan LAIN (foto cerita)", { story: [{ photo: foto(7, INV_LAIN) }] }],
    [
      "prefix galeri",
      { coverPhoto: `inv/${INV}/0d810000-0000-4000-8000-0000000000c1` },
    ],
    ["traversal", { bride: { photo: `inv/${INV}/foto/../../lain` } }],
    ["path varian, bukan prefix", { logo: `${foto(4)}/1600.webp` }],
    ["URL vendor", { coverPhoto: `https://cdn.vendor.test/${foto(1)}` }],
  ])("menolak path %s — storage tak mengenal kepemilikan", (_n, content) => {
    expect(namedPhotoPathsFromContent(content, INV)).toEqual([]);
  });

  it("menolak semua bila invitationId sendiri bukan UUID kanonik huruf kecil", () => {
    // Pemanggil wajib memberi `inv.id` dari DB, bukan param URL: `isUuid`
    // menerima huruf besar, regex purge tidak.
    const content = { coverPhoto: objek(foto(1)) };
    expect(namedPhotoPathsFromContent(content, INV.toUpperCase())).toEqual([]);
    expect(namedPhotoPathsFromContent(content, "..")).toEqual([]);
  });

  it.each([
    ["objek", { photo: objek(foto(5)) }],
    ["string", foto(5)],
    ["null", null],
    ["angka", 42],
  ])("`story` yang BUKAN array (%s) diabaikan, bukan dibaca", (_n, story) => {
    // Cermin penjaga `jsonb_typeof(...) = 'array'` di SQL: `story` hanya ada di
    // kategori wedding dan selalu array; bentuk lain bukan data editor.
    expect(namedPhotoPathsFromContent({ story }, INV)).toEqual([]);
  });

  it("elemen `story` rusak tersaring seluruhnya", () => {
    const story: unknown[] = [
      42,
      foto(9), // path telanjang SEBAGAI entri, bukan `photo` — tak dipanen
      null,
      [objek(foto(8))],
      { title: "x", photo: 42 },
      { title: "y", photo: { x: 0.5, y: 0.5, zoom: 1 } },
      { title: "z", photo: { path: 42 } },
    ];
    expect(namedPhotoPathsFromContent({ story }, INV)).toEqual([]);
  });

  it("path yang dirujuk dua kali hanya muncul sekali", () => {
    const content = {
      coverPhoto: objek(foto(1)),
      story: [
        { photo: objek(foto(1)) },
        { photo: foto(5) },
        { photo: foto(5) },
      ],
    };

    expect(namedPhotoPathsFromContent(content, INV).sort()).toEqual(
      [foto(1), foto(5)].sort(),
    );
  });

  it.each([
    ["null", null],
    ["objek kosong", {}],
    ["array", [objek(foto(1))]],
    ["string", foto(1)],
  ])("content %s → daftar kosong tanpa galat", (_n, content) => {
    expect(namedPhotoPathsFromContent(content, INV)).toEqual([]);
  });
});

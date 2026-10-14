import { describe, expect, it } from "vitest";

import { cropFrom, geser, MAX_ZOOM, ukuranKeluaran } from "@/lib/image/crop";

/**
 * Geometri pemangkas foto mempelai (DECISIONS #84). Hasilnya DIPANGGANG ke
 * berkas yang diunggah, jadi kesalahan di sini tak bisa diperbaiki belakangan
 * tanpa unggah ulang — dan karena media disajikan `immutable` setahun, foto
 * yang salah pangkas ikut tersimpan di Cloudflare sampai undangan kedaluwarsa.
 *
 * Satu invarian memayungi semuanya: kotak pangkas HARUS selalu berada utuh di
 * dalam gambar. Begitu ia keluar sedikit saja, `drawImage` mengisi sisanya
 * dengan transparan dan hasilnya pita kosong di tepi foto mempelai.
 */

const ASPEK = 4 / 5; // potret, sama dengan yang dipakai langkah Mempelai

describe("cropFrom — zoom 1 = sebesar mungkin, di tengah", () => {
  it("gambar MENDATAR: tinggi penuh, lebar mengikuti rasio", () => {
    const c = cropFrom(2000, 1000, ASPEK, 1, 0.5, 0.5);
    expect(c.sh).toBe(1000);
    expect(c.sw).toBeCloseTo(800, 6);
    expect(c.sx).toBeCloseTo(600, 6); // terpusat
    expect(c.sy).toBe(0);
  });

  it("gambar POTRET lebih ramping dari bingkai: lebar penuh", () => {
    const c = cropFrom(800, 2000, ASPEK, 1, 0.5, 0.5);
    expect(c.sw).toBe(800);
    expect(c.sh).toBeCloseTo(1000, 6);
    expect(c.sx).toBe(0);
    expect(c.sy).toBeCloseTo(500, 6);
  });

  it("rasio kotak selalu sama dengan rasio bingkai", () => {
    for (const [bw, bh] of [
      [2000, 1000],
      [800, 2000],
      [1000, 1000],
      [1234, 987],
    ]) {
      const c = cropFrom(bw, bh, ASPEK, 1, 0.5, 0.5);
      expect(c.sw / c.sh).toBeCloseTo(ASPEK, 6);
    }
  });
});

describe("cropFrom — perbesaran", () => {
  it("zoom 2 memperkecil kotak jadi separuh", () => {
    const a = cropFrom(2000, 1000, ASPEK, 1, 0.5, 0.5);
    const b = cropFrom(2000, 1000, ASPEK, 2, 0.5, 0.5);
    expect(b.sw).toBeCloseTo(a.sw / 2, 6);
    expect(b.sh).toBeCloseTo(a.sh / 2, 6);
  });

  it("titik tengah TETAP saat zoom berubah", () => {
    // Inilah alasan keadaannya disimpan sebagai titik tengah, bukan kotak:
    // memperbesar tak boleh menggeser wajah keluar bingkai.
    //
    // Pada gambar POTRET, sumbu yang punya kebebasan di zoom 1 adalah yang
    // TEGAK (lebarnya sudah mentok). Di sumbu itulah janji ini berlaku; sumbu
    // yang mentok memang tak bisa menahan titik tengah mana pun — lihat test
    // berikutnya.
    const a = cropFrom(800, 2000, ASPEK, 1, 0.3, 0.4);
    const b = cropFrom(800, 2000, ASPEK, 2.5, 0.3, 0.4);
    expect(a.sy + a.sh / 2).toBeCloseTo(b.sy + b.sh / 2, 6);
    expect(a.sy + a.sh / 2).toBeCloseTo(800, 6);
  });

  it("di zoom 1, sumbu yang sudah terisi penuh TAK bergerak sama sekali", () => {
    // Bukan cacat: di zoom 1 kotaknya sebesar mungkin, jadi salah satu sumbu
    // pasti mentok. Menggeser di sumbu itu memang tak boleh berpengaruh —
    // kalau berpengaruh, berarti kotaknya keluar gambar dan tepinya kosong.
    const kiri = cropFrom(2000, 1000, ASPEK, 1, 0.5, 0);
    const kanan = cropFrom(2000, 1000, ASPEK, 1, 0.5, 1);
    expect(kiri.sy).toBe(0);
    expect(kanan.sy).toBe(0);
    expect(kiri.sh).toBe(1000);
  });

  it("zoom dijepit ke [1, 4]", () => {
    // Angka HARFIAH, bukan `MAX_ZOOM`: membandingkan konstanta dengan dirinya
    // sendiri akan tetap hijau walau batasnya dilonggarkan jadi 99.
    const kecil = cropFrom(2000, 1000, ASPEK, 0.2, 0.5, 0.5);
    expect(kecil).toEqual(cropFrom(2000, 1000, ASPEK, 1, 0.5, 0.5));

    const besar = cropFrom(2000, 1000, ASPEK, 99, 0.5, 0.5);
    expect(besar).toEqual(cropFrom(2000, 1000, ASPEK, 4, 0.5, 0.5));
  });

  it("batasnya 4, dan itu keputusan — bukan angka sembarang", () => {
    // Di atas 4, varian display foto 4:5 jatuh di bawah lebar wadah tema pada
    // layar 3x dan wajahnya terlihat pecah. Hasil pangkasnya DIPANGGANG, jadi
    // pemilik tak bisa mundur tanpa unggah ulang.
    expect(MAX_ZOOM).toBe(4);
  });
});

describe("cropFrom — kotak tak pernah keluar gambar", () => {
  it.each([
    ["kiri atas jauh", -5, -5],
    ["kanan bawah jauh", 9, 9],
    ["tepi kiri", 0, 0.5],
    ["tepi kanan", 1, 0.5],
  ])("%s tetap terjepit di dalam", (_n, cx, cy) => {
    for (const zoom of [1, 1.7, MAX_ZOOM]) {
      const c = cropFrom(1600, 1200, ASPEK, zoom, cx, cy);
      expect(c.sx).toBeGreaterThanOrEqual(0);
      expect(c.sy).toBeGreaterThanOrEqual(0);
      expect(c.sx + c.sw).toBeLessThanOrEqual(1600 + 1e-9);
      expect(c.sy + c.sh).toBeLessThanOrEqual(1200 + 1e-9);
    }
  });
});

describe("geser", () => {
  it("menyeret ke kanan memindahkan kotak ke KIRI", () => {
    const c = cropFrom(2000, 1000, ASPEK, 2, 0.5, 0.5);
    const next = geser(0.5, 0.5, 40, 0, c, 2000, 1000, 200, 250);
    expect(next.cx).toBeLessThan(0.5);
    expect(next.cy).toBe(0.5);
  });

  it("menyeret ke bawah memindahkan kotak ke ATAS", () => {
    const c = cropFrom(2000, 1000, ASPEK, 2, 0.5, 0.5);
    const next = geser(0.5, 0.5, 0, 30, c, 2000, 1000, 200, 250);
    expect(next.cy).toBeLessThan(0.5);
  });

  it("makin diperbesar, seretan yang sama menggeser makin SEDIKIT", () => {
    // Kalau tidak, memperbesar membuat foto melompat-lompat saat digeser.
    const c1 = cropFrom(2000, 1000, ASPEK, 1, 0.5, 0.5);
    const c4 = cropFrom(2000, 1000, ASPEK, 4, 0.5, 0.5);
    const d1 = 0.5 - geser(0.5, 0.5, 40, 0, c1, 2000, 1000, 200, 250).cx;
    const d4 = 0.5 - geser(0.5, 0.5, 40, 0, c4, 2000, 1000, 200, 250).cx;
    expect(d4).toBeLessThan(d1);
  });
});

describe("ukuranKeluaran", () => {
  it("potret: TINGGI yang dibatasi, bukan lebar", () => {
    // Membatasi lebar ke 1600 pada foto 4:5 menghasilkan tinggi 2000px —
    // berkas jauh lebih berat daripada foto galeri, untuk wadah yang justru
    // lebih kecil.
    const { w, h } = ukuranKeluaran({ sx: 0, sy: 0, sw: 4000, sh: 5000 }, 1600);
    expect(h).toBe(1600);
    expect(w).toBe(1280);
  });

  it("mendatar: LEBAR yang dibatasi", () => {
    const { w, h } = ukuranKeluaran({ sx: 0, sy: 0, sw: 5000, sh: 4000 }, 1600);
    expect(w).toBe(1600);
    expect(h).toBe(1280);
  });

  it("tidak pernah memperbesar melebihi piksel sumber", () => {
    // Memperbesar hanya menambah byte tanpa menambah detail.
    const { w, h } = ukuranKeluaran({ sx: 0, sy: 0, sw: 240, sh: 300 }, 1600);
    expect(w).toBe(240);
    expect(h).toBe(300);
  });

  it("selalu minimal 1px (kotak sangat kecil tak menghasilkan kanvas 0)", () => {
    // Rasio harus cukup ekstrem supaya pembulatannya benar-benar jatuh ke 0 —
    // 0,4x0,5 tidak, karena membulat ke 1x1 dengan sendirinya. `canvas.width`
    // bernilai 0 membuat encode melempar, bukan menghasilkan foto buruk.
    const { w, h } = ukuranKeluaran({ sx: 0, sy: 0, sw: 0.2, sh: 1 }, 1600);
    expect(w).toBeGreaterThanOrEqual(1);
    expect(h).toBeGreaterThanOrEqual(1);
  });

  it("mempertahankan rasio", () => {
    const { w, h } = ukuranKeluaran({ sx: 0, sy: 0, sw: 1234, sh: 1543 }, 400);
    expect(w / h).toBeCloseTo(1234 / 1543, 2);
  });
});

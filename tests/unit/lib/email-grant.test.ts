import { describe, expect, it } from "vitest";

import {
  EMAIL_GRANT_MAX_AGE_SEC,
  isFreshEmailGrant,
} from "@/lib/auth/email-grant";

/**
 * Gerbang yang memisahkan "baru saja mengklik tautan email" dari "kebetulan
 * memegang perangkat yang masih login" (AUDIT-2026-10-01 B1).
 *
 * Nilai yang diperiksa `otp`, BUKAN `recovery`. Itu hasil pengujian langsung
 * terhadap proyek: `verifyOtp({ type: "recovery" })` menghasilkan
 * `amr: [{ method: "otp", timestamp: … }]`, sementara dokumentasi Supabase
 * mencantumkan `"recovery"` sebagai nilai `amr.method`. Memakai yang
 * didokumentasikan akan mengunci SETIAP pengguna dari pemulihan kata sandi.
 */

const NOW = 1_790_835_431;
const segar = (t = NOW) => [{ method: "otp", timestamp: t }];

describe("isFreshEmailGrant", () => {
  it("menerima bentuk NYATA dari verifyOtp recovery", () => {
    // Persis payload yang diamati di proyek ini.
    expect(isFreshEmailGrant(segar(), NOW)).toBe(true);
  });

  it("menolak sesi login kata sandi biasa — ini inti temuannya", () => {
    expect(
      isFreshEmailGrant([{ method: "password", timestamp: NOW }], NOW),
    ).toBe(false);
  });

  it('menolak "recovery" yang hanya ada di dokumentasi, bukan di kenyataan', () => {
    // Bila kelak GoTrue benar-benar mengirim "recovery", test ini yang akan
    // memberi tahu — bukan laporan pengguna yang terkunci.
    expect(
      isFreshEmailGrant([{ method: "recovery", timestamp: NOW }], NOW),
    ).toBe(false);
  });

  it("menolak tautan email yang sudah basi", () => {
    expect(
      isFreshEmailGrant(segar(NOW - EMAIL_GRANT_MAX_AGE_SEC - 1), NOW),
    ).toBe(false);
    // Tepat di batas masih diterima.
    expect(isFreshEmailGrant(segar(NOW - EMAIL_GRANT_MAX_AGE_SEC), NOW)).toBe(
      true,
    );
  });

  it("menolak timestamp masa depan — jam melenceng tak memperpanjang izin", () => {
    expect(isFreshEmailGrant(segar(NOW + 60), NOW)).toBe(false);
  });

  it("sesi yang di-refresh tetap dinilai dari umur otp-nya, bukan entri terbaru", () => {
    const amr = [
      { method: "otp", timestamp: NOW - EMAIL_GRANT_MAX_AGE_SEC - 100 },
      { method: "token_refresh", timestamp: NOW },
    ];
    expect(isFreshEmailGrant(amr, NOW)).toBe(false);
  });

  it("menemukan otp walau bukan entri pertama", () => {
    const amr = [
      { method: "token_refresh", timestamp: NOW },
      { method: "otp", timestamp: NOW - 10 },
    ];
    expect(isFreshEmailGrant(amr, NOW)).toBe(true);
  });

  it("bentuk string[] diterima tanpa cek kesegaran (gagal-aman ke arah pemulihan)", () => {
    // Bentuk ini TIDAK teramati di proyek ini. Menolaknya berarti mematikan
    // pemulihan kata sandi bila GoTrue kelak berganti bentuk — kegagalan yang
    // jauh lebih parah daripada celah yang hendak ditutup.
    expect(isFreshEmailGrant(["otp"], NOW)).toBe(true);
    expect(isFreshEmailGrant(["password"], NOW)).toBe(false);
  });

  it("masukan rusak tak pernah membuka gerbang", () => {
    for (const buruk of [
      undefined,
      null,
      "otp",
      {},
      [],
      [null],
      [{ method: "otp" }], // tanpa timestamp
      [{ method: "otp", timestamp: "kemarin" }],
      [{ method: "otp", timestamp: Number.NaN }],
      [{ timestamp: NOW }],
    ]) {
      expect(isFreshEmailGrant(buruk, NOW), JSON.stringify(buruk)).toBe(false);
    }
  });
});

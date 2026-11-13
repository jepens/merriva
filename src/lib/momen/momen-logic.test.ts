import { describe, expect, it } from "vitest";

import { FILM_PRESETS, getFilmPreset, isFilmPresetId } from "./film-presets";
import {
  momenModerationSchema,
  momenSettingsSchema,
  momenUploadMetaSchema,
} from "./momen-settings-schema";

describe("film-presets", () => {
  it("id unik, ada 6 preset, polos netral", () => {
    const ids = FILM_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(6);
    const polos = getFilmPreset("polos");
    expect(polos.params.grain).toBe(0);
    expect(polos.params.mono).toBe(false);
  });

  it("parameter dalam rentang aman", () => {
    for (const p of FILM_PRESETS) {
      expect(p.params.bright).toBeGreaterThanOrEqual(0.5);
      expect(p.params.bright).toBeLessThanOrEqual(1.5);
      expect(p.params.contrast).toBeGreaterThanOrEqual(0.5);
      expect(p.params.contrast).toBeLessThanOrEqual(1.6);
      for (const k of ["vignette", "grain", "halation", "fade"] as const) {
        expect(p.params[k]).toBeGreaterThanOrEqual(0);
        expect(p.params[k]).toBeLessThanOrEqual(1);
      }
      expect(Math.abs(p.params.temp)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.params.tint)).toBeLessThanOrEqual(1);
    }
  });

  it("getFilmPreset id liar → fallback polos; isFilmPresetId akurat", () => {
    expect(getFilmPreset("kodak-portra").id).toBe("polos");
    expect(isFilmPresetId("senja")).toBe(true);
    expect(isFilmPresetId("Senja")).toBe(false);
  });
});

describe("momenSettingsSchema", () => {
  const valid = {
    quotaPerGuest: 5,
    defaultFilter: "hangat",
    allowLibraryUpload: false,
  };

  it("payload sah lolos", () => {
    expect(momenSettingsSchema.safeParse(valid).success).toBe(true);
  });

  // Waktu reveal dihapus (DECISIONS #137): klien lama yang masih mengirimnya
  // ditolak (strict), bukan diam-diam menulis `reveal_at`.
  it("field reveal lama DITOLAK (strict)", () => {
    expect(
      momenSettingsSchema.safeParse({
        ...valid,
        revealMode: "instant",
        revealAt: null,
      }).success,
    ).toBe(false);
  });

  it("kuota di luar 1–20 & non-integer ditolak", () => {
    for (const q of [0, 21, 2.5, -1]) {
      expect(
        momenSettingsSchema.safeParse({ ...valid, quotaPerGuest: q }).success,
      ).toBe(false);
    }
  });

  it("filter di luar enum & key liar ditolak (strict)", () => {
    expect(
      momenSettingsSchema.safeParse({ ...valid, defaultFilter: "portra400" })
        .success,
    ).toBe(false);
    expect(
      momenSettingsSchema.safeParse({ ...valid, admin: true }).success,
    ).toBe(false);
  });
});

describe("momenUploadMetaSchema", () => {
  const valid = {
    guestName: "Déwi & Raka",
    deviceId: "2f5b0d0e-4a1c-4c8e-9b3a-8f2f6f1a7d42",
    shotId: "9c1f2f3a-5b6c-4d7e-8f90-1a2b3c4d5e6f",
    filterId: "senja",
    format: "webp",
    source: "camera",
    width: 1600,
    height: 1200,
    displayBytes: 380_000,
    thumbBytes: 30_000,
  };

  it("metadata sah lolos (unicode nama aman; webp & jpeg)", () => {
    expect(momenUploadMetaSchema.safeParse(valid).success).toBe(true);
    expect(
      momenUploadMetaSchema.safeParse({ ...valid, format: "jpeg" }).success,
    ).toBe(true);
  });

  it("format png/gif ditolak (fallback PNG diam-diam Safari tidak boleh lolos)", () => {
    for (const format of ["png", "gif", "image/webp", ""]) {
      expect(
        momenUploadMetaSchema.safeParse({ ...valid, format }).success,
      ).toBe(false);
    }
  });

  it("nama dengan tag/karakter kontrol ditolak; nama kosong ditolak", () => {
    for (const guestName of ["<script>alert(1)</script>", "a\tb", "  ", ""]) {
      expect(
        momenUploadMetaSchema.safeParse({ ...valid, guestName }).success,
      ).toBe(false);
    }
  });

  // `source` menegakkan setting host `allow_library_upload` di server (AUDIT
  // KEA-2) — nilainya wajib ada & terbatas pada dua asal yang dikenal.
  it("source wajib ada dan hanya camera|library", () => {
    const { source: _drop, ...tanpaSource } = valid;
    expect(momenUploadMetaSchema.safeParse(tanpaSource).success).toBe(false);
    expect(
      momenUploadMetaSchema.safeParse({ ...valid, source: "library" }).success,
    ).toBe(true);
    expect(
      momenUploadMetaSchema.safeParse({ ...valid, source: "airdrop" }).success,
    ).toBe(false);
  });

  it("deviceId bukan UUID & filter liar ditolak", () => {
    expect(
      momenUploadMetaSchema.safeParse({ ...valid, deviceId: "abc" }).success,
    ).toBe(false);
    expect(
      momenUploadMetaSchema.safeParse({ ...valid, filterId: "x" }).success,
    ).toBe(false);
  });

  it("dimensi & byte melampaui batas ditolak", () => {
    expect(
      momenUploadMetaSchema.safeParse({ ...valid, width: 2401 }).success,
    ).toBe(false);
    expect(
      momenUploadMetaSchema.safeParse({ ...valid, displayBytes: 1_500_001 })
        .success,
    ).toBe(false);
    expect(
      momenUploadMetaSchema.safeParse({ ...valid, thumbBytes: 0 }).success,
    ).toBe(false);
  });

  it("key liar ditolak (strict)", () => {
    expect(
      momenUploadMetaSchema.safeParse({ ...valid, isAdmin: true }).success,
    ).toBe(false);
  });
});

describe("momenModerationSchema", () => {
  it("aksi sah lolos, aksi liar ditolak", () => {
    const photoId = "2f5b0d0e-4a1c-4c8e-9b3a-8f2f6f1a7d42";
    expect(
      momenModerationSchema.safeParse({ photoId, action: "hide" }).success,
    ).toBe(true);
    expect(
      momenModerationSchema.safeParse({ photoId, action: "purge" }).success,
    ).toBe(false);
    expect(
      momenModerationSchema.safeParse({ photoId: "1", action: "hide" }).success,
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  canGuestViewPhotos,
  countdownParts,
  msUntilReveal,
  resolveAlbumPhase,
} from "./album-phase";
import { FILM_PRESETS, getFilmPreset, isFilmPresetId } from "./film-presets";
import {
  momenModerationSchema,
  momenSettingsSchema,
  momenUploadMetaSchema,
} from "./momen-settings-schema";

const NOW = Date.parse("2026-09-05T12:00:00+07:00");

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

describe("album-phase", () => {
  it("null = instan (revealed)", () => {
    expect(resolveAlbumPhase(NOW, null)).toBe("revealed");
    expect(msUntilReveal(NOW, null)).toBe(0);
  });

  it("sebelum reveal → hidden + countdown benar", () => {
    const at = "2026-09-05T19:30:00+07:00";
    expect(resolveAlbumPhase(NOW, at)).toBe("hidden");
    expect(msUntilReveal(NOW, at)).toBe(7.5 * 3600 * 1000);
  });

  it("tepat & sesudah reveal → revealed, countdown 0", () => {
    const at = "2026-09-05T12:00:00+07:00";
    expect(resolveAlbumPhase(NOW, at)).toBe("revealed");
    expect(resolveAlbumPhase(NOW + 1, at)).toBe("revealed");
    expect(msUntilReveal(NOW + 999, at)).toBe(0);
  });

  it("string korup → FAIL-CLOSED (hidden), countdown 0", () => {
    expect(resolveAlbumPhase(NOW, "besok sore")).toBe("hidden");
    expect(msUntilReveal(NOW, "besok sore")).toBe(0);
  });

  // Gerbang fail-closed jalur tamu. Akses pemilik TIDAK diwakili di sini —
  // ia dipisahkan secara struktural (route dashboard terautentikasi tanpa
  // gerbang fase), bukan lewat flag (AUDIT KUA-6 / DECISIONS #34).
  it("canGuestViewPhotos: tamu HANYA saat revealed", () => {
    expect(canGuestViewPhotos("hidden")).toBe(false);
    expect(canGuestViewPhotos("revealed")).toBe(true);
  });

  it("countdownParts membagi hari/jam/menit/detik", () => {
    expect(countdownParts(0)).toEqual({ d: 0, h: 0, m: 0, s: 0 });
    expect(countdownParts(90_061_000)).toEqual({ d: 1, h: 1, m: 1, s: 1 });
    expect(countdownParts(-5000)).toEqual({ d: 0, h: 0, m: 0, s: 0 });
  });
});

describe("momenSettingsSchema", () => {
  const valid = {
    quotaPerGuest: 5,
    revealMode: "schedule" as const,
    revealAt: "2026-09-05T21:00:00+07:00",
    defaultFilter: "hangat",
    allowLibraryUpload: false,
  };

  it("payload sah lolos (offset & UTC & instan)", () => {
    expect(momenSettingsSchema.safeParse(valid).success).toBe(true);
    expect(
      momenSettingsSchema.safeParse({
        ...valid,
        revealAt: "2026-09-05T14:00:00Z",
      }).success,
    ).toBe(true);
    expect(
      momenSettingsSchema.safeParse({
        ...valid,
        revealMode: "instant",
        revealAt: null,
      }).success,
    ).toBe(true);
  });

  // Invarian privasi: mode "jadwal" TANPA tanggal tidak boleh lolos menjadi
  // reveal_at null (= semua foto tamu langsung publik). Lihat AUDIT UXA-6.
  it("mode jadwal tanpa tanggal DITOLAK (tak jadi 'langsung tampil')", () => {
    expect(
      momenSettingsSchema.safeParse({
        ...valid,
        revealMode: "schedule",
        revealAt: null,
      }).success,
    ).toBe(false);
  });

  it("mode reveal wajib ada & hanya instant|schedule", () => {
    const { revealMode: _drop, ...tanpaMode } = valid;
    expect(momenSettingsSchema.safeParse(tanpaMode).success).toBe(false);
    expect(
      momenSettingsSchema.safeParse({ ...valid, revealMode: "nanti" }).success,
    ).toBe(false);
  });

  it("datetime tanpa zona / teks bebas ditolak", () => {
    expect(
      momenSettingsSchema.safeParse({
        ...valid,
        revealAt: "2026-09-05T21:00:00",
      }).success,
    ).toBe(false);
    expect(
      momenSettingsSchema.safeParse({ ...valid, revealAt: "besok" }).success,
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

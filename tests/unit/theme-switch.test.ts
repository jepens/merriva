import { describe, expect, it } from "vitest";

import {
  belumPernahDibayar,
  bolehGantiTema,
  settingsTanpaKustom,
  temaPremiumTerkunci,
} from "@/lib/theme-switch";

/**
 * Aturan ganti tema (SPEC §4.4 "Ganti tema", DECISIONS #124) — cermin trigger
 * `enforce_theme_change` untuk tampilan & pesan; DB tetap penegaknya.
 */
describe("bolehGantiTema", () => {
  it.each(["draft", "pending_payment", "active", "expired"])(
    "%s → boleh",
    (status) => {
      expect(bolehGantiTema({ status, purged_at: null })).toBe(true);
    },
  );
  it("suspended → tidak", () => {
    expect(bolehGantiTema({ status: "suspended", purged_at: null })).toBe(
      false,
    );
  });
  it("sudah di-purge → tidak, apa pun statusnya", () => {
    expect(
      bolehGantiTema({ status: "expired", purged_at: "2026-11-01T00:00:00Z" }),
    ).toBe(false);
  });
});

describe("belumPernahDibayar & temaPremiumTerkunci", () => {
  const basic = { allThemes: false };
  const premium = { allThemes: true };

  it("draft/pending_payment tanpa paket = belum pernah dibayar", () => {
    expect(belumPernahDibayar({ package_id: null, status: "draft" })).toBe(
      true,
    );
    expect(
      belumPernahDibayar({ package_id: null, status: "pending_payment" }),
    ).toBe(true);
  });
  it("berpaket, atau tanpa paket tapi berstatus lain = sudah", () => {
    expect(belumPernahDibayar({ package_id: "p", status: "draft" })).toBe(
      false,
    );
    expect(belumPernahDibayar({ package_id: null, status: "active" })).toBe(
      false,
    );
  });
  it("draft pelanggan (lantai Basic) TIDAK terkunci dari tema premium", () => {
    expect(
      temaPremiumTerkunci(
        "premium",
        { package_id: null, status: "draft" },
        basic,
      ),
    ).toBe(false);
  });
  it("undangan aktif Basic terkunci; Premium tidak; tema standar tak pernah", () => {
    const aktif = { package_id: "basic", status: "active" };
    expect(temaPremiumTerkunci("premium", aktif, basic)).toBe(true);
    expect(temaPremiumTerkunci("premium", aktif, premium)).toBe(false);
    expect(temaPremiumTerkunci("standard", aktif, basic)).toBe(false);
  });
});

describe("settingsTanpaKustom", () => {
  it("membuang `custom`, menyalin isian lain apa adanya", () => {
    const settings = {
      timezone: "Asia/Makassar",
      songId: "lagu-1",
      sections: { story: false },
      moderateGuestbook: true,
      custom: { v: 1, variant: "x" },
      kunciLain: 123,
    };
    expect(settingsTanpaKustom(settings)).toEqual({
      timezone: "Asia/Makassar",
      songId: "lagu-1",
      sections: { story: false },
      moderateGuestbook: true,
      kunciLain: 123,
    });
    // Tak memutasi masukan.
    expect(settings.custom).toBeDefined();
  });
  it.each([null, undefined, "x", 1, []])("bukan objek (%s) → {}", (v) => {
    expect(settingsTanpaKustom(v)).toEqual({});
  });
});

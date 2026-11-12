import { describe, expect, it } from "vitest";

import { copy } from "@/lib/copy";
import { DEFAULT_SETTINGS, emptyContent } from "@/lib/validation/content";
import { buildInvitationData } from "@/server/invitation-data";
import { eternalRoseOptions } from "@/themes/eternal-rose/options";

const INV = "85d261d6-1c2b-4e3a-9f00-0a1b2c3d4e5f";

/**
 * Builder data undangan = SATU titik saringan untuk halaman publik & pratinjau
 * (DECISIONS #42). Sesi draft tanpa jam tersimpan di DB, tetapi tak boleh
 * sampai ke tema: kontrak `InvitationEventView.startAt` tetap `string`, dan
 * `events[0]` (label tanggal hero + hitung mundur di ke-10 tema) harus sesi
 * TERJADWAL pertama.
 */

function build(
  eventRows: Parameters<typeof buildInvitationData>[0]["eventRows"],
) {
  return buildInvitationData({
    invitationId: INV,
    slug: "andi-sinta",
    category: "wedding",
    content: emptyContent("wedding"),
    settings: DEFAULT_SETTINGS,
    eventDate: null,
    eventRows,
    mediaRows: [],
    watermark: false,
    videoAllowed: true,
    maxPhotos: 20,
    themeOptions: null,
    music: null,
    musicLocked: false,
    liveMusicPaths: [],
  });
}

const baris = (id: string, start_at: string | null, name = "Sesi") => ({
  id,
  name,
  start_at,
  end_at: null,
  venue_name: null,
  address: null,
  maps_url: null,
});

describe("buildInvitationData — jadwal", () => {
  it("sesi tanpa jam TIDAK sampai ke tema; events[0] = sesi terjadwal pertama", () => {
    const data = build([
      baris("draft", null, "Resepsi"),
      baris("akad", "2026-08-15T01:00:00Z", "Akad"),
    ]);
    expect(data.events.map((e) => e.id)).toEqual(["akad"]);
    expect(data.events[0].startAt).toBe("2026-08-15T01:00:00Z");
  });

  it("nama sesi yang dikosongkan tampil ke tamu sebagai label cadangan", () => {
    const data = build([baris("akad", "2026-08-15T01:00:00Z", "  ")]);
    expect(data.events[0].name).toBe(copy.public.eventFallbackName);
  });

  it("semua sesi belum berjam → jadwal kosong (tema memakai tanggal acara utama)", () => {
    expect(build([baris("a", null), baris("b", null)]).events).toEqual([]);
  });
});

describe("buildInvitationData — foto bernama", () => {
  /**
   * Yang disimpan di `content` adalah PREFIX 2-varian, sama seperti
   * `media.storage_path`. Tanpa `displayPath`, tema menerima URL direktori dan
   * SETIAP foto mempelai/sampul 404 — pada halaman yang tetap menjawab 200,
   * jadi tak ada monitor yang akan meneriakkannya.
   */
  function dengan(content: Record<string, unknown>) {
    return buildInvitationData({
      invitationId: INV,
      slug: "andi-sinta",
      category: "wedding",
      content: { ...emptyContent("wedding"), ...content },
      settings: DEFAULT_SETTINGS,
      eventDate: null,
      eventRows: [],
      mediaRows: [],
      watermark: false,
      videoAllowed: true,
      maxPhotos: 20,
      themeOptions: null,
      music: null,
      musicLocked: false,
      liveMusicPaths: [],
    });
  }

  const foto = (path: string, x = 0.5, y = 0.5, zoom = 1) => ({
    path,
    x,
    y,
    zoom,
  });

  it("memberi tema varian DISPLAY, bukan prefixnya", () => {
    const d = dengan({
      coverPhoto: foto("inv/a/foto/c1"),
      groom: { name: "A", photo: foto("inv/a/foto/g1") },
      bride: { name: "B", photo: foto("inv/a/foto/b1") },
    });

    expect(d.coverPhoto?.url).toMatch(/\/inv\/a\/foto\/c1\/1600\.webp$/);
    expect(d.groomPhoto?.url).toMatch(/\/inv\/a\/foto\/g1\/1600\.webp$/);
    expect(d.bridePhoto?.url).toMatch(/\/inv\/a\/foto\/b1\/1600\.webp$/);
  });

  it("meneruskan titik fokus & perbesaran apa adanya ke tema", () => {
    // Inti model non-destruktif: angka ini TIDAK dipanggang ke berkas, jadi ia
    // harus sampai ke tema utuh — kalau hilang di sini, penyesuaian pemilik
    // lenyap tanpa jejak dan fotonya kembali terpusat.
    const d = dengan({
      groom: { name: "A", photo: foto("inv/a/foto/g1", 0.2, 0.8, 2.5) },
    });

    expect(d.groomPhoto).toMatchObject({ x: 0.2, y: 0.8, zoom: 2.5 });
  });

  it("tanpa foto → null, supaya tema memakai fallback monogram", () => {
    const d = dengan({});
    expect(d.coverPhoto).toBeNull();
    expect(d.groomPhoto).toBeNull();
    expect(d.bridePhoto).toBeNull();
  });
});

describe("buildInvitationData — video (FASE J)", () => {
  const VID = "dQw4w9WgXcQ";
  const video = {
    path: "video/a/b/video.mp4",
    poster: "video/a/b/poster.webp",
    width: 1920,
    height: 1080,
    durationSec: 42,
  };

  function dengan(content: Record<string, unknown>, videoAllowed: boolean) {
    return buildInvitationData({
      invitationId: INV,
      slug: "andi-sinta",
      category: "wedding",
      content: { ...emptyContent("wedding"), ...content },
      settings: DEFAULT_SETTINGS,
      eventDate: null,
      eventRows: [],
      mediaRows: [],
      watermark: false,
      videoAllowed,
      maxPhotos: 20,
      themeOptions: null,
      music: null,
      musicLocked: false,
      liveMusicPaths: [],
    });
  }

  it("paket dengan fitur video: path objek penuh → URL domain sendiri", () => {
    const d = dengan({ video, youtubeUrl: `https://youtu.be/${VID}` }, true);
    expect(d.video?.url).toMatch(/\/video\/a\/b\/video\.mp4$/);
    expect(d.video?.posterUrl).toMatch(/\/video\/a\/b\/poster\.webp$/);
    expect(d.video).toMatchObject({ width: 1920, height: 1080 });
    expect(d.content.youtubeUrl).toBe(`https://youtu.be/${VID}`);
  });

  it("paket TANPA fitur video: video DAN tautan YouTube tidak sampai ke tema", () => {
    // Inilah lubang yang ditutup FASE J: `limits.youtube` dulu hanya label
    // harga — tautan yang tersimpan tetap ikut ke tema paket mana pun.
    const d = dengan({ video, youtubeUrl: `https://youtu.be/${VID}` }, false);
    expect(d.video).toBeNull();
    expect(d.content.youtubeUrl).toBeUndefined();
    expect(d.content.video).toBeUndefined();
  });

  it("tanpa poster → posterUrl null; tanpa video → null", () => {
    const { poster: _poster, ...tanpaPoster } = video;
    expect(dengan({ video: tanpaPoster }, true).video?.posterUrl).toBeNull();
    expect(dengan({}, true).video).toBeNull();
  });
});

describe("buildInvitationData — yang tampil = yang dibayar (DECISIONS #116)", () => {
  const ER = eternalRoseOptions;
  const customPremium = {
    v: 1 as const,
    variant: ER.variants[0]!.id,
    accent: "#aa3355",
    fontPair: ER.fontPairs[1]!.id,
    sections: ER.sections.map((s) => ({ id: s.id, visible: true })),
    styles: { gallery: ER.styles.gallery!.at(-1)! },
    motion: "full" as const,
    grain: true,
  };
  const foto = (i: number) => ({
    id: `m${i}`,
    storage_path: `inv/a/m${i}`,
    width: 1600,
    height: 1200,
  });

  function bangun(opts: {
    watermark: boolean;
    maxPhotos?: number;
    content?: Record<string, unknown>;
    mediaRows?: ReturnType<typeof foto>[];
  }) {
    return buildInvitationData({
      invitationId: INV,
      slug: "andi-sinta",
      category: "wedding",
      content: { ...emptyContent("wedding"), ...(opts.content ?? {}) },
      settings: { ...DEFAULT_SETTINGS, custom: customPremium },
      eventDate: null,
      eventRows: [],
      mediaRows: opts.mediaRows ?? [],
      watermark: opts.watermark,
      videoAllowed: !opts.watermark,
      maxPhotos: opts.maxPhotos ?? 20,
      themeOptions: ER,
      music: null,
      musicLocked: false,
      liveMusicPaths: [],
    });
  }

  it("galeri hanya N foto PERTAMA sesuai paket (urutan pemilik)", () => {
    const rows = [1, 2, 3, 4, 5].map(foto);
    const d = bangun({ watermark: true, maxPhotos: 3, mediaRows: rows });
    expect(d.media.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
    expect(
      bangun({ watermark: false, maxPhotos: 20, mediaRows: rows }).media,
    ).toHaveLength(5);
  });

  it("bukan Premium: kustomisasi Premium tersimpan TIDAK tampil", () => {
    const c = bangun({ watermark: true }).settings.custom!;
    expect(c.fontPair).toBe(ER.fontPairs[0]!.id);
    expect(c.accent).toBeNull();
    expect(c.styles.gallery).toBe(ER.styles.gallery![0]);
  });

  it("Premium: kustomisasi tampil apa adanya", () => {
    const c = bangun({ watermark: false }).settings.custom!;
    expect(c.fontPair).toBe(customPremium.fontPair);
    expect(c.accent).toBe("#aa3355");
  });

  it("live streaming: hanya Premium; hanya https yang menjadi tautan", () => {
    const https = "https://youtube.com/live/abc";
    const premium = bangun({
      watermark: false,
      content: { livestreamUrl: https },
    });
    expect(premium.content.livestreamUrl).toBe(https);
    expect(premium.livestreamText).toBeUndefined();
    const basic = bangun({
      watermark: true,
      content: { livestreamUrl: https },
    });
    expect(basic.content.livestreamUrl).toBeUndefined();
    expect(basic.livestreamText).toBeUndefined();
    // Bukan https → TAK PERNAH jadi `href` (ke-15 tema memakainya sebagai
    // tombol); diteruskan sebagai tulisan biasa (#135).
    const http = bangun({
      watermark: false,
      content: { livestreamUrl: "http://contoh.test/live" },
    });
    expect(http.content.livestreamUrl).toBeUndefined();
    expect(http.livestreamText).toBe("http://contoh.test/live");
  });

  it("live streaming tulisan biasa (#135): Premium saja, dipangkas, kosong = tiada", () => {
    const teks = bangun({
      watermark: false,
      content: { livestreamUrl: "  @LADOMAX Mediapro  " },
    });
    expect(teks.livestreamText).toBe("@LADOMAX Mediapro");
    expect(teks.content.livestreamUrl).toBeUndefined();
    expect(
      bangun({
        watermark: true,
        content: { livestreamUrl: "@LADOMAX Mediapro" },
      }),
    ).not.toHaveProperty("livestreamText");
    for (const kosong of ["", "   "]) {
      const d = bangun({
        watermark: false,
        content: { livestreamUrl: kosong },
      });
      expect(d).not.toHaveProperty("livestreamText");
      expect(d.content.livestreamUrl).toBeUndefined();
    }
  });

  it("tautan + tulisan (berspasi) = tulisan, BUKAN tombol menuju 404 (#135)", () => {
    // `new URL()` menerima spasi di path (di-encode %20) — tanpa penjaga,
    // seluruh isian menjadi `href` dan tulisannya hilang.
    for (const campur of [
      "https://www.youtube.com/@LADOMAX Mediapro",
      "https://youtube.com/live/abc mulai 09.00 WIB",
      "https://youtube.com/live/abc\tmulai",
    ]) {
      const d = bangun({
        watermark: false,
        content: { livestreamUrl: campur },
      });
      expect(d.content.livestreamUrl, campur).toBeUndefined();
      expect(d.livestreamText, campur).toBe(campur);
    }
  });
});

describe("buildInvitationData — musik unggahan (DECISIONS #121)", () => {
  const LAGU = "0f1e2d3c-4b5a-4968-8776-655443322110";
  const PATH = `audio/${INV}/${LAGU}.mp3`;
  const PUSTAKA = { url: "https://cdn.test/songs/abc.mp3", title: "Pustaka" };

  function bangun(opts: {
    customMusic?: unknown;
    watermark?: boolean;
    musicLocked?: boolean;
    music?: typeof PUSTAKA | null;
    /** Bawaan: objek PATH masih hidup — gerbang lain yang diuji. */
    liveMusicPaths?: readonly string[];
  }) {
    return buildInvitationData({
      invitationId: INV,
      slug: "andi-sinta",
      category: "wedding",
      content: {
        ...emptyContent("wedding"),
        groom: { name: "Andi" },
        bride: { name: "Sinta" },
        ...("customMusic" in opts ? { customMusic: opts.customMusic } : {}),
      },
      settings: DEFAULT_SETTINGS,
      eventDate: null,
      eventRows: [],
      mediaRows: [],
      watermark: opts.watermark ?? false,
      videoAllowed: true,
      maxPhotos: 20,
      themeOptions: null,
      music: opts.music === undefined ? PUSTAKA : opts.music,
      musicLocked: opts.musicLocked ?? false,
      liveMusicPaths: opts.liveMusicPaths ?? [PATH],
    });
  }

  it("Premium + path milik undangan ini + objek hidup → musik sendiri menang atas pustaka", () => {
    const d = bangun({ customMusic: { path: PATH, name: "Lagu Kami" } });
    expect(d.music?.url).toMatch(new RegExp(`/audio/${INV}/${LAGU}\.mp3$`));
  });

  it("judul ke tamu SELALU label generik — nama berkas asli tak pernah ikut payload", () => {
    // `name` = nama berkas di perangkat pemilik ("unduhan-yt-…", nama orang):
    // hanya untuk editor. Ia juga tak boleh menumpang `content` yang diterima
    // tema — tema tak membacanya, dan satu tema yang meneruskan `content` ke
    // komponen klien akan membocorkannya ke setiap tamu.
    const NAMA = "unduhan-yt-Rahasia Pemilik.mp3";
    const d = bangun({ customMusic: { path: PATH, name: NAMA } });
    expect(d.music?.title).toBe(copy.editor.customMusic.unnamed);
    expect(d.content.customMusic).toBeUndefined();
    expect(JSON.stringify(d)).not.toContain("Rahasia Pemilik");
  });

  it("tanpa nama → judul cadangan; tanpa lagu pustaka pun tetap diputar", () => {
    const d = bangun({ customMusic: { path: PATH }, music: null });
    expect(d.music?.title).toBe(copy.editor.customMusic.unnamed);
    expect(d.music?.url).toMatch(/\.mp3$/);
  });

  it.each([
    ["tak ada baris hidup (disapu cron / takedown)", []],
    [
      "hanya objek LAIN undangan ini yang hidup",
      [`audio/${INV}/99999999-9999-4999-8999-999999999999.mp3`],
    ],
  ])(
    "rujukan basi: %s → lagu pustaka, bukan URL 404",
    (_label, liveMusicPaths) => {
      // Takedown lalu kunci dibuka (tab editor lama menulis rujukannya
      // kembali), atau autosave tertunda > 24 jam sehingga cron sudah
      // menyapu objeknya: `content` masih merujuk path yang SAH bentuknya.
      const d = bangun({ customMusic: { path: PATH }, liveMusicPaths });
      expect(d.music).toEqual(PUSTAKA);
    },
  );

  it("Basic → lagu pustaka (rujukan tersimpan diabaikan, bukan dihapus)", () => {
    const d = bangun({ customMusic: { path: PATH }, watermark: true });
    expect(d.music).toEqual(PUSTAKA);
  });

  it("dikunci admin sesudah takedown → lagu pustaka", () => {
    const d = bangun({ customMusic: { path: PATH }, musicLocked: true });
    expect(d.music).toEqual(PUSTAKA);
  });

  it.each([
    ["undangan lain", `audio/11111111-2222-4333-8444-555555555555/${LAGU}.mp3`],
    ["lagu pustaka", "songs/abc.mp3"],
    ["video", `video/${INV}/${LAGU}/video.mp4`],
    ["bukan uuid", `audio/${INV}/lagu.mp3`],
    ["huruf besar", `audio/${INV}/${LAGU.toUpperCase()}.mp3`],
    ["ekstensi lain", `audio/${INV}/${LAGU}.m4a`],
  ])("path %s → lagu pustaka", (_label, path) => {
    // Path-nya sendiri dinyatakan "hidup": yang harus menolaknya adalah
    // pengikatan bentuk (`isCustomMusicPath`), bukan gerbang objek hidup.
    expect(
      bangun({ customMusic: { path }, liveMusicPaths: [path] }).music,
    ).toEqual(PUSTAKA);
  });

  it.each([
    ["URL vendor", { path: "https://vendor.test/a.mp3" }],
    ["traversal", { path: `audio/${INV}/../x.mp3` }],
    ["bukan objek", "lagu.mp3"],
    ["tanpa path", { name: "x" }],
  ])(
    "customMusic rusak (%s) TIDAK mengosongkan undangan",
    (_label, customMusic) => {
      // Tanpa pemisahan, satu field gagal menjatuhkan skema strict & draft di
      // `parseContentForRender` → kerangka kosong: nama mempelai hilang dari
      // halaman tamu hanya karena rujukan musik rusak.
      const d = bangun({ customMusic });
      expect(d.content.category).toBe("wedding");
      if (d.content.category === "wedding") {
        expect(d.content.groom.name).toBe("Andi");
        expect(d.content.bride.name).toBe("Sinta");
      }
      expect(d.music).toEqual(PUSTAKA);
    },
  );
});

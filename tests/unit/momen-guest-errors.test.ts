import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Aksi tamu Album Momen saat DB berkedip (DECISIONS #46). Dulu galat DB ikut
 * menjadi "album tidak aktif" — pesan PERMANEN yang membuat tamu di hari-H
 * berhenti memotret, dan pada unggah membuat jepretannya dibuang klien. Galeri
 * yang gagal dimuat juga menghabiskan kursor sehingga tombol "Muat lebih"
 * hilang diam-diam.
 */

const { checkRateLimit, checkClientRateLimit, reportHandledError } = vi.hoisted(
  () => ({
    checkRateLimit: vi.fn(() => ({ ok: true, remaining: 9, retryAfterMs: 0 })),
    checkClientRateLimit: vi.fn(async () => ({
      ok: true,
      remaining: 9,
      retryAfterMs: 0,
    })),
    reportHandledError: vi.fn(),
  }),
);
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit }));
vi.mock("@/lib/request-ip", () => ({
  checkClientRateLimit,
  staticRateKey: (action: string, value: string) => `${action}:${value}`,
  getClientIp: async () => "1.2.3.4",
}));
vi.mock("@/lib/observability", () => ({ reportHandledError }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: async () => true }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: vi.fn() }),
}));
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({
    upload: vi.fn(),
    delete: vi.fn(),
    getPublicUrl: (p: string) => `https://cdn.test/${p}`,
  }),
}));

type Res = { data: unknown; error: unknown; count?: number | null };

const { refs } = vi.hoisted(() => ({
  refs: { tables: {} as Record<string, Res> },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      const res = () =>
        refs.tables[table] ?? { data: null, error: null, count: 0 };
      const chain: Record<string, unknown> = {};
      for (const op of ["select", "eq", "lt", "order", "limit"]) {
        chain[op] = () => chain;
      }
      chain.maybeSingle = () => Promise.resolve(res());
      chain.then = (
        ok: (v: unknown) => unknown,
        fail: (e: unknown) => unknown,
      ) => Promise.resolve(res()).then(ok, fail);
      return chain;
    },
    rpc: vi.fn(async () => ({ data: null, error: null })),
  }),
}));

import { copy } from "@/lib/copy";
import { fetchMomenPhotos } from "@/server/momen/photos";
import {
  loadMomenPhotosAction,
  startMomenSessionAction,
} from "@/server/actions/momen-guest";

const SLUG = "andi-sinta";
const ALBUM = "11111111-1111-4111-8111-111111111111";
const DEVICE = "33333333-3333-4333-8333-333333333333";
/** Bentuk galat postgrest-js sungguhan (objek polos, bukan Error). */
const BOOM = {
  message: "TypeError: fetch failed",
  details: "",
  hint: "",
  code: "",
};

const ALBUM_AKTIF = {
  data: {
    id: ALBUM,
    status: "active",
    quota_per_guest: 5,
    allow_library_upload: true,
    // Sudah lewat → foto boleh tampil (gerbang fase bukan fokus berkas ini).
    reveal_at: "2020-01-01T00:00:00Z",
  },
  error: null,
};

function mulaiSesi() {
  const fd = new FormData();
  fd.set("guestName", "Sasa");
  fd.set("deviceId", DEVICE);
  return startMomenSessionAction(SLUG, fd);
}

beforeEach(() => {
  refs.tables = {
    invitations: { data: { id: "inv-1", status: "active" }, error: null },
    momen_albums: ALBUM_AKTIF,
    momen_photos: { data: [], error: null, count: 0 },
  };
  reportHandledError.mockClear();
});

describe("mulai sesi kamera — galat DB ≠ album tidak aktif", () => {
  it("galat membaca undangan → 'Sedang ada gangguan', bukan 'Album tidak aktif'", async () => {
    refs.tables.invitations = { data: null, error: BOOM };
    expect(await mulaiSesi()).toEqual({
      status: "error",
      message: copy.momen.error.temporary,
    });
    expect(reportHandledError).toHaveBeenCalledWith(
      BOOM,
      "momen.guest.invitation",
      { slug: SLUG },
    );
  });

  it("galat membaca album → 'Sedang ada gangguan'", async () => {
    refs.tables.momen_albums = { data: null, error: BOOM };
    expect(await mulaiSesi()).toMatchObject({
      message: copy.momen.error.temporary,
    });
    expect(reportHandledError).toHaveBeenCalledWith(BOOM, "momen.guest.album", {
      slug: SLUG,
    });
  });

  it("album memang belum dibeli/aktif (tanpa galat) → tetap 'Album tidak aktif'", async () => {
    refs.tables.momen_albums = { data: null, error: null };
    expect(await mulaiSesi()).toEqual({
      status: "error",
      message: copy.momen.error.notActive,
    });
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  /**
   * Hitungan jepretan perangkat KOSMETIK (pips + sisa jatah). Versi pertama #46
   * menolak sesi saat hitungan gagal; review membuktikan itu memblokir SELURUH
   * tamu di hari-H tanpa menambah keamanan kuota sedikit pun — kuotanya
   * ditegakkan ulang secara atomik di RPC claim/confirm. Kini FAIL-OPEN.
   */
  it("galat menghitung jepretan perangkat → sesi TETAP dibuka, galat dilaporkan", async () => {
    refs.tables.momen_photos = { data: null, error: BOOM, count: null };
    expect(await mulaiSesi()).toMatchObject({
      status: "ok",
      remaining: 5,
      deviceCount: 0,
    });
    expect(reportHandledError).toHaveBeenCalledWith(
      BOOM,
      "momen.guest.shotCount",
      { albumId: ALBUM },
    );
  });

  it("semua bacaan berhasil → sesi dimulai dengan sisa jatah dari hitungan nyata", async () => {
    refs.tables.momen_photos = { data: [], error: null, count: 2 };
    expect(await mulaiSesi()).toMatchObject({ status: "ok", remaining: 3 });
  });
});

describe("galeri 'muat lebih' — gagal ≠ habis", () => {
  it("galat membaca foto → status galat (kursor & tombol dipertahankan UI)", async () => {
    refs.tables.momen_photos = { data: null, error: BOOM };
    expect(await loadMomenPhotosAction(SLUG, null)).toEqual({
      status: "error",
    });
  });

  it("galat membaca album → status galat", async () => {
    refs.tables.momen_albums = { data: null, error: BOOM };
    expect(await loadMomenPhotosAction(SLUG, null)).toEqual({
      status: "error",
    });
  });

  it("album memang kosong (tanpa galat) → status ok dengan daftar kosong", async () => {
    expect(await loadMomenPhotosAction(SLUG, null)).toEqual({
      status: "ok",
      photos: [],
      nextCursor: null,
    });
  });
});

describe("fetchMomenPhotos", () => {
  it("galat → penanda `failed` + kursor dipertahankan (bukan 'halaman terakhir')", async () => {
    refs.tables.momen_photos = { data: null, error: BOOM };
    const admin = (
      await import("@/lib/supabase/admin")
    ).createSupabaseAdminClient();
    const page = await fetchMomenPhotos(admin, ALBUM, {
      cursor: "2026-12-20T02:00:00Z",
    });
    expect(page).toEqual({
      photos: [],
      nextCursor: "2026-12-20T02:00:00Z",
      failed: true,
    });
    expect(reportHandledError).toHaveBeenCalledWith(
      BOOM,
      "momen.photos.fetch",
      {
        albumId: ALBUM,
      },
    );
  });
});

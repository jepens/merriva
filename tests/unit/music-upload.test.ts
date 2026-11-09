import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unggah musik sendiri (DECISIONS #121) — `POST /api/invitations/[id]/music`.
 *
 * Seperti video, yang dijaga adalah URUTAN gerbangnya: pernyataan hak,
 * `Content-Length`, sesi, kepemilikan, PAKET, kunci takedown, dan kuota harian
 * wajib diputuskan sebelum body 8MB dibaca — dan storage tak boleh tersentuh
 * oleh siapa pun yang gugur. Berbeda dari video, route ini menulis SATU baris
 * `music_uploads` (catatan pernyataan + sidik byte yang disimpan), dan yang
 * disimpan HANYA byte frame MP3 — bukan berkas kiriman klien apa adanya.
 */

const { checkClientRateLimit } = vi.hoisted(() => ({
  checkClientRateLimit: vi.fn(
    (
      _action: string,
      _limit: { max: number; windowMs: number },
      _scope?: string,
      _identity?: readonly { key: string }[],
    ) => Promise.resolve({ ok: true, remaining: 9, retryAfterMs: 0 }),
  ),
}));
vi.mock("@/lib/request-ip", () => ({
  checkClientRateLimit,
  staticRateKey: (action: string, value: string) => `${action}:${value}`,
}));

const { storage } = vi.hoisted(() => ({
  storage: {
    upload: vi.fn(
      (input: { path: string; body: Uint8Array; contentType: string }) =>
        Promise.resolve(input.path),
    ),
    delete: vi.fn((_path: string) => Promise.resolve()),
    getPublicUrl: (p: string) => `https://cdn.test/${p}`,
  },
}));
vi.mock("@/lib/storage", () => ({ getStorage: () => storage }));

const { reportHandledError } = vi.hoisted(() => ({
  reportHandledError: vi.fn((_err: unknown, _area: string) => undefined),
}));
vi.mock("@/lib/observability", () => ({ reportHandledError }));

const { limits } = vi.hoisted(() => ({
  limits: { watermark: false },
}));
vi.mock("@/server/limits", () => ({
  getEffectiveLimits: (_c: unknown, _p: string | null) =>
    Promise.resolve({ ...limits }),
}));

const { serverRef } = vi.hoisted(() => ({
  serverRef: { current: null as never },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => Promise.resolve(serverRef.current),
}));

/** Klien service_role tiruan: hitung kuota + insert baris `music_uploads`. */
const { admin } = vi.hoisted(() => ({
  admin: {
    count: 0 as number | null,
    countError: null as { message: string } | null,
    insertError: null as { message: string } | null,
    tables: [] as string[],
    selects: [] as unknown[][],
    eqs: [] as [string, unknown][],
    gtes: [] as [string, unknown][],
    inserted: [] as Record<string, unknown>[],
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      admin.tables.push(table);
      const c = {
        select: (...args: unknown[]) => {
          admin.selects.push(args);
          return c;
        },
        eq: (col: string, val: unknown) => {
          admin.eqs.push([col, val]);
          return c;
        },
        gte: (col: string, val: unknown) => {
          admin.gtes.push([col, val]);
          return Promise.resolve({
            count: admin.count,
            error: admin.countError,
          });
        },
        insert: (row: Record<string, unknown>) => {
          admin.inserted.push(row);
          return Promise.resolve({ error: admin.insertError });
        },
      };
      return c;
    },
  }),
}));

import { POST } from "@/app/api/invitations/[id]/music/route";
import {
  CUSTOM_MUSIC_ATTEST_VERSION,
  CUSTOM_MUSIC_MAX_BYTES,
} from "@/lib/custom-music";
import { isCustomMusicPath } from "@/lib/media";

// Ber-huruf heksadesimal: param URL huruf besar BENAR-BENAR berbeda dari id DB.
const INV = "abcdef12-3456-4789-8abc-def012345678";

const FIXTURE = join(process.cwd(), "tests", "fixtures", "audio");
const fixture = (nama: string) =>
  new Uint8Array(readFileSync(join(FIXTURE, nama)));

const MP3 = fixture("cbr-mpeg1.mp3");

type Invitation = {
  id: string;
  user_id: string;
  package_id: string | null;
  music_locked_at: string | null;
  purged_at: string | null;
} | null;

const INV_ROW = {
  id: INV,
  user_id: "u1",
  package_id: "premium",
  music_locked_at: null,
  purged_at: null,
};

function makeClient(
  opts: {
    user?: boolean;
    invitation?: Invitation;
    error?: { message: string } | null;
  } = {},
) {
  const { user = true, invitation = INV_ROW, error = null } = opts;
  const eqs: [string, unknown][] = [];
  const selects: string[] = [];
  const from = vi.fn((_table: string) => {
    const c: Record<string, unknown> = {};
    c.select = (cols: string) => {
      selects.push(cols);
      return c;
    };
    c.eq = (col: string, val: unknown) => {
      eqs.push([col, val]);
      return c;
    };
    c.maybeSingle = () =>
      Promise.resolve({ data: error ? null : invitation, error });
    return c;
  });
  const getUser = vi.fn(() =>
    Promise.resolve({ data: { user: user ? { id: "u1" } : null } }),
  );
  return { from, auth: { getUser }, eqs, selects };
}
type Client = ReturnType<typeof makeClient>;
const client = () => serverRef.current as unknown as Client;

/** Spy `arrayBuffer` permintaan terakhir — bukti body belum/tidak dibaca. */
let bacaBody: ReturnType<typeof vi.fn<() => Promise<ArrayBuffer>>>;

function kirim(
  body: Uint8Array = MP3,
  headers: Record<string, string | null> = {},
  id = INV,
): Promise<Response> {
  const semua: Record<string, string | null> = {
    origin: "http://localhost",
    host: "localhost",
    "content-type": "audio/mpeg",
    "content-length": String(body.byteLength),
    "x-merriva-attest": String(CUSTOM_MUSIC_ATTEST_VERSION),
    ...headers,
  };
  const req = new Request(`http://localhost/api/invitations/${id}/music`, {
    method: "POST",
    headers: Object.fromEntries(
      Object.entries(semua).filter((e): e is [string, string] => e[1] !== null),
    ),
  });
  // Body disuntik lewat spy (pola formData di video-upload.test.ts): route
  // hanya boleh memanggilnya SESUDAH semua gerbang lolos.
  bacaBody = vi.fn(() => Promise.resolve(body.slice().buffer as ArrayBuffer));
  Object.defineProperty(req, "arrayBuffer", { value: bacaBody });
  return POST(req, { params: Promise.resolve({ id }) });
}

async function expectTolak(
  res: Response,
  status: number,
  reason: string,
): Promise<void> {
  expect(res.status).toBe(status);
  expect(await res.json()).toEqual({ status: "error", reason });
  expect(storage.upload).not.toHaveBeenCalled();
  expect(admin.inserted).toEqual([]);
}

beforeEach(() => {
  limits.watermark = false;
  admin.count = 0;
  admin.countError = null;
  admin.insertError = null;
  admin.tables = [];
  admin.selects = [];
  admin.eqs = [];
  admin.gtes = [];
  admin.inserted = [];
  checkClientRateLimit.mockResolvedValue({
    ok: true,
    remaining: 9,
    retryAfterMs: 0,
  });
  storage.upload.mockImplementation((input) => Promise.resolve(input.path));
  serverRef.current = makeClient() as never;
});

// -----------------------------------------------------------------------------
// Gerbang sebelum sesi
// -----------------------------------------------------------------------------

describe("POST /api/invitations/[id]/music — gerbang sebelum sesi", () => {
  it("asal lain (CSRF) → 400 invalid, tanpa membuka sesi", async () => {
    await expectTolak(
      await kirim(MP3, { origin: "https://evil.test" }),
      400,
      "invalid",
    );
    expect(client().auth.getUser).not.toHaveBeenCalled();
    expect(bacaBody).not.toHaveBeenCalled();
  });

  it("tanpa Origin → 400 invalid", async () => {
    await expectTolak(await kirim(MP3, { origin: null }), 400, "invalid");
  });

  it("id bukan UUID → 400 invalid", async () => {
    await expectTolak(await kirim(MP3, {}, "bukan-uuid"), 400, "invalid");
    expect(client().auth.getUser).not.toHaveBeenCalled();
  });

  it.each([
    ["tanpa header", null],
    ["versi usang", String(CUSTOM_MUSIC_ATTEST_VERSION - 1)],
    ["versi asing", String(CUSTOM_MUSIC_ATTEST_VERSION + 1)],
    ["nilai bebas", "true"],
  ])("pernyataan hak %s → 400 attest", async (_n, nilai) => {
    await expectTolak(
      await kirim(MP3, { "x-merriva-attest": nilai }),
      400,
      "attest",
    );
    expect(client().auth.getUser).not.toHaveBeenCalled();
    expect(bacaBody).not.toHaveBeenCalled();
  });

  it.each([
    ["tak ada", null],
    ["nol", "0"],
    ["bukan angka", "abc"],
    ["negatif", "-5"],
    ["pecahan", "1.5"],
  ])("Content-Length %s → 400 invalid", async (_n, nilai) => {
    await expectTolak(
      await kirim(MP3, { "content-length": nilai }),
      400,
      "invalid",
    );
    expect(client().auth.getUser).not.toHaveBeenCalled();
  });

  it("Content-Length di atas 8MB → 413 size SEBELUM auth", async () => {
    await expectTolak(
      await kirim(MP3, {
        "content-length": String(CUSTOM_MUSIC_MAX_BYTES + 1),
      }),
      413,
      "size",
    );
    expect(client().auth.getUser).not.toHaveBeenCalled();
    expect(bacaBody).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------
// Gerbang sesudah sesi, sebelum body
// -----------------------------------------------------------------------------

describe("POST /api/invitations/[id]/music — gerbang sebelum body", () => {
  it("belum login → 401 auth", async () => {
    serverRef.current = makeClient({ user: false }) as never;
    await expectTolak(await kirim(), 401, "auth");
    expect(bacaBody).not.toHaveBeenCalled();
  });

  it("rate limit → 429 rate; plafon AKUN ikut dicatat (bukan hanya jaringan)", async () => {
    checkClientRateLimit.mockResolvedValue({
      ok: false,
      remaining: 0,
      retryAfterMs: 1000,
    });
    await expectTolak(await kirim(), 429, "rate");
    expect(bacaBody).not.toHaveBeenCalled();
    const [action, , , identity] = checkClientRateLimit.mock.calls[0]!;
    expect(action).toBe("music-upload");
    expect(identity?.map((i) => i.key)).toEqual(["music-upload-user:u1"]);
  });

  it("bukan pemilik → 404; kueri kepemilikan DISARING user_id sesi", async () => {
    serverRef.current = makeClient({ invitation: null }) as never;
    await expectTolak(await kirim(), 404, "auth");
    expect(bacaBody).not.toHaveBeenCalled();
    expect(client().eqs).toEqual([
      ["id", INV],
      ["user_id", "u1"],
    ]);
    expect(client().selects[0]).toContain("music_locked_at");
    expect(admin.tables).toEqual([]);
  });

  it("undangan sudah di-purge → 404 auth seperti bukan pemilik, body tak dibaca", async () => {
    // Kerangka purged tak boleh diberi objek baru: datanya sudah dimusnahkan
    // dan tak ada yang akan merujuk unggahannya.
    serverRef.current = makeClient({
      invitation: { ...INV_ROW, purged_at: "2026-11-01T00:00:00Z" },
    }) as never;
    await expectTolak(await kirim(), 404, "auth");
    expect(bacaBody).not.toHaveBeenCalled();
    expect(client().selects[0]).toContain("purged_at");
    // Tak satu pun gerbang berikutnya tersentuh (paket, kuota service_role).
    expect(admin.tables).toEqual([]);
  });

  it("kueri kepemilikan galat → 500 server (bukan 404 yang menyesatkan)", async () => {
    serverRef.current = makeClient({ error: { message: "timeout" } }) as never;
    await expectTolak(await kirim(), 500, "server");
    expect(reportHandledError).toHaveBeenCalled();
  });

  it("PAKET bukan Premium (watermark) → 403 plan", async () => {
    // Penegakan tier DI SERVER — UI yang menyembunyikan tombol bukan pagar.
    limits.watermark = true;
    await expectTolak(await kirim(), 403, "plan");
    expect(bacaBody).not.toHaveBeenCalled();
    expect(admin.tables).toEqual([]);
  });

  it("dikunci admin sesudah takedown → 403 locked", async () => {
    serverRef.current = makeClient({
      invitation: { ...INV_ROW, music_locked_at: "2026-11-08T10:00:00Z" },
    }) as never;
    await expectTolak(await kirim(), 403, "locked");
    expect(bacaBody).not.toHaveBeenCalled();
    expect(admin.tables).toEqual([]);
  });

  it("kuota 5 unggahan / 24 jam → 429 quota, body tak dibaca", async () => {
    admin.count = 5;
    const sebelum = Date.now();
    await expectTolak(await kirim(), 429, "quota");
    expect(bacaBody).not.toHaveBeenCalled();
    expect(admin.tables).toEqual(["music_uploads"]);
    expect(admin.selects[0]).toEqual(["id", { count: "exact", head: true }]);
    expect(admin.eqs).toEqual([["invitation_id", INV]]);
    const [kolom, sejak] = admin.gtes[0]!;
    expect(kolom).toBe("created_at");
    const jendela = sebelum - new Date(sejak as string).getTime();
    expect(jendela).toBeGreaterThanOrEqual(24 * 3600_000 - 5_000);
    expect(jendela).toBeLessThanOrEqual(24 * 3600_000 + 5_000);
  });

  it("unggahan ke-5 (4 sebelumnya) masih boleh", async () => {
    admin.count = 4;
    expect((await kirim()).status).toBe(200);
  });

  it("kueri kuota galat → 500 server, body tak dibaca", async () => {
    admin.countError = { message: "down" };
    admin.count = null;
    await expectTolak(await kirim(), 500, "server");
    expect(bacaBody).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------
// Isi berkas
// -----------------------------------------------------------------------------

/** MPEG-2 8 kbps @ 22,05 kHz: 26 B per frame, 576 sampel — lagu panjang yang kecil. */
function mp3Panjang(detik: number): Uint8Array {
  const n = Math.ceil((detik * 22050) / 576);
  const out = new Uint8Array(n * 26);
  for (let i = 0; i < n; i++) out.set([0xff, 0xf3, 0x10, 0xc0], i * 26);
  return out;
}

describe("POST /api/invitations/[id]/music — isi berkas ditegakkan server", () => {
  it("body lebih pendek dari Content-Length → 400 invalid", async () => {
    await expectTolak(
      await kirim(MP3, { "content-length": String(MP3.byteLength + 10) }),
      400,
      "invalid",
    );
    expect(bacaBody).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["aac.m4a", "format"],
    ["vorbis.ogg", "format"],
    ["short.wav", "format"],
    ["short-3s.mp3", "short"],
  ])("%s → 400 %s", async (nama, reason) => {
    await expectTolak(await kirim(fixture(nama)), 400, reason);
  });

  it("tag ID3 rusak → 400 corrupt", async () => {
    const rusak = MP3.slice();
    const tag = new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0x80, 0]);
    const b = new Uint8Array(tag.length + rusak.length);
    b.set(tag);
    b.set(rusak, tag.length);
    await expectTolak(await kirim(b), 400, "corrupt");
  });

  it("lebih dari 7 menit (+ toleransi) → 400 long", async () => {
    await expectTolak(await kirim(mp3Panjang(425)), 400, "long");
  });

  it("Content-Type klien text/html DIABAIKAN — objek tetap audio/mpeg", async () => {
    const res = await kirim(MP3, { "content-type": "text/html" });
    expect(res.status).toBe(200);
    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(storage.upload.mock.calls[0]![0].contentType).toBe("audio/mpeg");
  });

  it("yang diunggah = byte frame saja (tanpa ID3/sampul/ID3v1); sha256 baris = sha256 byte itu", async () => {
    const asli = fixture("id3-cover.mp3");
    const res = await kirim(asli);
    expect(res.status).toBe(200);

    const diunggah = storage.upload.mock.calls[0]![0].body;
    const harapan = asli.subarray(412, asli.length - 128);
    expect(diunggah.byteLength).toBe(harapan.byteLength);
    expect(Buffer.from(diunggah).equals(Buffer.from(harapan))).toBe(true);
    // Salinan berdiri sendiri: driver yang membaca `.buffer` pun tak bisa
    // ikut menyimpan tag yang sudah dibuang.
    expect(diunggah.buffer.byteLength).toBe(diunggah.byteLength);

    const [baris] = admin.inserted;
    expect(baris).toMatchObject({
      sha256: createHash("sha256").update(harapan).digest("hex"),
      bytes: harapan.byteLength,
      duration_ms: 11546,
    });
    expect(baris!.sha256).not.toBe(
      createHash("sha256").update(asli).digest("hex"),
    );
  });

  it("path memakai id DARI BARIS DB walau param URL huruf besar", async () => {
    const res = await kirim(MP3, {}, INV.toUpperCase());
    expect(res.status).toBe(200);
    const { path } = (await res.json()) as { path: string };
    expect(path.startsWith(`audio/${INV}/`)).toBe(true);
    expect(isCustomMusicPath(INV, path)).toBe(true);
    expect(admin.eqs).toEqual([["invitation_id", INV]]);
    expect(admin.inserted[0]).toMatchObject({ invitation_id: INV, path });
  });
});

// -----------------------------------------------------------------------------
// Operasi
// -----------------------------------------------------------------------------

describe("POST /api/invitations/[id]/music — storage & catatan", () => {
  it("sukses → 200 berisi url & durationSec; baris mencatat pernyataan hak", async () => {
    const res = await kirim();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      path: string;
      url: string;
      durationSec: number;
    };
    expect(body.status).toBe("success");
    expect(isCustomMusicPath(INV, body.path)).toBe(true);
    expect(body.url).toBe(`https://cdn.test/${body.path}`);
    expect(body.durationSec).toBeCloseTo(11.546, 2);

    expect(storage.upload.mock.calls[0]![0].path).toBe(body.path);
    expect(admin.inserted).toEqual([
      {
        invitation_id: INV,
        user_id: "u1",
        path: body.path,
        sha256: createHash("sha256").update(MP3).digest("hex"),
        bytes: MP3.byteLength,
        duration_ms: Math.round(body.durationSec * 1000),
        attest_version: CUSTOM_MUSIC_ATTEST_VERSION,
      },
    ]);
    // Route TIDAK menulis `content`: satu-satunya akses klien sesi = bacaan
    // kepemilikan; service_role = hitung kuota + insert catatan.
    expect(client().from).toHaveBeenCalledTimes(1);
    expect(admin.tables).toEqual(["music_uploads", "music_uploads"]);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("dua unggahan → dua path berbeda (UUID baru setiap unggah)", async () => {
    const a = (await (await kirim()).json()) as { path: string };
    const b = (await (await kirim()).json()) as { path: string };
    expect(a.path).not.toBe(b.path);
  });

  it("storage gagal → 500, objek dibersihkan, TANPA baris", async () => {
    storage.upload.mockRejectedValueOnce(new Error("disk penuh"));
    const res = await kirim();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", reason: "server" });
    expect(storage.upload).toHaveBeenCalledTimes(1);
    const path = storage.upload.mock.calls[0]![0].path;
    expect(storage.delete).toHaveBeenCalledWith(path);
    expect(admin.inserted).toEqual([]);
    expect(reportHandledError).toHaveBeenCalled();
  });

  it("catatan gagal ditulis → 500 dan objek yang sudah terunggah DIHAPUS", async () => {
    // Objek tanpa baris = berkas publik permanen yang tak dikenal penyapu,
    // purge, maupun takedown.
    admin.insertError = { message: "check violation" };
    const res = await kirim();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", reason: "server" });
    const path = storage.upload.mock.calls[0]![0].path;
    expect(storage.delete).toHaveBeenCalledWith(path);
    expect(reportHandledError).toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unggah & hapus video undangan (FASE J).
 *
 * Yang dijaga di sini adalah URUTAN gerbangnya, bukan hanya hasilnya: route ini
 * menampung body sampai 40MB, jadi asal permintaan, `Content-Length`, sesi,
 * kepemilikan, dan PAKET wajib diputuskan sebelum body dibaca — dan storage tak
 * boleh tersentuh oleh siapa pun yang gugur di salah satunya. Seperti foto
 * bernama, unggahan TIDAK menulis DB (autosave yang menyimpan `content.video`).
 */

const { checkClientRateLimit } = vi.hoisted(() => ({
  checkClientRateLimit: vi.fn(() =>
    Promise.resolve({ ok: true, remaining: 9, retryAfterMs: 0 }),
  ),
}));
vi.mock("@/lib/request-ip", () => ({ checkClientRateLimit }));

const { storage } = vi.hoisted(() => ({
  storage: {
    upload: vi.fn((input: { path: string; contentType: string }) =>
      Promise.resolve(input.path),
    ),
    delete: vi.fn((_path: string) => Promise.resolve()),
    getPublicUrl: (p: string) => `https://cdn.test/${p}`,
  },
}));
vi.mock("@/lib/storage", () => ({ getStorage: () => storage }));

vi.mock("@/lib/observability", () => ({ reportHandledError: vi.fn() }));

const { limits } = vi.hoisted(() => ({
  limits: { youtube: true },
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

import { POST } from "@/app/api/invitations/[id]/video/route";
import { isVideoObjectPath, videoPrefix } from "@/lib/media";
import { VIDEO_MAX_BYTES } from "@/lib/video";
import { deleteInvitationVideoAction } from "@/server/actions/video";

const INV = "44444444-4444-4444-8444-444444444444";
const INV_LAIN = "55555555-5555-4555-8555-555555555555";
const VID = "3bca4756-1bba-46c3-8208-84baa2b09b45";

function makeClient(opts: { user?: boolean; invitation?: unknown } = {}) {
  const { user = true, invitation = { id: INV, package_id: "p1" } } = opts;
  const from = () => {
    const c: Record<string, unknown> = {};
    c.select = () => c;
    c.eq = () => c;
    c.maybeSingle = () => Promise.resolve({ data: invitation, error: null });
    return c;
  };
  return {
    from: vi.fn(from),
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: user ? { id: "u1" } : null } }),
    },
  };
}

function form(
  video = new File([new Uint8Array(2000)], "v.mp4", { type: "video/mp4" }),
  poster: File | null = new File([new Uint8Array(300)], "p", {
    type: "image/webp",
  }),
) {
  const fd = new FormData();
  fd.set("video", video);
  if (poster) fd.set("poster", poster);
  return fd;
}

function kirim(
  fd: FormData,
  headers: Record<string, string> = {},
  id = INV,
): Promise<Response> {
  const req = new Request(`http://localhost/api/invitations/${id}/video`, {
    method: "POST",
    headers: {
      origin: "http://localhost",
      host: "localhost",
      "content-length": "4096",
      ...headers,
    },
  });
  // FormData disuntik apa adanya: di jsdom, `Blob` global milik jsdom sedangkan
  // `formData()` bawaan Request mengembalikan `File` undici — `instanceof` di
  // route akan gagal karena beda realm, bukan karena route-nya salah.
  Object.defineProperty(req, "formData", { value: () => Promise.resolve(fd) });
  return POST(req, { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  limits.youtube = true;
  checkClientRateLimit.mockResolvedValue({
    ok: true,
    remaining: 9,
    retryAfterMs: 0,
  });
  serverRef.current = makeClient() as never;
});

describe("POST /api/invitations/[id]/video — gerbang sebelum body & storage", () => {
  it("asal lain (CSRF) → 400, tanpa membuka sesi", async () => {
    const res = await kirim(form(), { origin: "https://evil.test" });
    expect(res.status).toBe(400);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("Content-Length di atas batas → 413 SEBELUM auth", async () => {
    const getUser = vi.fn();
    serverRef.current = { ...makeClient(), auth: { getUser } } as never;
    const res = await kirim(form(), {
      "content-length": String(VIDEO_MAX_BYTES * 2),
    });
    expect(res.status).toBe(413);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("belum login → 401", async () => {
    serverRef.current = makeClient({ user: false }) as never;
    expect((await kirim(form())).status).toBe(401);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("bukan pemilik → 404, tak mengunggah apa pun", async () => {
    serverRef.current = makeClient({ invitation: null }) as never;
    expect((await kirim(form())).status).toBe(404);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("PAKET tanpa fitur video (limits.youtube=false) → 403 'limit'", async () => {
    // Penegakan tier DI SERVER — UI yang menyembunyikan tombol bukan pagar.
    limits.youtube = false;
    const res = await kirim(form());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ status: "error", reason: "limit" });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("rate limit → 429", async () => {
    checkClientRateLimit.mockResolvedValue({
      ok: false,
      remaining: 0,
      retryAfterMs: 1000,
    });
    expect((await kirim(form())).status).toBe(429);
  });

  it.each([
    [
      "tipe bukan video",
      new File([new Uint8Array(10)], "x", { type: "image/png" }),
    ],
    ["avi", new File([new Uint8Array(10)], "x", { type: "video/x-msvideo" })],
    ["kosong", new File([], "x", { type: "video/mp4" })],
  ])("berkas %s → 400", async (_n, berkas) => {
    expect((await kirim(form(berkas))).status).toBe(400);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("poster bukan webp/jpeg → 400", async () => {
    const png = new File([new Uint8Array(10)], "p", { type: "image/png" });
    expect((await kirim(form(undefined, png))).status).toBe(400);
  });
});

describe("POST /api/invitations/[id]/video — sukses", () => {
  it("menaruh video + poster di prefix undangan itu sendiri, tanpa menulis DB", async () => {
    const res = await kirim(form());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(isVideoObjectPath(INV, body.video.path)).toBe(true);
    expect(isVideoObjectPath(INV, body.video.poster)).toBe(true);
    expect(body.video.path).toMatch(/\/video\.mp4$/);
    expect(body.video.poster).toMatch(/\/poster\.webp$/);
    expect(body.url).toBe(`https://cdn.test/${body.video.path}`);
    expect(storage.upload.mock.calls.map((c) => c[0].contentType)).toEqual([
      "video/mp4",
      "image/webp",
    ]);
    // Satu-satunya akses DB = bacaan kepemilikan.
    expect(
      (serverRef.current as unknown as { from: ReturnType<typeof vi.fn> }).from,
    ).toHaveBeenCalledTimes(1);
  });

  it("poster JPEG (Safari/iOS) dinamai .jpg; tanpa poster tetap sah", async () => {
    const jpeg = new File([new Uint8Array(300)], "p", { type: "image/jpeg" });
    const mov = new File([new Uint8Array(300)], "v", {
      type: "video/quicktime",
    });
    const a = await (await kirim(form(mov, jpeg))).json();
    expect(a.video.path).toMatch(/\/video\.mov$/);
    expect(a.video.poster).toMatch(/\/poster\.jpg$/);

    const b = await (await kirim(form(undefined, null))).json();
    expect(b.status).toBe("success");
    expect(b.video.poster).toBeUndefined();
    expect(b.posterUrl).toBeNull();
  });

  it("storage gagal → 500 dan objek yang sempat tertulis dibersihkan", async () => {
    storage.upload
      .mockResolvedValueOnce("ok")
      .mockRejectedValueOnce(new Error("disk penuh"));
    const res = await kirim(form());
    expect(res.status).toBe(500);
    expect(storage.delete).toHaveBeenCalledTimes(2);
  });
});

describe("deleteInvitationVideoAction", () => {
  const milik = `${videoPrefix(INV, VID)}/video.mp4`;

  it("menghapus video + poster milik undangan itu sendiri", async () => {
    const poster = `${videoPrefix(INV, VID)}/poster.webp`;
    const res = await deleteInvitationVideoAction(INV, [milik, poster]);
    expect(res.status).toBe("success");
    expect(storage.delete.mock.calls.map((c) => c[0])).toEqual([milik, poster]);
  });

  it.each([
    ["path undangan LAIN", `${videoPrefix(INV_LAIN, VID)}/video.mp4`],
    ["foto galeri", `inv/${INV}/${VID}/1600.webp`],
    ["traversal", `video/${INV}/${VID}/../../x/video.mp4`],
    ["ekstensi asing", `${videoPrefix(INV, VID)}/video.html`],
  ])("menolak %s tanpa menyentuh storage", async (_n, path) => {
    const res = await deleteInvitationVideoAction(INV, [path]);
    expect(res.status).toBe("error");
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("bukan pemilik → error", async () => {
    serverRef.current = makeClient({ invitation: null }) as never;
    expect((await deleteInvitationVideoAction(INV, [milik])).status).toBe(
      "error",
    );
    expect(storage.delete).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Foto bernama (sampul / mempelai / logo) — SPEC §4.4 langkah 2.
 *
 * Dua hal yang khas di sini dan tak ada padanannya di galeri:
 *
 * 1. **Aksi ini SENGAJA tidak menulis database.** Path foto tinggal di dalam
 *    `content`, dan `content` dimiliki autosave editor yang mengirim seluruh
 *    objeknya tiap beberapa detik. Kalau aksi ini ikut menulis, autosave
 *    berikutnya — yang belum tahu ada foto baru — menimpanya kembali jadi
 *    kosong, dan fotonya "hilang" tanpa satu pun galat.
 * 2. **Penghapusan dipagari bentuk path.** Path datang dari klien dan storage
 *    tak mengenal kepemilikan, jadi tanpa pencocokan penuh terhadap
 *    `invitationId` milik pemanggil, pemilik undangan sendiri bisa mengirim
 *    path undangan ORANG LAIN dan menghapus fotonya.
 */

const { checkClientRateLimit } = vi.hoisted(() => ({
  checkClientRateLimit: vi.fn(() =>
    Promise.resolve({ ok: true, remaining: 9, retryAfterMs: 0 }),
  ),
}));
vi.mock("@/lib/request-ip", () => ({ checkClientRateLimit }));

const { storage } = vi.hoisted(() => ({
  storage: {
    upload: vi.fn((input: { path: string }) => Promise.resolve(input.path)),
    // Parameter DIDEKLARASIKAN: `vi.fn()` tanpa param membuat
    // `mock.calls[0][0]` gagal typecheck meski vitest hijau.
    delete: vi.fn((_path: string) => Promise.resolve()),
    getPublicUrl: (p: string) => `https://cdn.test/${p}`,
  },
}));
vi.mock("@/lib/storage", () => ({ getStorage: () => storage }));

const { serverRef } = vi.hoisted(() => ({
  serverRef: { current: null as never },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => Promise.resolve(serverRef.current),
}));

import {
  deleteNamedPhotoAction,
  uploadNamedPhotoAction,
} from "@/server/actions/named-photo";

const INV = "44444444-4444-4444-8444-444444444444";
const INV_LAIN = "55555555-5555-4555-8555-555555555555";
const FOTO = "3bca4756-1bba-46c3-8208-84baa2b09b45";

function variant(type = "image/webp", bytes = 500): File {
  return new File([new Uint8Array(bytes)], "v", { type });
}

function form(blobs?: [File, File]) {
  const fd = new FormData();
  const [d, t] = blobs ?? [variant(), variant("image/webp", 200)];
  fd.set("display", d);
  fd.set("thumb", t);
  return fd;
}

function makeClient(opts: { user?: boolean; invitation?: unknown } = {}) {
  const { user = true, invitation = { id: INV } } = opts;
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

beforeEach(() => {
  vi.clearAllMocks();
  checkClientRateLimit.mockResolvedValue({
    ok: true,
    remaining: 9,
    retryAfterMs: 0,
  });
  serverRef.current = makeClient() as never;
});

describe("uploadNamedPhotoAction — gerbang sebelum menyentuh storage", () => {
  it("belum login → auth error, storage tak disentuh", async () => {
    serverRef.current = makeClient({ user: false }) as never;

    const res = await uploadNamedPhotoAction(INV, form());

    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.reason).toBe("auth");
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("bukan pemilik (RLS 0 baris) → auth error, tak mengunggah apa pun", async () => {
    serverRef.current = makeClient({ invitation: null }) as never;

    const res = await uploadNamedPhotoAction(INV, form());

    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.reason).toBe("auth");
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("invitationId bukan UUID → ditolak", async () => {
    const res = await uploadNamedPhotoAction("bukan-uuid", form());
    expect(res.status).toBe("error");
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("rate limit terlampaui → ditolak sebelum storage", async () => {
    checkClientRateLimit.mockResolvedValue({
      ok: false,
      remaining: 0,
      retryAfterMs: 1000,
    });

    const res = await uploadNamedPhotoAction(INV, form());

    expect(res.status).toBe("error");
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it.each([
    ["PNG (berarti kompresi klien tak berjalan)", "image/png", 500],
    ["display melebihi batas byte", "image/webp", 2_000_001],
    ["kosong", "image/webp", 0],
  ])("varian tak sah — %s → ditolak", async (_nama, type, bytes) => {
    const res = await uploadNamedPhotoAction(
      INV,
      form([variant(type, bytes), variant("image/webp", 200)]),
    );

    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.reason).toBe("invalid");
    expect(storage.upload).not.toHaveBeenCalled();
  });
});

describe("uploadNamedPhotoAction — hasil", () => {
  it("mengunggah 2 varian di bawah prefix milik undangan ini", async () => {
    const res = await uploadNamedPhotoAction(INV, form());

    expect(res.status).toBe("success");
    const paths = storage.upload.mock.calls.map((c) => c[0].path);
    expect(paths).toHaveLength(2);
    for (const p of paths) {
      expect(p.startsWith(`inv/${INV}/foto/`)).toBe(true);
    }
    expect(paths.some((p) => p.endsWith("/1600.webp"))).toBe(true);
    expect(paths.some((p) => p.endsWith("/400.webp"))).toBe(true);
  });

  it("mengembalikan PREFIX (bukan path objek) — bentuk yang sama dengan galeri", async () => {
    // Bentuk inilah yang membuat purge retensi bisa memakai jalur `media_paths`
    // yang sudah ada; path objek penuh akan melewatkan varian keduanya.
    const res = await uploadNamedPhotoAction(INV, form());

    expect(res.status).toBe("success");
    if (res.status !== "success") return;
    expect(res.path).toMatch(/^inv\/[0-9a-f-]{36}\/foto\/[0-9a-f-]{36}$/);
    expect(res.path.endsWith(".webp")).toBe(false);
  });

  it("URL yang dikembalikan memakai varian THUMB (pratinjau 80px di editor)", async () => {
    const res = await uploadNamedPhotoAction(INV, form());

    expect(res.status).toBe("success");
    if (res.status !== "success") return;
    expect(res.url).toBe(`https://cdn.test/${res.path}/400.webp`);
  });

  it("path BARU setiap unggah — bukan nama tetap per jenis", async () => {
    // Media disajikan `immutable` setahun; menimpa path yang sama membuat
    // Cloudflare & peramban tamu menyajikan foto LAMA sampai kedaluwarsa.
    const a = await uploadNamedPhotoAction(INV, form());
    const b = await uploadNamedPhotoAction(INV, form());

    expect(a.status).toBe("success");
    expect(b.status).toBe("success");
    if (a.status !== "success" || b.status !== "success") return;
    expect(a.path).not.toBe(b.path);
  });

  it("satu varian gagal → KEDUA objek dibersihkan, bukan separuh tertinggal", async () => {
    storage.upload
      .mockImplementationOnce((i: { path: string }) => Promise.resolve(i.path))
      .mockImplementationOnce(() => Promise.reject(new Error("storage")));

    const res = await uploadNamedPhotoAction(INV, form());

    expect(res.status).toBe("error");
    expect(storage.delete).toHaveBeenCalledTimes(2);
  });

  it("TIDAK menulis apa pun ke database", async () => {
    // Kalau aksi ini ikut menulis `content`, autosave berikutnya menimpanya
    // kembali jadi kosong — fotonya hilang tanpa galat.
    const client = makeClient();
    serverRef.current = client as never;

    await uploadNamedPhotoAction(INV, form());

    // Satu-satunya sentuhan tabel adalah SELECT cek kepemilikan.
    expect(client.from).toHaveBeenCalledTimes(1);
    expect(client.from).toHaveBeenCalledWith("invitations");
  });
});

describe("deleteNamedPhotoAction — pagar bentuk path", () => {
  const SAH = `inv/${INV}/foto/${FOTO}`;

  it("menghapus kedua varian untuk path yang sah", async () => {
    const res = await deleteNamedPhotoAction(INV, SAH);

    expect(res.status).toBe("success");
    expect(storage.delete.mock.calls.map((c) => c[0])).toEqual([
      `${SAH}/1600.webp`,
      `${SAH}/400.webp`,
    ]);
  });

  it.each([
    ["milik undangan LAIN", `inv/${INV_LAIN}/foto/${FOTO}`],
    ["prefix galeri undangan ini", `inv/${INV}/${FOTO}`],
    ["path lagu", "songs/858954bda1e7a6730b511cab436b86ca"],
    ["traversal", `inv/${INV}/foto/../../../songs`],
    ["segmen tambahan", `inv/${INV}/foto/${FOTO}/1600.webp`],
    ["kosong", ""],
  ])("menolak %s tanpa menyentuh storage", async (_nama, path) => {
    const res = await deleteNamedPhotoAction(INV, path);

    expect(res.status).toBe("error");
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("belum login → ditolak", async () => {
    serverRef.current = makeClient({ user: false }) as never;

    const res = await deleteNamedPhotoAction(INV, SAH);

    expect(res.status).toBe("error");
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("bukan pemilik → ditolak", async () => {
    serverRef.current = makeClient({ invitation: null }) as never;

    const res = await deleteNamedPhotoAction(INV, SAH);

    expect(res.status).toBe("error");
    expect(storage.delete).not.toHaveBeenCalled();
  });
});

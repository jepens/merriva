import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `uploadGalleryPhotoAction` — penegakan KUOTA FOTO PAKET di server, tanpa test
 * sampai AUDIT-2026-09-04 KUA-9. CLAUDE.md menegaskan: "Paket Basic dibatasi
 * server-side (150 tamu, 8 foto, watermark); jangan hanya membatasi di UI."
 *
 * Invarian yang dijaga:
 *  - batas paket ditegakkan RPC atomik (`insert_gallery_media`) — plafon PENUH
 *    dikenali dari RPC mengembalikan NULL, dan saat itu KEDUA objek storage yang
 *    terlanjur terunggah WAJIB dibersihkan (tak meninggalkan sampah berbayar);
 *  - validasi tipe/ukuran/dimensi terjadi SEBELUM menyentuh storage;
 *  - bukan pemilik → tak ada objek yang diunggah sama sekali.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { checkClientRateLimit } = vi.hoisted(() => ({
  checkClientRateLimit: vi.fn(() =>
    Promise.resolve({ ok: true, remaining: 9, retryAfterMs: 0 }),
  ),
}));
vi.mock("@/lib/request-ip", () => ({ checkClientRateLimit }));

const { storage } = vi.hoisted(() => ({
  storage: {
    upload: vi.fn(() => Promise.resolve("p")),
    delete: vi.fn(() => Promise.resolve()),
    getPublicUrl: (p: string) => `https://cdn.test/${p}`,
  },
}));
vi.mock("@/lib/storage", () => ({ getStorage: () => storage }));

// Parameter DIDEKLARASIKAN: `vi.fn()` tanpa param membuat `mock.calls[0][1]`
// gagal typecheck meski vitest hijau.
const { reportHandledError } = vi.hoisted(() => ({
  reportHandledError:
    vi.fn<
      (err: unknown, area: string, extra?: Record<string, unknown>) => void
    >(),
}));
vi.mock("@/lib/observability", () => ({ reportHandledError }));

const { serverRef } = vi.hoisted(() => ({
  serverRef: { current: null as never },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => Promise.resolve(serverRef.current),
}));

import { uploadGalleryPhotoAction } from "@/server/actions/media";

const INV = "44444444-4444-4444-8444-444444444444";

/** Blob varian yang sah (tipe & ukuran diterima). */
function variant(type = "image/webp", bytes = 500): File {
  return new File([new Uint8Array(bytes)], "v", { type });
}

function form(over: Record<string, string> = {}, blobs?: [File, File]) {
  const fd = new FormData();
  fd.set("width", "1600");
  fd.set("height", "1200");
  for (const [k, v] of Object.entries(over)) fd.set(k, v);
  const [d, t] = blobs ?? [variant(), variant("image/webp", 200)];
  fd.set("display", d);
  fd.set("thumb", t);
  return fd;
}

interface ClientOpts {
  user?: boolean;
  invitation?: unknown;
  rpcData?: unknown;
  rpcError?: unknown;
}

function makeClient(opts: ClientOpts = {}) {
  const {
    user = true,
    invitation = { id: INV, slug: "andi-sinta" },
    rpcData = {
      id: "media-1",
      storage_path: `media/${INV}/media-1`,
      width: 1600,
      height: 1200,
    },
    rpcError = null,
  } = opts;

  const rpc = vi.fn(() => Promise.resolve({ data: rpcData, error: rpcError }));
  const from = () => {
    const c: Record<string, unknown> = {};
    c.select = () => c;
    c.eq = () => c;
    c.maybeSingle = () => Promise.resolve({ data: invitation, error: null });
    return c;
  };
  return {
    from: vi.fn(from),
    rpc,
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

describe("uploadGalleryPhotoAction — gerbang sebelum menyentuh storage", () => {
  it("belum login → auth error, storage tak disentuh", async () => {
    serverRef.current = makeClient({ user: false }) as never;

    const res = await uploadGalleryPhotoAction(INV, form());

    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.reason).toBe("auth");
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("bukan pemilik (RLS 0 baris) → auth error, TIDAK mengunggah apa pun", async () => {
    serverRef.current = makeClient({ invitation: null }) as never;

    const res = await uploadGalleryPhotoAction(INV, form());

    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.reason).toBe("auth");
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("PNG ditolak (klien wajib mengompres ke WebP/JPEG)", async () => {
    const res = await uploadGalleryPhotoAction(
      INV,
      form({}, [variant("image/png"), variant("image/png", 200)]),
    );

    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.reason).toBe("invalid");
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("varian display melampaui 2 MB ditolak sebelum unggah", async () => {
    const res = await uploadGalleryPhotoAction(
      INV,
      form({}, [variant("image/webp", 2_000_001), variant("image/webp", 200)]),
    );

    expect(res.status).toBe("error");
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("dimensi hilang / liar ditolak", async () => {
    // Anotasi eksplisit: literal objek berkunci beda disimpulkan TS sebagai union
    // ber-properti `undefined`, yang tak cocok dengan Record<string, string>.
    const cases: Record<string, string>[] = [
      { width: "0" },
      { height: "-5" },
      { width: "abc" },
      { height: "99999" },
    ];
    for (const over of cases) {
      storage.upload.mockClear();
      const res = await uploadGalleryPhotoAction(INV, form(over));
      expect(res.status).toBe("error");
      expect(storage.upload).not.toHaveBeenCalled();
    }
  });

  it("rate limit terlampaui → ditolak sebelum unggah", async () => {
    checkClientRateLimit.mockResolvedValue({
      ok: false,
      remaining: 0,
      retryAfterMs: 1,
    });

    const res = await uploadGalleryPhotoAction(INV, form());

    expect(res.status).toBe("error");
    expect(storage.upload).not.toHaveBeenCalled();
  });
});

describe("uploadGalleryPhotoAction — kuota paket & kebersihan storage", () => {
  it("KUOTA PENUH (RPC null) → reason `limit` dan objeknya dibersihkan", async () => {
    serverRef.current = makeClient({ rpcData: null }) as never;

    const res = await uploadGalleryPhotoAction(INV, form());

    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.reason).toBe("limit");
    // Objek sudah terlanjur terunggah sebelum gerbang atomik → wajib dibuang,
    // kalau tidak kuota penuh justru meninggalkan sampah storage berbayar.
    // Unggah 2 (galeri memang 2 varian), hapus 3: pembersihan menyapu seluruh
    // varian yang mungkin ada, termasuk `og.jpg` yang hanya dimiliki sampul.
    expect(storage.upload).toHaveBeenCalledTimes(2);
    expect(storage.delete).toHaveBeenCalledTimes(3);
  });

  it("RPC error → dibersihkan juga, dan BUKAN dilaporkan sebagai kuota penuh", async () => {
    serverRef.current = makeClient({
      rpcData: null,
      rpcError: { message: "boom" },
    }) as never;

    const res = await uploadGalleryPhotoAction(INV, form());

    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.reason).toBeUndefined();
    expect(storage.delete).toHaveBeenCalledTimes(3);
  });

  it("unggah storage gagal → dibersihkan, tak menyentuh RPC", async () => {
    const client = makeClient();
    serverRef.current = client as never;
    storage.upload.mockRejectedValueOnce(new Error("storage down"));

    const res = await uploadGalleryPhotoAction(INV, form());

    expect(res.status).toBe("error");
    expect(client.rpc).not.toHaveBeenCalled();
    expect(storage.delete).toHaveBeenCalledTimes(3);
    // Dan BERBUNYI. Pemilik hanya melihat toast "Terjadi kesalahan"; tanpa
    // laporan ini, kredensial R2 yang salah terlihat persis seperti pelanggan
    // yang sedang sepi.
    expect(reportHandledError).toHaveBeenCalledTimes(1);
    expect(reportHandledError.mock.calls[0][1]).toBe("media.upload");
  });

  it("sukses → item dikembalikan & tak ada objek yang dihapus", async () => {
    const client = makeClient();
    serverRef.current = client as never;

    const res = await uploadGalleryPhotoAction(INV, form());

    expect(res.status).toBe("success");
    if (res.status !== "success") return;
    expect(res.item.id).toBe("media-1");
    // URL selalu lewat lib/storage + domain sendiri (bukan URL vendor).
    expect(res.item.url).toContain("https://cdn.test/");
    expect(storage.upload).toHaveBeenCalledTimes(2);
    expect(storage.delete).not.toHaveBeenCalled();
    // Limit ditegakkan RPC atomik, bukan hitungan di aplikasi.
    expect(client.rpc).toHaveBeenCalledWith(
      "insert_gallery_media",
      expect.objectContaining({ inv_id: INV, w: 1600, h: 1200 }),
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `adminAddSongAction` — unggah lagu latar ke pustaka admin.
 *
 * Aksi ini sebelumnya TANPA test sama sekali, padahal ia satu-satunya jalur
 * yang menulis objek audio ke storage, dan `?msg=song_failed` adalah seluruh
 * diagnostik yang pernah diberikannya. Galatnya sendiri ditelan `catch {}`
 * kosong: admin tahu unggahannya gagal, tak seorang pun tahu kenapa.
 *
 * Itu mahal justru pada hari pindah storage. Token R2 ber-scope salah menjawab
 * 403 pada setiap PUT, dan satu-satunya gejalanya adalah halaman `/admin/lagu`
 * yang memantul kembali dengan pesan yang sama untuk sebab apa pun — kredensial
 * salah, bucket belum ada, kuota habis, berkas terlalu besar.
 *
 * Yang dijaga di sini:
 *  - kegagalan unggah DILAPORKAN, bukan hanya diredirect;
 *  - `redirect()` tetap di LUAR `try`. Ia bekerja dengan melempar NEXT_REDIRECT,
 *    jadi `redirect()` di dalam `try` akan ditelan catch yang sama dan aksinya
 *    diam-diam lanjut ke INSERT seolah unggahannya berhasil;
 *  - tak ada baris `songs` yang lahir dari unggahan yang gagal — baris yang
 *    menunjuk objek tak-ada akan tampil di picker lalu bisu saat diputar.
 */

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

const { requireAdmin } = vi.hoisted(() => ({
  requireAdmin: vi.fn(async () => ({ id: "admin-1" })),
}));
vi.mock("@/server/guards/auth", () => ({ requireAdmin }));

const { logAdminAction } = vi.hoisted(() => ({
  logAdminAction: vi.fn(async () => {}),
}));
vi.mock("@/server/admin/log", () => ({ logAdminAction }));

// Parameter DIDEKLARASIKAN: `vi.fn()` tanpa param membuat `mock.calls[0][1]`
// gagal typecheck meski vitest hijau.
const { reportHandledError } = vi.hoisted(() => ({
  reportHandledError:
    vi.fn<
      (err: unknown, area: string, extra?: Record<string, unknown>) => void
    >(),
}));
vi.mock("@/lib/observability", () => ({ reportHandledError }));

const { storage } = vi.hoisted(() => ({
  storage: {
    upload: vi.fn((input: { path: string }) => Promise.resolve(input.path)),
    delete: vi.fn((_path: string) => Promise.resolve()),
    getPublicUrl: (p: string) => `https://cdn.test/${p}`,
  },
}));
vi.mock("@/lib/storage", () => ({ getStorage: () => storage }));

const { insert } = vi.hoisted(() => ({
  insert: vi.fn(() => ({
    select: () => ({
      maybeSingle: () =>
        Promise.resolve({ data: { id: "song-1" }, error: null }),
    }),
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: () => ({ insert }) }),
}));

import { adminAddSongAction } from "@/server/actions/admin-songs";

/** FormData lengkap & sah: MP3 kecil, judul terisi. */
function form(over: { title?: string; type?: string } = {}): FormData {
  const fd = new FormData();
  fd.set("title", over.title ?? "Canon in D");
  fd.set("artist", "Pachelbel");
  fd.set(
    "file",
    new Blob([new Uint8Array([1, 2, 3, 4])], {
      type: over.type ?? "audio/mpeg",
    }),
    "lagu.mp3",
  );
  return fd;
}

/** Aksi ini bertipe `Promise<never>` — ia SELALU berakhir dengan redirect. */
async function tujuanRedirect(fd: FormData): Promise<string> {
  try {
    await adminAddSongAction(fd);
  } catch (err) {
    return (err as Error).message;
  }
  throw new Error("aksi tidak melakukan redirect sama sekali");
}

beforeEach(() => {
  vi.clearAllMocks();
  storage.upload.mockImplementation((i: { path: string }) =>
    Promise.resolve(i.path),
  );
});

describe("adminAddSongAction — jalan bahagia", () => {
  it("unggah → baris songs → audit → redirect sukses", async () => {
    expect(await tujuanRedirect(form())).toContain("msg=song_ok");
    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(logAdminAction).toHaveBeenCalledTimes(1);
  });

  it("path-nya content-addressed di bawah songs/, bukan nama berkas kiriman", async () => {
    // Nama dari peramban tak pernah dipercaya; `songObjectPath` yang menentukan.
    await tujuanRedirect(form());
    const path = storage.upload.mock.calls[0][0].path;
    expect(path).toMatch(/^songs\/[0-9a-f]{32}\.mp3$/);
  });

  it("unggahan yang sehat tidak melapor apa pun", async () => {
    await tujuanRedirect(form());
    expect(reportHandledError).not.toHaveBeenCalled();
  });
});

describe("adminAddSongAction — unggah gagal", () => {
  beforeEach(() => {
    storage.upload.mockRejectedValue(new Error("403 AccessDenied"));
  });

  it("DILAPORKAN, tidak lagi ditelan catch kosong", async () => {
    await tujuanRedirect(form({ title: "Clair de Lune" }));
    expect(reportHandledError).toHaveBeenCalledTimes(1);
    expect(reportHandledError.mock.calls[0][1]).toBe("admin.song.upload");
    // Galat aslinya ikut, bukan hanya fakta bahwa ada kegagalan: "403
    // AccessDenied" dan "ENOSPC" menuntut tindakan yang sama sekali berbeda.
    expect((reportHandledError.mock.calls[0][0] as Error).message).toContain(
      "403",
    );
    expect(reportHandledError.mock.calls[0][2]).toMatchObject({
      title: "Clair de Lune",
    });
  });

  it("admin tetap diberi tahu lewat redirect", async () => {
    expect(await tujuanRedirect(form())).toContain("msg=song_failed");
  });

  it("TIDAK menyisipkan baris songs yang menunjuk objek tak-ada", async () => {
    // Baris yatim akan muncul di picker lalu bisu saat tamu membuka undangan.
    await tujuanRedirect(form());
    expect(insert).not.toHaveBeenCalled();
    expect(logAdminAction).not.toHaveBeenCalled();
  });
});

describe("adminAddSongAction — ditolak sebelum menyentuh storage", () => {
  it.each([
    ["judul kosong", { title: "   " }],
    ["MIME di luar daftar", { type: "application/pdf" }],
  ])("%s → song_invalid, nol unggahan", async (_nama, over) => {
    expect(await tujuanRedirect(form(over))).toContain("msg=song_invalid");
    expect(storage.upload).not.toHaveBeenCalled();
    // Penolakan validasi BUKAN insiden — ia tak boleh ikut membunyikan alarm.
    expect(reportHandledError).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `adminRemoveCustomMusicAction` + `adminUnlockCustomMusicAction` — takedown
 * musik unggahan oleh admin (DECISIONS #121).
 *
 * Yang dijaga, urut bobotnya:
 *  1. teks mana yang pergi ke mana — `reason` ke audit log, `publicReason` ke
 *     email pemilik (aturan DECISIONS #68 yang sama dengan suspend);
 *  2. SETIAP path yang dikembalikan RPC dihapus dari storage, dan path yang
 *     gagal dihapus sampai ke Sentry — objek itu tak akan pernah disapu cron
 *     karena barisnya sudah bertanda `takedown`;
 *  3. kode hasil yang dibaca admin mencerminkan apa yang benar-benar terjadi.
 */

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

const { revalidatePath } = vi.hoisted(() => ({
  revalidatePath: vi.fn((_path: string) => {}),
}));
vi.mock("next/cache", () => ({ revalidatePath }));

const { requireAdmin } = vi.hoisted(() => ({
  requireAdmin: vi.fn(async () => ({ id: "admin-1" })),
}));
vi.mock("@/server/guards/auth", () => ({ requireAdmin }));

const { reportHandledError } = vi.hoisted(() => ({
  reportHandledError: vi.fn(
    (_err: unknown, _area: string, _extra?: Record<string, unknown>) => {},
  ),
}));
vi.mock("@/lib/observability", () => ({ reportHandledError }));

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({
    data: null as unknown,
    error: null as unknown,
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ rpc, from: () => ({}) }),
}));

const { hapus } = vi.hoisted(() => ({
  hapus: vi.fn(async (_path: string) => {}),
}));
vi.mock("@/lib/storage", () => ({ getStorage: () => ({ delete: hapus }) }));

const { sendMusicRemovedNotice, status } = vi.hoisted(() => {
  const status = { current: "sent" };
  return {
    status,
    sendMusicRemovedNotice: vi.fn(
      async (_a: unknown, _id: string, _alasan: string | null) =>
        status.current,
    ),
  };
});
vi.mock("@/server/email/notify", () => ({ sendMusicRemovedNotice }));

import {
  adminRemoveCustomMusicAction,
  adminUnlockCustomMusicAction,
} from "@/server/actions/admin-music";

const INV = "44444444-4444-4444-8444-444444444444";
const LAIN = "55555555-5555-4555-8555-555555555555";
/** UUID yang memuat huruf heksadesimal — `INV` semuanya angka. */
const HURUF = "abcdef01-2345-4678-9abc-def012345678";
const P1 = `audio/${INV}/0b0b0b0b-1111-4111-8111-111111111111.mp3`;
const P2 = `audio/${INV}/0c0c0c0c-2222-4222-8222-222222222222.mp3`;
const INTERNAL = "dilaporkan label X, kontak 0812-9999-1111";
const PUBLIK = "Pemegang hak cipta lagu ini melaporkan penggunaannya.";

function form(reason = INTERNAL, publicReason: string | null = PUBLIK) {
  const fd = new FormData();
  fd.set("reason", reason);
  if (publicReason !== null) fd.set("publicReason", publicReason);
  return fd;
}

async function cabut(fd = form(), id = INV): Promise<string> {
  try {
    await adminRemoveCustomMusicAction(id, fd);
  } catch (e) {
    return String((e as Error).message).replace("REDIRECT ", "");
  }
  throw new Error("aksi tidak me-redirect");
}

async function bukaKunci(id = INV): Promise<string> {
  try {
    await adminUnlockCustomMusicAction(id);
  } catch (e) {
    return String((e as Error).message).replace("REDIRECT ", "");
  }
  throw new Error("aksi tidak me-redirect");
}

const panggilanRpc = () => rpc.mock.calls[0];
const msg = (m: string) => `/admin/undangan/${INV}?msg=${m}`;

function takedownMengembalikan(paths: string[] | null, result = "removed") {
  rpc.mockResolvedValue({
    data: [{ result, slug: "andi-sinta", owner_id: LAIN, paths }],
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  status.current = "sent";
  requireAdmin.mockResolvedValue({ id: "admin-1" });
  hapus.mockResolvedValue(undefined);
  takedownMengembalikan([P1, P2]);
});

describe("gerbang", () => {
  it("non-admin ditolak sebelum menyentuh apa pun", async () => {
    // `requireAdmin` me-redirect (melempar) untuk non-admin.
    requireAdmin.mockRejectedValueOnce(new Error("REDIRECT /dashboard"));
    expect(await cabut()).toBe("/dashboard");
    expect(rpc).not.toHaveBeenCalled();
    expect(hapus).not.toHaveBeenCalled();
    expect(sendMusicRemovedNotice).not.toHaveBeenCalled();
  });

  it("non-admin juga ditolak di buka kunci", async () => {
    requireAdmin.mockRejectedValueOnce(new Error("REDIRECT /dashboard"));
    expect(await bukaKunci()).toBe("/dashboard");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("id bukan UUID → kembali ke daftar, tanpa RPC", async () => {
    expect(await cabut(form(), "bukan-uuid")).toBe("/admin/undangan");
    expect(await bukaKunci("bukan-uuid")).toBe("/admin/undangan");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("catatan internal kosong → music_invalid, tanpa RPC", async () => {
    expect(await cabut(form("   ", PUBLIK))).toBe(msg("music_invalid"));
    expect(rpc).not.toHaveBeenCalled();
    expect(hapus).not.toHaveBeenCalled();
  });

  it("alasan publik kelewat panjang → music_invalid", async () => {
    expect(await cabut(form(INTERNAL, "x".repeat(501)))).toBe(
      msg("music_invalid"),
    );
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("dua kolom alasan tidak pernah tertukar", () => {
  it("RPC dipanggil dengan argumen yang benar", async () => {
    await cabut();
    expect(panggilanRpc()).toEqual([
      "admin_takedown_custom_music",
      {
        p_invitation_id: INV,
        p_admin_id: "admin-1",
        p_reason: INTERNAL,
        p_public_reason: PUBLIK,
      },
    ]);
  });

  it("email menerima alasan PUBLIK, bukan catatan internal", async () => {
    await cabut();
    expect(sendMusicRemovedNotice).toHaveBeenCalledTimes(1);
    expect(sendMusicRemovedNotice.mock.calls[0]?.[1]).toBe(INV);
    expect(sendMusicRemovedNotice.mock.calls[0]?.[2]).toBe(PUBLIK);
  });

  it("alasan publik kosong/tak ada → `null` di RPC dan email", async () => {
    await cabut(form(INTERNAL, ""));
    expect(panggilanRpc()?.[1]?.p_public_reason).toBeNull();
    expect(sendMusicRemovedNotice.mock.calls[0]?.[2]).toBeNull();

    vi.clearAllMocks();
    expect(await cabut(form(INTERNAL, null))).toBe(msg("music_ok"));
    expect(panggilanRpc()?.[1]?.p_public_reason).toBeNull();
  });
});

describe("penghapusan objek storage", () => {
  it("SETIAP path yang dikembalikan RPC dihapus", async () => {
    expect(await cabut()).toBe(msg("music_ok"));
    expect(hapus.mock.calls.map((c) => c[0]).sort()).toEqual([P1, P2].sort());
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("sebagian gagal → music_ok_partial + path yang gagal dilaporkan", async () => {
    hapus.mockImplementation(async (p: string) => {
      if (p === P2) throw new Error("storage 503");
    });
    expect(await cabut()).toBe(msg("music_ok_partial"));
    // Yang berhasil tetap dihapus — satu kegagalan tak menghentikan sisanya.
    expect(hapus).toHaveBeenCalledWith(P1);

    const [err, area, extra] = reportHandledError.mock.calls[0];
    expect((err as Error).message).toBe("storage 503");
    expect(area).toBe("admin.music-takedown.storage");
    expect(extra).toEqual({ invitationId: INV, failedPaths: [P2] });
    // Musiknya SUDAH tak diputar dan kuncinya terpasang: pemilik tetap dikabari.
    expect(sendMusicRemovedNotice).toHaveBeenCalledTimes(1);
  });

  it("path di luar folder musik undangan ini TIDAK diteruskan ke storage", async () => {
    // Pertahanan berlapis di atas check constraint DB.
    const asing = `audio/${LAIN}/0d0d0d0d-3333-4333-8333-333333333333.mp3`;
    takedownMengembalikan([P1, asing]);
    expect(await cabut()).toBe(msg("music_ok_partial"));
    expect(hapus).not.toHaveBeenCalledWith(asing);
    expect(reportHandledError.mock.calls[0]?.[2]).toEqual({
      invitationId: INV,
      failedPaths: [asing],
    });
  });

  it("URL admin ber-UUID HURUF BESAR → objek tetap benar-benar dihapus", async () => {
    // `isUuid` menerima huruf besar dan RPC pun menemukan barisnya, tetapi path
    // dari DB selalu huruf kecil. Tanpa id kanonik, setiap path gagal
    // `isCustomMusicPath` → baris bertanda `takedown`, objek tetap tersaji.
    const BESAR = HURUF.toUpperCase();
    expect(BESAR).not.toBe(HURUF);
    const h1 = `audio/${HURUF}/0b0b0b0b-1111-4111-8111-aaaaaaaaaaaa.mp3`;
    const h2 = `audio/${HURUF}/0c0c0c0c-2222-4222-8222-bbbbbbbbbbbb.mp3`;
    takedownMengembalikan([h1, h2]);
    expect(await cabut(form(), BESAR)).toBe(
      `/admin/undangan/${HURUF}?msg=music_ok`,
    );
    expect(hapus.mock.calls.map((c) => c[0]).sort()).toEqual([h1, h2].sort());
    expect(reportHandledError).not.toHaveBeenCalled();
    // Id yang diteruskan ke RPC & email ikut kanonik.
    expect(panggilanRpc()?.[1]?.p_invitation_id).toBe(HURUF);
    expect(sendMusicRemovedNotice.mock.calls[0]?.[1]).toBe(HURUF);
  });

  it("tanpa berkas hidup (paths kosong/null) → tak ada hapus, tetap ok", async () => {
    takedownMengembalikan(null);
    expect(await cabut()).toBe(msg("music_ok"));
    expect(hapus).not.toHaveBeenCalled();
  });
});

describe("hasil & email", () => {
  it.each(["error", "skipped", "nodata"])(
    "email %s → music_ok_no_email",
    async (s) => {
      status.current = s;
      expect(await cabut()).toBe(msg("music_ok_no_email"));
    },
  );

  it("`not_found` → music_failed, tanpa hapus, tanpa email, tanpa laporan", async () => {
    takedownMengembalikan(null, "not_found");
    expect(await cabut()).toBe(msg("music_failed"));
    expect(hapus).not.toHaveBeenCalled();
    expect(sendMusicRemovedNotice).not.toHaveBeenCalled();
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("hasil RPC tak dikenal → music_failed + dilaporkan", async () => {
    takedownMengembalikan([P1], "aneh");
    expect(await cabut()).toBe(msg("music_failed"));
    expect(hapus).not.toHaveBeenCalled();
    expect(reportHandledError.mock.calls[0]?.[1]).toBe(
      "admin.music-takedown.unknown-result",
    );
  });

  it("galat RPC → music_failed, dilaporkan, tanpa hapus & email", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await cabut()).toBe(msg("music_failed"));
    expect(reportHandledError.mock.calls[0]?.[1]).toBe("admin.music-takedown");
    expect(hapus).not.toHaveBeenCalled();
    expect(sendMusicRemovedNotice).not.toHaveBeenCalled();
  });

  it("revalidate halaman publik undangan + dashboard + admin", async () => {
    await cabut();
    const jalur = revalidatePath.mock.calls.map((c) => c[0]);
    expect(jalur).toEqual(
      expect.arrayContaining([
        "/andi-sinta",
        "/dashboard",
        "/admin",
        "/admin/undangan",
      ]),
    );
  });

  it("revalidate terjadi SEBELUM email dikirim", async () => {
    await cabut();
    const urutanRevalidate = revalidatePath.mock.invocationCallOrder[0];
    const urutanEmail = sendMusicRemovedNotice.mock.invocationCallOrder[0];
    expect(urutanRevalidate).toBeLessThan(urutanEmail);
  });
});

describe("buka kunci", () => {
  function unlockMengembalikan(result: string) {
    rpc.mockResolvedValue({
      data: [{ result, slug: result === "not_found" ? null : "andi-sinta" }],
      error: null,
    });
  }

  it("RPC dipanggil dengan argumen yang benar", async () => {
    unlockMengembalikan("unlocked");
    await bukaKunci();
    expect(panggilanRpc()).toEqual([
      "admin_unlock_custom_music",
      { p_invitation_id: INV, p_admin_id: "admin-1" },
    ]);
  });

  it("`unlocked` → music_unlock_ok + revalidate", async () => {
    unlockMengembalikan("unlocked");
    expect(await bukaKunci()).toBe(msg("music_unlock_ok"));
    expect(revalidatePath).toHaveBeenCalledWith("/andi-sinta");
  });

  it("revalidate memakai SLUG dari RPC (bukan id), juga dari URL huruf besar", async () => {
    unlockMengembalikan("unlocked");
    expect(await bukaKunci(HURUF.toUpperCase())).toBe(
      `/admin/undangan/${HURUF}?msg=music_unlock_ok`,
    );
    expect(panggilanRpc()?.[1]?.p_invitation_id).toBe(HURUF);
    const jalur = revalidatePath.mock.calls.map((c) => c[0]);
    expect(jalur).toContain("/andi-sinta");
    expect(jalur.some((j) => j.toLowerCase().includes(HURUF))).toBe(false);
  });

  it("`not_locked` → music_unlock_not_locked", async () => {
    unlockMengembalikan("not_locked");
    expect(await bukaKunci()).toBe(msg("music_unlock_not_locked"));
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("`not_found` → music_unlock_failed tanpa laporan", async () => {
    unlockMengembalikan("not_found");
    expect(await bukaKunci()).toBe(msg("music_unlock_failed"));
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("galat RPC → music_unlock_failed + dilaporkan", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await bukaKunci()).toBe(msg("music_unlock_failed"));
    expect(reportHandledError.mock.calls[0]?.[1]).toBe("admin.music-unlock");
  });

  it("buka kunci tak pernah mengirim email atau menghapus berkas", async () => {
    unlockMengembalikan("unlocked");
    await bukaKunci();
    expect(sendMusicRemovedNotice).not.toHaveBeenCalled();
    expect(hapus).not.toHaveBeenCalled();
  });
});

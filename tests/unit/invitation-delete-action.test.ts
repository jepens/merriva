import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `deleteInvitationAction` — hapus undangan dari dashboard. Aksi ini sebelumnya
 * TANPA test sama sekali, padahal ia memegang dua hal berat sekaligus.
 *
 * SATU, boundary CLAUDE.md "JANGAN PERNAH hapus undangan yang masih aktif".
 * Tamu sudah memegang tautannya; menghapusnya di tengah masa aktif mematikan
 * undangan yang sedang disebar.
 *
 * DUA, cabang `expired` memanggil RPC `purge_invitation_data` — RPC yang SAMA
 * dengan cron purge-expired, membersihkan kelas data yang sama (foto galeri,
 * wajah mempelai, foto tamu Album Momen) untuk kewajiban yang sama (UU PDP
 * 27/2022). Di cron, kegagalan storage dihitung dan dilaporkan. Di sini — jalur
 * yang dipicu PEMILIK secara sadar — hasilnya dulu dibuang ke `Promise.allSettled`
 * tanpa dibaca. Dan jalurnya SEKALI-JALAN: RPC menyetel `purged_at`, sehingga
 * cron berikutnya menyaring barisnya keluar dan tak akan pernah mencoba ulang.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { checkClientRateLimit } = vi.hoisted(() => ({
  checkClientRateLimit: vi.fn(() =>
    Promise.resolve({ ok: true, remaining: 19, retryAfterMs: 0 }),
  ),
}));
vi.mock("@/lib/request-ip", () => ({ checkClientRateLimit }));

const { storage } = vi.hoisted(() => ({
  storage: {
    upload: vi.fn(() => Promise.resolve("p")),
    delete: vi.fn((_path: string) => Promise.resolve()),
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

const { invRow, rpc, draft } = vi.hoisted(() => ({
  invRow: { data: null as unknown },
  rpc: vi.fn(),
  /** Jalur hapus draft: urutan kejadian + hasil bacaan/DELETE yang disetel. */
  draft: {
    urutan: [] as string[],
    musikFilter: [] as [string, string, unknown][],
    musik: { data: [] as { path: string }[] | null, error: null as unknown },
    delError: null as unknown,
    /** Baris yang DIKEMBALIKAN DELETE (`.select("id")`); [] = 0 baris kena. */
    terhapus: [] as { id: string }[],
    /** Kolom yang diminta kembali dari DELETE (null = tak meminta baris). */
    delSelect: null as string | null,
    media: [] as { storage_path: string }[],
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () =>
    Promise.resolve({
      auth: { getUser: async () => ({ data: { user: { id: "u-1" } } }) },
      from: (table: string) => {
        const chain: Record<string, unknown> = {};
        let isDelete = false;
        chain.select = (cols: string) => {
          if (isDelete) draft.delSelect = cols;
          return chain;
        };
        chain.eq = () => chain;
        chain.maybeSingle = () => Promise.resolve(invRow);
        chain.delete = () => {
          isDelete = true;
          draft.urutan.push(`delete:${table}`);
          return chain;
        };
        // `media` dibaca sebagai list (tanpa maybeSingle). DELETE hanya
        // mengembalikan baris bila diminta lewat `.select()` — seperti PostgREST.
        chain.then = (res: (v: unknown) => unknown) =>
          Promise.resolve(
            table === "media"
              ? { data: draft.media, error: null }
              : {
                  data:
                    draft.delError || draft.delSelect === null
                      ? null
                      : draft.terhapus,
                  error: draft.delError,
                },
          ).then(res);
        return chain;
      },
    }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    rpc,
    // `music_uploads` hanya terbaca service_role (RLS tanpa policy).
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = (col: string, v: unknown) => {
        draft.musikFilter.push(["eq", col, v]);
        return chain;
      };
      chain.is = (col: string, v: unknown) => {
        draft.musikFilter.push(["is", col, v]);
        draft.urutan.push(`baca:${table}`);
        return Promise.resolve(draft.musik);
      };
      return chain;
    },
  }),
}));

import { copy } from "@/lib/copy";
import { deleteInvitationAction } from "@/server/actions/invitation";

const INV = "44444444-4444-4444-8444-444444444444";

/** Hasil RPC purge: satu prefix galeri (→ 3 varian) + satu objek momen. */
function purged() {
  rpc.mockResolvedValue({
    data: [
      {
        result: "purged",
        media_paths: [`inv/${INV}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`],
        momen_paths: ["momen/alb/foto/display.webp"],
      },
    ],
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  draft.urutan = [];
  draft.musikFilter = [];
  draft.musik = { data: [], error: null };
  draft.delError = null;
  draft.terhapus = [{ id: INV }];
  draft.delSelect = null;
  draft.media = [];
  storage.delete.mockImplementation(async (p: string) => {
    draft.urutan.push(`storage:${p}`);
  });
  checkClientRateLimit.mockResolvedValue({
    ok: true,
    remaining: 19,
    retryAfterMs: 0,
  });
  invRow.data = { id: INV, status: "expired", slug: "andi-sinta" };
});

describe("deleteInvitationAction — gerbang", () => {
  it.each(["active", "pending", "suspended"])(
    "undangan %s TIDAK bisa dihapus — tamu sudah memegang tautannya",
    async (status) => {
      invRow.data = { id: INV, status, slug: "andi-sinta" };

      const res = await deleteInvitationAction(INV);

      expect(res.status).toBe("error");
      if (res.status === "error") expect(res.reason).toBe("not_deletable");
      // Keduanya: tak ada objek yang hilang DAN purge tak pernah dipanggil.
      expect(storage.delete).not.toHaveBeenCalled();
      expect(rpc).not.toHaveBeenCalled();
    },
  );

  it("id bukan UUID → ditolak tanpa menyentuh apa pun", async () => {
    expect((await deleteInvitationAction("bukan-uuid")).status).toBe("error");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("undangan orang lain → not_found (RLS mengosongkannya)", async () => {
    invRow.data = null;
    const res = await deleteInvitationAction(INV);
    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.reason).toBe("not_found");
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("deleteInvitationAction — purge expired", () => {
  it("prefix galeri di-expand ke SELURUH varian, momen dihapus langsung", async () => {
    purged();

    expect((await deleteInvitationAction(INV)).status).toBe("success");

    const dihapus = storage.delete.mock.calls.map((c) => c[0]);
    // Tiga varian galeri (400/1600/og) + satu objek momen. `og.jpg` harus ikut:
    // ia foto sampul yang dipakai pratinjau tautan, dan meninggalkannya berarti
    // wajah mempelai tetap di storage setelah purge UU PDP.
    expect(dihapus).toHaveLength(4);
    expect(dihapus).toContain("momen/alb/foto/display.webp");
    expect(dihapus.filter((p) => p.startsWith(`inv/${INV}/`))).toHaveLength(3);
  });

  it("kegagalan storage DILAPORKAN dengan hitungannya, bukan ditelan", async () => {
    purged();
    storage.delete.mockRejectedValue(new Error("403 AccessDenied"));

    const res = await deleteInvitationAction(INV);

    // Tetap sukses: baris DB sudah di-purge dan `purged_at` sudah terisi —
    // menggagalkan aksi hanya membuat pemilik mengira datanya masih ada.
    expect(res.status).toBe("success");
    expect(reportHandledError).toHaveBeenCalledTimes(1);
    expect(reportHandledError.mock.calls[0][1]).toBe(
      "invitation.delete.storage",
    );
    expect(reportHandledError.mock.calls[0][2]).toMatchObject({
      invitationId: INV,
      failed: 4,
    });
  });

  it("purge yang mulus TIDAK melapor apa pun", async () => {
    purged();
    await deleteInvitationAction(INV);
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("RPC yang menjawab selain `purged` tak menghapus objek apa pun", async () => {
    // `already_purged` / `not_expired` — daftar pathnya NULL, dan menghapus
    // berdasarkan daftar kosong lebih baik daripada menebak.
    rpc.mockResolvedValue({
      data: [
        { result: "already_purged", media_paths: null, momen_paths: null },
      ],
      error: null,
    });

    expect((await deleteInvitationAction(INV)).status).toBe("success");
    expect(storage.delete).not.toHaveBeenCalled();
    expect(reportHandledError).not.toHaveBeenCalled();
  });
});

describe("deleteInvitationAction — hapus draft + musik unggahan (DECISIONS #121)", () => {
  const LAGU = (n: number) =>
    `audio/${INV}/0000000${n}-0000-4000-8000-000000000000.mp3`;

  beforeEach(() => {
    invRow.data = { id: INV, status: "draft", slug: "draft-abc" };
    draft.musik = { data: [{ path: LAGU(1) }, { path: LAGU(2) }], error: null };
  });

  it("path dibaca SEBELUM DELETE, objeknya dihapus SESUDAH DELETE sukses", async () => {
    expect((await deleteInvitationAction(INV)).status).toBe("success");

    // Baris ikut lenyap oleh FK cascade — dibaca sesudah DELETE, daftarnya
    // kosong dan objeknya tersaji publik selamanya.
    expect(draft.urutan).toEqual([
      "baca:music_uploads",
      "delete:invitations",
      `storage:${LAGU(1)}`,
      `storage:${LAGU(2)}`,
    ]);
    // Hanya objek milik undangan ini yang masih hidup.
    expect(draft.musikFilter).toEqual([
      ["eq", "invitation_id", INV],
      ["is", "removed_at", null],
    ]);
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it('DELETE meminta barisnya kembali (`.select("id")`) — 0 baris harus terlihat', async () => {
    await deleteInvitationAction(INV);
    expect(draft.delSelect).toBe("id");
  });

  it("DELETE kena 0 baris (status berubah di sela) → TAK ada objek yang dihapus", async () => {
    // Checkout menjadikannya pending/aktif sesudah bacaan status tetapi
    // sebelum DELETE: guard `status = draft` menyaring barisnya. Undangan itu
    // masih hidup — lagu & fotonya miliknya, bukan sampah draft.
    draft.terhapus = [];
    draft.media = [
      { storage_path: `inv/${INV}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa` },
    ];

    const res = await deleteInvitationAction(INV);

    expect(res).toEqual({
      status: "error",
      reason: "not_deletable",
      message: copy.dashboard.deleteNotAllowed,
    });
    expect(storage.delete).not.toHaveBeenCalled();
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("kontrol: DELETE yang kena barisnya ikut menghapus objek media galeri", async () => {
    // Tanpa ini, test 0 baris di atas bisa lolos hanya karena media tiruan
    // tak pernah dihapus sama sekali.
    draft.media = [
      { storage_path: `inv/${INV}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa` },
    ];

    expect((await deleteInvitationAction(INV)).status).toBe("success");
    const dihapus = storage.delete.mock.calls.map((c) => c[0]);
    expect(
      dihapus.filter((p) => p.startsWith(`inv/${INV}/`)).length,
    ).toBeGreaterThan(0);
    expect(dihapus).toContain(LAGU(1));
  });

  it("DELETE gagal → tak ada objek musik yang dihapus", async () => {
    draft.delError = { message: "kedip" };

    expect((await deleteInvitationAction(INV)).status).toBe("error");
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("bacaan musik gagal → penghapusan DIBATALKAN (objek tak boleh jadi yatim)", async () => {
    draft.musik = { data: null, error: { message: "kedip" } };

    expect((await deleteInvitationAction(INV)).status).toBe("error");
    expect(draft.urutan).not.toContain("delete:invitations");
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("objek musik gagal dihapus → DILAPORKAN, aksi tetap sukses", async () => {
    storage.delete.mockRejectedValue(new Error("403 AccessDenied"));

    expect((await deleteInvitationAction(INV)).status).toBe("success");
    expect(reportHandledError).toHaveBeenCalledTimes(1);
    expect(reportHandledError.mock.calls[0][1]).toBe("invitation.delete.music");
    expect(reportHandledError.mock.calls[0][2]).toMatchObject({
      invitationId: INV,
      failed: 2,
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `adminDeleteAccountAction` (AUDIT-2026-10-01 A6).
 *
 * `/privasi` sudah tayang menjanjikan "Anda dapat meminta penghapusan data
 * kapan saja", tetapi `auth.admin.deleteUser` tak pernah dipanggil di mana pun
 * dan panel admin hanya bisa MEMBEKUKAN. Janji publik tanpa mekanisme.
 *
 * Invarian yang paling mudah dirusak saat merapikan kode ini kelak adalah
 * URUTANNYA: RPC → storage → GoTrue. RPC-lah yang mengembalikan path objek;
 * menghapus pengguna lebih dulu membuang satu-satunya cara menemukannya, dan
 * objeknya jadi yatim selamanya — purge retensi pun takkan menemukannya karena
 * ia hanya mengenumerasi path dari BARIS yang sudah tiada.
 */

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/server/guards/auth", () => ({
  requireAdmin: vi.fn(async () => ({ id: ADMIN })),
}));
const { reportHandledError } = vi.hoisted(() => ({
  reportHandledError: vi.fn(),
}));
vi.mock("@/lib/observability", () => ({ reportHandledError }));

/** Prefix galeri → 2 varian objek; sama seperti cron purge. */
vi.mock("@/lib/media", () => ({
  mediaObjectPaths: (prefix: string) => [
    `${prefix}/400.webp`,
    `${prefix}/1600.webp`,
  ],
}));

const { jejak, rpc, getUserById, deleteUser, hapusObjek } = vi.hoisted(() => ({
  jejak: [] as string[],
  rpc: vi.fn(),
  getUserById: vi.fn(),
  deleteUser: vi.fn(),
  hapusObjek: vi.fn(),
}));
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({ delete: hapusObjek }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    rpc,
    auth: { admin: { getUserById, deleteUser } },
  }),
}));

const ADMIN = "11111111-1111-4111-8111-111111111111";
const TARGET = "22222222-2222-4222-8222-222222222222";
const EMAIL = "rina@contoh.co.id";

import { adminDeleteAccountAction } from "@/server/actions/admin-users";

function form(
  patch: Partial<Record<"reason" | "confirmEmail", string>> = {},
): FormData {
  const fd = new FormData();
  fd.set("reason", patch.reason ?? "permintaan pelanggan");
  fd.set("confirmEmail", patch.confirmEmail ?? EMAIL);
  return fd;
}

async function jalankan(id = TARGET, fd = form()): Promise<string> {
  try {
    await adminDeleteAccountAction(id, fd);
  } catch (e) {
    return String((e as Error).message).replace("REDIRECT ", "");
  }
  throw new Error("aksi tidak me-redirect");
}

function hasilRpc(result: string, extra: Record<string, unknown> = {}) {
  rpc.mockImplementation(async () => {
    jejak.push("rpc");
    return {
      data: [
        {
          result,
          media_paths: ["inv/1/m1"],
          momen_paths: ["momen/1/a.webp"],
          purged_count: 1,
          ...extra,
        },
      ],
      error: null,
    };
  });
}

beforeEach(() => {
  jejak.length = 0;
  redirect.mockClear();
  reportHandledError.mockClear();
  rpc.mockReset();
  getUserById.mockReset();
  deleteUser.mockReset();
  hapusObjek.mockReset();

  getUserById.mockResolvedValue({ data: { user: { email: EMAIL } } });
  deleteUser.mockImplementation(async () => {
    jejak.push("deleteUser");
    return { error: null };
  });
  hapusObjek.mockImplementation(async () => {
    jejak.push("storage");
  });
  hasilRpc("deleted");
});

describe("penjagaan sebelum apa pun dihapus", () => {
  it("admin tak bisa menghapus akunnya sendiri", async () => {
    const to = await jalankan(ADMIN);
    expect(to).toContain("user_delete_self");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("email konfirmasi tak cocok → NOL penghapusan", async () => {
    const to = await jalankan(TARGET, form({ confirmEmail: "orang@lain.id" }));
    expect(to).toContain("user_delete_mismatch");
    expect(rpc).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("email dicocokkan tanpa peduli besar-kecil huruf", async () => {
    await jalankan(TARGET, form({ confirmEmail: EMAIL.toUpperCase() }));
    expect(rpc).toHaveBeenCalled();
  });

  it("alasan kosong → ditolak; alasan masuk admin_logs", async () => {
    const to = await jalankan(TARGET, form({ reason: "   " }));
    expect(to).toContain("user_delete_invalid");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("undangan masih AKTIF → ditolak, storage & GoTrue tak disentuh", async () => {
    hasilRpc("has_active");

    const to = await jalankan();

    expect(to).toContain("user_delete_has_active");
    expect(hapusObjek).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });
});

describe("urutan eksekusi", () => {
  it("RPC dulu, lalu storage, GoTrue TERAKHIR", async () => {
    await jalankan();

    expect(jejak[0]).toBe("rpc");
    expect(jejak.at(-1)).toBe("deleteUser");
    // 1 prefix galeri → 2 objek, + 1 objek momen.
    expect(jejak.filter((x) => x === "storage")).toHaveLength(3);
  });

  it("objek galeri di-expand jadi 2 varian, objek momen apa adanya", async () => {
    await jalankan();

    const dihapus = hapusObjek.mock.calls.map((c) => c[0]);
    expect(dihapus).toEqual([
      "inv/1/m1/400.webp",
      "inv/1/m1/1600.webp",
      "momen/1/a.webp",
    ]);
  });

  it("storage gagal TIDAK membatalkan penghapusan — DB sudah commit", async () => {
    hapusObjek.mockRejectedValue(new Error("r2 down"));

    const to = await jalankan();

    expect(to).toContain("user_delete_ok");
    expect(deleteUser).toHaveBeenCalled();
    // Tapi kegagalannya harus terlihat, bukan ditelan.
    expect(
      reportHandledError.mock.calls.some(
        (c) => c[1] === "admin.delete-account.storage",
      ),
    ).toBe(true);
  });

  it("deleteUser gagal → dilaporkan sebagai sisa, bukan gagal total", async () => {
    // Data pribadinya SUDAH terhapus; yang tersisa hanya baris login.
    deleteUser.mockResolvedValue({ error: { message: "gotrue down" } });

    const to = await jalankan();

    expect(to).toContain("user_delete_auth_left");
    expect(
      reportHandledError.mock.calls.some(
        (c) => c[1] === "admin.delete-account.auth",
      ),
    ).toBe(true);
  });
});

describe("pemetaan hasil", () => {
  it("berhasil → pesan sukses", async () => {
    expect(await jalankan()).toContain("user_delete_ok");
  });

  it("akun tak ada → pesannya sendiri", async () => {
    hasilRpc("not_found");
    expect(await jalankan()).toContain("user_delete_not_found");
  });

  it("hasil tak dikenal → gagal, bukan dianggap berhasil", async () => {
    hasilRpc("sesuatu_yang_baru");
    expect(await jalankan()).toContain("user_delete_failed");
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("galat RPC → gagal & dilaporkan", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await jalankan()).toContain("user_delete_failed");
    expect(reportHandledError).toHaveBeenCalled();
  });
});

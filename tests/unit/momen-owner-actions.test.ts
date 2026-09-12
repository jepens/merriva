import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regresi aksi PEMILIK Album Momen: jalur uang add-on (#6) + otorisasi moderasi
 * (#8a). Invarian yang dijaga:
 *  - add-on hanya untuk undangan AKTIF, dan checkout TIDAK mengubah undangan,
 *  - beli-ulang ditolak saat album sudah ada (cegah tagih-ganda tanpa efek),
 *  - kode tier GRATIS tak boleh lewat jalur bayar (amount 0 → link Pakasir invalid),
 *  - nominal order diambil dari DB (bukan dari klien),
 *  - tier gratis membaca kuota peserta dari `packages.limits` (sumber tunggal),
 *  - moderasi hanya menyentuh foto milik album pemanggil.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { createPaymentLink } = vi.hoisted(() => ({
  createPaymentLink: vi.fn(() => "https://pakasir.test/pay/XYZ"),
}));
vi.mock("@/lib/payment", () => ({
  getPaymentGateway: () => ({ createPaymentLink, verifyTransaction: vi.fn() }),
}));

const { storage } = vi.hoisted(() => ({
  storage: {
    upload: vi.fn(() => Promise.resolve("p")),
    delete: vi.fn(() => Promise.resolve()),
    getPublicUrl: (p: string) => `https://cdn.test/${p}`,
  },
}));
vi.mock("@/lib/storage", () => ({ getStorage: () => storage }));

const { refs } = vi.hoisted(() => ({
  refs: { server: null as unknown, admin: null as unknown },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => Promise.resolve(refs.server),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => refs.admin,
}));

// Deteksi order add-on `pending` di-mock agar tes fokus pada INVARIAN aksi
// (tolak checkout & aktivasi gratis), bukan pada bentuk query helper-nya.
const { findPendingMomenOrder } = vi.hoisted(() => ({
  findPendingMomenOrder: vi.fn<() => Promise<{ orderCode: string } | null>>(
    () => Promise.resolve(null),
  ),
}));
vi.mock("@/server/momen/orders", () => ({ findPendingMomenOrder }));

import {
  activateFreeMomenAction,
  createMomenCheckoutAction,
} from "@/server/actions/momen-checkout";
import { moderateMomenPhotoAction } from "@/server/actions/momen-manage";

const INV = "44444444-4444-4444-8444-444444444444";
const ALBUM = "11111111-1111-4111-8111-111111111111";
const PHOTO = "22222222-2222-4222-8222-222222222222";
const USER = "55555555-5555-4555-8555-555555555555";
/** Reveal jauh di masa depan → album masih PRA-reveal. */
const FUTURE = "2099-01-01T00:00:00+07:00";

interface TableCall {
  table: string;
  op: string;
  payload?: unknown;
}

/**
 * Klien palsu: `data` per tabel + perekam operasi. Chain dibuat thenable agar
 * `await from(x).insert(...)` (tanpa maybeSingle) ikut resolve.
 */
function makeClient(data: Record<string, unknown>, calls: TableCall[]) {
  const from = vi.fn((table: string) => {
    const chain: Record<string, unknown> = {};
    const passthrough = ["select", "eq", "order", "limit"];
    for (const m of passthrough) chain[m] = () => chain;
    chain.insert = (payload: unknown) => {
      calls.push({ table, op: "insert", payload });
      return chain;
    };
    chain.update = (payload: unknown) => {
      calls.push({ table, op: "update", payload });
      return chain;
    };
    chain.delete = () => {
      calls.push({ table, op: "delete" });
      return chain;
    };
    chain.maybeSingle = () =>
      Promise.resolve({ data: data[table] ?? null, error: null });
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve({ data: data[table] ?? null, error: null }).then(
        res,
        rej,
      );
    return chain;
  });
  return {
    from,
    auth: { getUser: () => Promise.resolve({ data: { user: { id: USER } } }) },
  };
}

let calls: TableCall[];

beforeEach(() => {
  calls = [];
  createPaymentLink.mockClear();
  storage.delete.mockClear();
  findPendingMomenOrder.mockResolvedValue(null);
});

describe("createMomenCheckoutAction — jalur uang add-on", () => {
  it("undangan belum aktif → ditolak, tak ada order dibuat", async () => {
    refs.server = makeClient(
      { invitations: { id: INV, status: "draft" } },
      calls,
    );
    refs.admin = makeClient({}, calls);

    const res = await createMomenCheckoutAction(INV, "momen_50");

    expect(res.status).toBe("error");
    expect(calls.some((c) => c.table === "orders")).toBe(false);
  });

  it("sudah punya album → ditolak (cegah tagih-ganda)", async () => {
    refs.server = makeClient(
      { invitations: { id: INV, status: "active" } },
      calls,
    );
    refs.admin = makeClient({ momen_albums: { id: ALBUM } }, calls);

    const res = await createMomenCheckoutAction(INV, "momen_50");

    expect(res.status).toBe("error");
    expect(calls.some((c) => c.table === "orders")).toBe(false);
    expect(createPaymentLink).not.toHaveBeenCalled();
  });

  it("kode tier GRATIS ditolak di jalur bayar", async () => {
    refs.server = makeClient(
      { invitations: { id: INV, status: "active" } },
      calls,
    );
    refs.admin = makeClient({}, calls);

    const res = await createMomenCheckoutAction(INV, "momen_5");

    expect(res.status).toBe("error");
    expect(calls.some((c) => c.table === "orders")).toBe(false);
  });

  it("kode paket undangan (bukan add-on) ditolak", async () => {
    refs.server = makeClient(
      { invitations: { id: INV, status: "active" } },
      calls,
    );
    refs.admin = makeClient({}, calls);

    const res = await createMomenCheckoutAction(INV, "premium");

    expect(res.status).toBe("error");
    expect(calls.some((c) => c.table === "orders")).toBe(false);
  });

  it("ada order add-on PENDING → tolak (cegah tagih-ganda)", async () => {
    refs.server = makeClient(
      { invitations: { id: INV, status: "active" } },
      calls,
    );
    refs.admin = makeClient(
      { momen_albums: null, packages: { id: "pkg-50", price_idr: 199000 } },
      calls,
    );
    findPendingMomenOrder.mockResolvedValue({ orderCode: "MRV-PENDING" });

    const res = await createMomenCheckoutAction(INV, "momen_50");

    expect(res.status).toBe("error");
    expect(calls.some((c) => c.table === "orders")).toBe(false);
    expect(createPaymentLink).not.toHaveBeenCalled();
  });

  it("sukses: order pakai harga DB, undangan TIDAK disentuh, redirect Pakasir", async () => {
    refs.server = makeClient(
      { invitations: { id: INV, status: "active" } },
      calls,
    );
    refs.admin = makeClient(
      { momen_albums: null, packages: { id: "pkg-50", price_idr: 199000 } },
      calls,
    );

    const res = await createMomenCheckoutAction(INV, "momen_50");

    expect(res).toEqual({
      status: "redirect",
      url: "https://pakasir.test/pay/XYZ",
    });

    const order = calls.find((c) => c.table === "orders" && c.op === "insert");
    const payload = order?.payload as Record<string, unknown>;
    expect(payload.amount_idr).toBe(199000); // dari DB, bukan klien
    expect(payload.package_id).toBe("pkg-50");
    expect(payload.invitation_id).toBe(INV);
    expect(payload.status).toBe("pending");

    // INVARIAN: add-on tak boleh mengubah baris undangan.
    expect(
      calls.some((c) => c.table === "invitations" && c.op !== "select"),
    ).toBe(false);
  });
});

describe("activateFreeMomenAction — tier gratis", () => {
  it("undangan belum aktif → ditolak", async () => {
    refs.server = makeClient(
      { invitations: { id: INV, status: "expired", slug: "s" } },
      calls,
    );
    const rpc = vi.fn(() => Promise.resolve({ data: ALBUM, error: null }));
    refs.admin = { ...makeClient({}, calls), rpc };

    const res = await activateFreeMomenAction(INV);

    expect(res.status).toBe("error");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sudah punya album → ditolak (tak menimpa album berbayar)", async () => {
    refs.server = makeClient(
      { invitations: { id: INV, status: "active", slug: "s" } },
      calls,
    );
    const rpc = vi.fn(() => Promise.resolve({ data: ALBUM, error: null }));
    refs.admin = { ...makeClient({ momen_albums: { id: ALBUM } }, calls), rpc };

    const res = await activateFreeMomenAction(INV);

    expect(res.status).toBe("error");
    expect(rpc).not.toHaveBeenCalled();
  });

  // INVARIAN UANG (AUDIT KUA-2): album gratis yang dibuat saat order berbayar
  // masih pending membuat aktivasi berbayar jadi no-op (`on conflict do
  // nothing`) → pemilik membayar tetapi tetap mendapat tier gratis.
  it("ada order add-on PENDING → aktivasi gratis DITOLAK (bayar tanpa barang)", async () => {
    refs.server = makeClient(
      { invitations: { id: INV, status: "active", slug: "s" } },
      calls,
    );
    const rpc = vi.fn(() => Promise.resolve({ data: ALBUM, error: null }));
    refs.admin = {
      ...makeClient(
        { momen_albums: null, packages: { limits: { quota_peserta: 5 } } },
        calls,
      ),
      rpc,
    };
    findPendingMomenOrder.mockResolvedValue({ orderCode: "MRV-PENDING" });

    const res = await activateFreeMomenAction(INV);

    expect(res.status).toBe("error");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sukses: kuota peserta dibaca dari packages.limits (sumber tunggal)", async () => {
    refs.server = makeClient(
      { invitations: { id: INV, status: "active", slug: "andi-sinta" } },
      calls,
    );
    const rpc = vi.fn(() => Promise.resolve({ data: ALBUM, error: null }));
    refs.admin = {
      ...makeClient(
        { momen_albums: null, packages: { limits: { quota_peserta: 5 } } },
        calls,
      ),
      rpc,
    };

    const res = await activateFreeMomenAction(INV);

    expect(res).toEqual({ status: "ok" });
    expect(rpc).toHaveBeenCalledWith(
      "create_momen_album",
      expect.objectContaining({ p_invitation_id: INV, p_quota_peserta: 5 }),
    );
  });
});

describe("moderateMomenPhotoAction — otorisasi", () => {
  it("foto bukan milik album pemanggil → ditolak, storage tak disentuh", async () => {
    refs.server = makeClient({ invitations: { id: INV } }, calls);
    // momen_photos null = filter album_id tak menemukan baris.
    refs.admin = makeClient(
      { momen_albums: { id: ALBUM, reveal_at: FUTURE }, momen_photos: null },
      calls,
    );

    const res = await moderateMomenPhotoAction(INV, {
      photoId: PHOTO,
      action: "delete",
    });

    expect(res.status).toBe("error");
    expect(storage.delete).not.toHaveBeenCalled();
    expect(
      calls.some((c) => c.table === "momen_photos" && c.op === "delete"),
    ).toBe(false);
  });

  it("bukan pemilik undangan → ditolak sebelum menyentuh foto", async () => {
    refs.server = makeClient({ invitations: null }, calls); // RLS → 0 baris
    refs.admin = makeClient(
      { momen_albums: { id: ALBUM, reveal_at: FUTURE } },
      calls,
    );

    const res = await moderateMomenPhotoAction(INV, {
      photoId: PHOTO,
      action: "hide",
    });

    expect(res.status).toBe("error");
    expect(calls.some((c) => c.table === "momen_photos")).toBe(false);
  });

  it("sembunyikan foto milik sendiri → update status hidden", async () => {
    refs.server = makeClient({ invitations: { id: INV } }, calls);
    refs.admin = makeClient(
      {
        momen_albums: { id: ALBUM, reveal_at: FUTURE },
        momen_photos: {
          id: PHOTO,
          storage_path: "a",
          thumb_path: "b",
          purged_at: null,
        },
      },
      calls,
    );

    const res = await moderateMomenPhotoAction(INV, {
      photoId: PHOTO,
      action: "hide",
    });

    expect(res).toEqual({ status: "success" });
    const upd = calls.find(
      (c) => c.table === "momen_photos" && c.op === "update",
    );
    expect(upd?.payload).toEqual({ status: "hidden" });
  });
});

/**
 * Moderasi SADAR-FASE (AUDIT-2026-09-04 KEA-3). Bucket media publik + cache 1
 * tahun: setelah reveal, URL foto sudah tersebar ke setiap tamu, sehingga
 * menandai `status='hidden'` saja membuat baris hilang dari galeri sementara
 * objeknya tetap melayani 200 selamanya — UI berbohong.
 */
describe("moderateMomenPhotoAction — pencabutan akses sadar-fase", () => {
  function setup(revealAt: string | null, purgedAt: string | null = null) {
    refs.server = makeClient({ invitations: { id: INV } }, calls);
    refs.admin = makeClient(
      {
        momen_albums: { id: ALBUM, reveal_at: revealAt },
        momen_photos: {
          id: PHOTO,
          storage_path: "momen/a/p/display.webp",
          thumb_path: "momen/a/p/thumb.webp",
          purged_at: purgedAt,
        },
      },
      calls,
    );
  }
  const hidePayload = () =>
    calls.find((c) => c.table === "momen_photos" && c.op === "update")
      ?.payload as Record<string, unknown> | undefined;

  it("PRA-reveal: objek belum pernah publik → TIDAK dihapus, bisa dipulihkan", async () => {
    setup(FUTURE);

    const res = await moderateMomenPhotoAction(INV, {
      photoId: PHOTO,
      action: "hide",
    });

    expect(res).toEqual({ status: "success" });
    expect(storage.delete).not.toHaveBeenCalled();
    expect(hidePayload()).toEqual({ status: "hidden" });
    expect(hidePayload()).not.toHaveProperty("purged_at");
  });

  it("PASCA-reveal: objek DIHAPUS dan purged_at dicatat", async () => {
    setup(null); // null = langsung tampil = sudah revealed

    const res = await moderateMomenPhotoAction(INV, {
      photoId: PHOTO,
      action: "hide",
    });

    expect(res).toEqual({ status: "success" });
    expect(storage.delete).toHaveBeenCalledTimes(2);
    expect(storage.delete).toHaveBeenCalledWith("momen/a/p/display.webp");
    expect(storage.delete).toHaveBeenCalledWith("momen/a/p/thumb.webp");
    expect(hidePayload()?.status).toBe("hidden");
    expect(hidePayload()?.purged_at).toEqual(expect.any(String));
  });

  it("foto yang berkasnya sudah dihapus TIDAK bisa ditampilkan lagi", async () => {
    setup(null, "2026-09-13T10:00:00.000Z");

    const res = await moderateMomenPhotoAction(INV, {
      photoId: PHOTO,
      action: "show",
    });

    expect(res.status).toBe("error");
    // Tak boleh ada update status yang membuatnya "visible" tanpa berkas.
    expect(
      calls.some((c) => c.table === "momen_photos" && c.op === "update"),
    ).toBe(false);
  });

  it("foto yang disembunyikan PRA-reveal tetap bisa ditampilkan lagi", async () => {
    setup(FUTURE, null);

    const res = await moderateMomenPhotoAction(INV, {
      photoId: PHOTO,
      action: "show",
    });

    expect(res).toEqual({ status: "success" });
    expect(hidePayload()).toEqual({ status: "visible" });
  });

  it("sembunyikan ulang foto yang sudah tercabut → tak menghapus dua kali", async () => {
    setup(null, "2026-09-13T10:00:00.000Z");

    const res = await moderateMomenPhotoAction(INV, {
      photoId: PHOTO,
      action: "hide",
    });

    expect(res).toEqual({ status: "success" });
    expect(storage.delete).not.toHaveBeenCalled();
    expect(hidePayload()).not.toHaveProperty("purged_at");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `createUpgradeCheckoutAction` — jalur uang KETIGA di produk ini
 * (AUDIT-2026-10-01 B3). Ia menagih SELISIH harga untuk paket yang sama yang
 * dijual utuh oleh `createCheckoutAction`, jadi setiap kebocoran gerbangnya
 * berarti masa aktif penuh dengan harga selisih.
 *
 * Invarian yang dijaga di sini:
 *  - NOMINAL = selisih harga dari DB, tak pernah dari klien dan tak pernah
 *    harga penuh;
 *  - HANYA undangan milik pemanggil, berstatus `active`, belum di-purge, dan
 *    punya paket sekarang;
 *  - selisih ≤ 0 (paket sama / penurunan) ditolak SEBELUM order dibuat;
 *  - order upgrade yang belum lunas tak boleh digandakan;
 *  - UNDANGAN TIDAK DISENTUH sama sekali di sini — paketnya ditukar nanti oleh
 *    RPC, setelah `transactiondetail` mengonfirmasi;
 *  - harga paket SEKARANG dibaca tanpa filter `is_active` (paket yang
 *    dinonaktifkan mengembalikan NULL senyap → kredit hilang → selisih tampak
 *    sebesar harga penuh), paket TUJUAN dibaca dengan filter `is_active` +
 *    `kind='invitation'`.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { createPaymentLink } = vi.hoisted(() => ({
  createPaymentLink: vi.fn(() => "https://pakasir.test/pay/UPG"),
}));
vi.mock("@/lib/payment", () => ({
  getPaymentGateway: () => ({ createPaymentLink, verifyTransaction: vi.fn() }),
}));

const { refs } = vi.hoisted(() => ({
  refs: { server: null as unknown, admin: null as unknown },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => Promise.resolve(refs.server),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => refs.admin,
}));

import { copy } from "@/lib/copy";
import { createUpgradeCheckoutAction } from "@/server/actions/upgrade";

const INV = "44444444-4444-4444-8444-444444444444";
const USER = "55555555-5555-4555-8555-555555555555";
const PKG_BASIC = "pkg-basic";
const PKG_PREMIUM = "pkg-premium";

interface Call {
  table: string;
  op: string;
  payload?: unknown;
  filters: Record<string, unknown>;
}

/**
 * Klien palsu yang merekam operasi BESERTA filternya, dan — berbeda dari
 * harness checkout — menyelesaikan `packages` MENURUT FILTERNYA: `.eq("id", …)`
 * = paket sekarang, `.eq("code", …)` = paket tujuan. Tanpa itu kedua sisi
 * selisih akan mengembalikan baris yang sama dan test tak bisa membuktikan
 * nominalnya benar.
 */
function makeClient(
  data: Record<string, unknown>,
  calls: Call[],
  opts: {
    insertErrors?: ({ code: string } | null)[];
    user?: boolean;
    packagesById?: Record<string, unknown>;
    packagesByCode?: Record<string, unknown>;
  } = {},
) {
  const insertErrors = opts.insertErrors ?? [];
  let insertAttempt = 0;

  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    const chain: Record<string, unknown> = {};
    chain.select = () => {
      calls.push({ table, op: "select", filters });
      return chain;
    };
    chain.eq = (col: string, val: unknown) => {
      filters[col] = val;
      return chain;
    };
    chain.order = () => chain;
    chain.limit = () => chain;
    chain.insert = (payload: unknown) => {
      const error = insertErrors[insertAttempt] ?? null;
      insertAttempt += 1;
      calls.push({ table, op: "insert", payload, filters });
      return Promise.resolve({ error });
    };
    chain.update = (payload: unknown) => {
      calls.push({ table, op: "update", payload, filters });
      return chain;
    };
    const resolve = () => {
      if (table === "packages") {
        if (typeof filters.id === "string") {
          return opts.packagesById?.[filters.id] ?? null;
        }
        if (typeof filters.code === "string") {
          return opts.packagesByCode?.[filters.code] ?? null;
        }
        return null;
      }
      return data[table] ?? null;
    };
    chain.maybeSingle = () => Promise.resolve({ data: resolve(), error: null });
    return chain;
  };

  return {
    from: vi.fn(from),
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: opts.user === false ? null : { id: USER } },
        }),
    },
  };
}

let calls: Call[];

beforeEach(() => {
  calls = [];
  createPaymentLink.mockClear();
});

const AKTIF = {
  id: INV,
  status: "active",
  package_id: PKG_BASIC,
  purged_at: null,
};

/** Katalog bawaan: Basic 99.000 (sekarang) → Premium 199.000 (tujuan). */
function setup(
  inv: unknown,
  opts: {
    pendingUpgrade?: unknown;
    currentPrice?: number | null;
    targetPrice?: number | null;
    insertErrors?: ({ code: string } | null)[];
  } = {},
) {
  refs.server = makeClient({ invitations: inv }, calls);
  refs.admin = makeClient({ orders: opts.pendingUpgrade ?? null }, calls, {
    insertErrors: opts.insertErrors,
    packagesById:
      opts.currentPrice === null
        ? {}
        : { [PKG_BASIC]: { price_idr: opts.currentPrice ?? 99000 } },
    packagesByCode:
      opts.targetPrice === null
        ? {}
        : {
            premium: {
              id: PKG_PREMIUM,
              price_idr: opts.targetPrice ?? 199000,
            },
          },
  });
}

const ordersInserted = () =>
  calls.filter((c) => c.table === "orders" && c.op === "insert");
const invitationWrites = () =>
  calls.filter((c) => c.table === "invitations" && c.op !== "select");

describe("createUpgradeCheckoutAction — gerbang sebelum order dibuat", () => {
  it("belum login → ditolak, tanpa order maupun link bayar", async () => {
    refs.server = makeClient({}, calls, { user: false });
    refs.admin = makeClient({}, calls);

    const res = await createUpgradeCheckoutAction(INV, "premium");

    expect(res.status).toBe("error");
    expect(ordersInserted()).toHaveLength(0);
    expect(createPaymentLink).not.toHaveBeenCalled();
  });

  it("bukan pemilik (RLS 0 baris) → ditolak", async () => {
    setup(null);

    const res = await createUpgradeCheckoutAction(INV, "premium");

    expect(res.status).toBe("error");
    expect(ordersInserted()).toHaveLength(0);
  });

  it("id bukan UUID → ditolak tanpa menyentuh DB", async () => {
    setup(AKTIF);

    const res = await createUpgradeCheckoutAction("bukan-uuid", "premium");

    expect(res.status).toBe("error");
    expect(calls).toHaveLength(0);
  });

  it("kode paket di luar enum (termasuk kode add-on) ditolak", async () => {
    setup(AKTIF);

    for (const kode of ["momen_50", "", "premiumm"]) {
      const res = await createUpgradeCheckoutAction(INV, kode);
      expect(res.status).toBe("error");
    }
    expect(ordersInserted()).toHaveLength(0);
  });

  it("status selain `active` ditolak — upgrade bukan jalan murah ke masa aktif", async () => {
    // `expired` adalah yang paling berbahaya: membiarkannya lewat berarti
    // menjual periode BARU seharga selisih harga.
    for (const status of [
      "draft",
      "pending_payment",
      "expired",
      "suspended",
    ] as const) {
      calls = [];
      setup({ ...AKTIF, status });
      const res = await createUpgradeCheckoutAction(INV, "premium");
      expect(res).toEqual({
        status: "error",
        message: copy.upgrade.notUpgradable,
      });
      expect(ordersInserted()).toHaveLength(0);
    }
  });

  it("undangan yang datanya sudah di-purge tidak bisa di-upgrade", async () => {
    // Kerangka pasca-retensi: foto/tamu/ucapan sudah dihapus permanen.
    setup({ ...AKTIF, purged_at: "2026-09-01T00:00:00.000Z" });

    const res = await createUpgradeCheckoutAction(INV, "premium");

    expect(res).toEqual({
      status: "error",
      message: copy.upgrade.notUpgradable,
    });
    expect(ordersInserted()).toHaveLength(0);
  });

  it("tanpa paket sekarang → ditolak (tak ada yang bisa dikreditkan)", async () => {
    setup({ ...AKTIF, package_id: null });

    const res = await createUpgradeCheckoutAction(INV, "premium");

    expect(res).toEqual({
      status: "error",
      message: copy.upgrade.noCurrentPackage,
    });
    expect(ordersInserted()).toHaveLength(0);
  });

  it("order upgrade yang belum lunas → tak membuat order kedua", async () => {
    setup(AKTIF, {
      pendingUpgrade: {
        order_code: "MRV-UPG001",
        amount_idr: 100000,
        package_id: PKG_PREMIUM,
      },
    });

    const res = await createUpgradeCheckoutAction(INV, "premium");

    expect(res).toEqual({
      status: "error",
      message: copy.upgrade.orderPending,
    });
    expect(ordersInserted()).toHaveLength(0);
  });

  it("pencarian order menggantung disaring undangan, purpose upgrade, DAN pending", async () => {
    setup(AKTIF);

    await createUpgradeCheckoutAction(INV, "premium");

    const baca = calls.find((c) => c.table === "orders" && c.op === "select");
    expect(baca?.filters).toMatchObject({
      invitation_id: INV,
      purpose: "upgrade",
      status: "pending",
    });
  });
});

describe("createUpgradeCheckoutAction — selisih harga", () => {
  it("nominal = SELISIH dari DB, bukan harga penuh dan bukan dari klien", async () => {
    setup(AKTIF);

    const res = await createUpgradeCheckoutAction(INV, "premium");

    expect(res).toEqual({
      status: "redirect",
      url: "https://pakasir.test/pay/UPG",
    });
    expect(ordersInserted()).toHaveLength(1);
    expect(ordersInserted()[0]?.payload).toMatchObject({
      user_id: USER,
      invitation_id: INV,
      package_id: PKG_PREMIUM,
      amount_idr: 100000, // 199.000 − 99.000
      status: "pending",
      purpose: "upgrade",
    });
    expect(createPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({ amountIdr: 100000 }),
    );
  });

  it("paket yang SAMA → ditolak, tanpa order Rp0", async () => {
    setup(AKTIF, { currentPrice: 199000 });

    const res = await createUpgradeCheckoutAction(INV, "premium");

    expect(res).toEqual({
      status: "error",
      message: copy.upgrade.noDifference,
    });
    expect(ordersInserted()).toHaveLength(0);
  });

  it("penurunan paket → ditolak, tanpa nominal negatif", async () => {
    setup(AKTIF, { currentPrice: 299000 });

    const res = await createUpgradeCheckoutAction(INV, "premium");

    expect(res).toEqual({
      status: "error",
      message: copy.upgrade.noDifference,
    });
    expect(ordersInserted()).toHaveLength(0);
  });

  it("paket tujuan tak tersedia → ditolak", async () => {
    setup(AKTIF, { targetPrice: null });

    const res = await createUpgradeCheckoutAction(INV, "premium");

    expect(res).toEqual({
      status: "error",
      message: copy.upgrade.packageUnavailable,
    });
    expect(ordersInserted()).toHaveLength(0);
  });

  it("harga paket SEKARANG tak terbaca → ditolak, bukan dianggap nol", async () => {
    // Dianggap nol berarti menagih harga PENUH lewat jalur yang tak memberi
    // periode baru — tagihan paling buruk yang bisa dihasilkan fitur ini.
    setup(AKTIF, { currentPrice: null });

    const res = await createUpgradeCheckoutAction(INV, "premium");

    expect(res).toEqual({
      status: "error",
      message: copy.upgrade.packageUnavailable,
    });
    expect(ordersInserted()).toHaveLength(0);
  });

  it("paket sekarang dibaca TANPA filter is_active; paket tujuan DENGAN filter", async () => {
    setup(AKTIF);

    await createUpgradeCheckoutAction(INV, "premium");

    const bacaan = calls.filter(
      (c) => c.table === "packages" && c.op === "select",
    );
    const sekarang = bacaan.find((c) => c.filters.id === PKG_BASIC);
    const tujuan = bacaan.find((c) => c.filters.code === "premium");
    // Paket yang dinonaktifkan pemilik toko (mis. saat mengganti harga) harus
    // tetap bisa menjadi pengurang — kalau tidak, kreditnya hilang senyap.
    expect(sekarang?.filters).not.toHaveProperty("is_active");
    expect(tujuan?.filters).toMatchObject({
      is_active: true,
      kind: "invitation",
    });
  });
});

describe("createUpgradeCheckoutAction — efek samping", () => {
  it("UNDANGAN TIDAK DISENTUH: paket ditukar hanya setelah pembayaran terverifikasi", async () => {
    setup(AKTIF);

    await createUpgradeCheckoutAction(INV, "premium");

    expect(invitationWrites()).toHaveLength(0);
  });

  it("bentrok order_code (23505) → dicoba lagi dengan kode baru", async () => {
    setup(AKTIF, { insertErrors: [{ code: "23505" }, null] });

    const res = await createUpgradeCheckoutAction(INV, "premium");

    expect(res.status).toBe("redirect");
    expect(ordersInserted()).toHaveLength(2);
    const [a, b] = ordersInserted().map(
      (c) => (c.payload as { order_code: string }).order_code,
    );
    expect(a).not.toBe(b);
  });

  it("error DB selain 23505 → berhenti, tanpa link bayar", async () => {
    setup(AKTIF, { insertErrors: [{ code: "23502" }] });

    const res = await createUpgradeCheckoutAction(INV, "premium");

    expect(res.status).toBe("error");
    expect(ordersInserted()).toHaveLength(1);
    expect(createPaymentLink).not.toHaveBeenCalled();
  });
});

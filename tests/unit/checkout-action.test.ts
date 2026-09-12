import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `createCheckoutAction` — JALUR PENDAPATAN UTAMA, dan sampai audit
 * AUDIT-2026-09-04 (KUA-9) **tanpa satu pun test**. Dari 20 berkas Server Action
 * hanya 3 yang ber-test, ketiganya Album Momen; jalur uang inti justru kosong.
 *
 * Invarian yang dijaga di sini:
 *  - NOMINAL selalu dari DB, tak pernah dari klien;
 *  - hanya undangan MILIK pemanggil dan berstatus boleh-bayar yang bisa checkout
 *    (`active` = sudah dibayar, `suspended` = masalah konten → bukan self-service);
 *  - slug masih `draft-…` diblokir SEBELUM order dibuat (alamat publik terkunci
 *    setelah aktif, jadi salah urutan = 404 permanen);
 *  - kode paket add-on tak bisa dipakai di checkout undangan;
 *  - undangan TIDAK diaktifkan di sini — hanya `draft` → `pending_payment`, dan
 *    transisinya ber-guard `.eq("status","draft")`;
 *  - bentrok `order_code` (23505) dicoba ulang, error DB lain tidak.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { createPaymentLink } = vi.hoisted(() => ({
  createPaymentLink: vi.fn(() => "https://pakasir.test/pay/XYZ"),
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

import { createCheckoutAction } from "@/server/actions/checkout";

const INV = "44444444-4444-4444-8444-444444444444";
const USER = "55555555-5555-4555-8555-555555555555";

interface Call {
  table: string;
  op: string;
  payload?: unknown;
  filters: Record<string, unknown>;
}

/**
 * Klien palsu yang merekam operasi BESERTA filter `.eq(...)` — guard transisi
 * status hanya terlihat dari filternya, bukan dari payload.
 */
function makeClient(
  data: Record<string, unknown>,
  calls: Call[],
  opts: { insertErrors?: ({ code: string } | null)[]; user?: boolean } = {},
) {
  const insertErrors = opts.insertErrors ?? [];
  let insertAttempt = 0;

  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = (col: string, val: unknown) => {
      filters[col] = val;
      return chain;
    };
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
    chain.maybeSingle = () =>
      Promise.resolve({ data: data[table] ?? null, error: null });
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve({ data: data[table] ?? null, error: null }).then(
        res,
        rej,
      );
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

const PKG = { id: "pkg-premium", price_idr: 299000 };

let calls: Call[];

beforeEach(() => {
  calls = [];
  createPaymentLink.mockClear();
});

/** Setel undangan + paket; `admin` merekam order & transisi status. */
function setup(
  inv: unknown,
  pkg: unknown = PKG,
  adminOpts: { insertErrors?: ({ code: string } | null)[] } = {},
) {
  refs.server = makeClient({ invitations: inv, packages: pkg }, calls);
  refs.admin = makeClient({}, calls, adminOpts);
}

const orders = () => calls.filter((c) => c.table === "orders");

describe("createCheckoutAction — gerbang sebelum order dibuat", () => {
  it("belum login → ditolak, tak ada order maupun link bayar", async () => {
    refs.server = makeClient({}, calls, { user: false });
    refs.admin = makeClient({}, calls);

    const res = await createCheckoutAction(INV, "premium");

    expect(res.status).toBe("error");
    expect(orders()).toHaveLength(0);
    expect(createPaymentLink).not.toHaveBeenCalled();
  });

  it("bukan pemilik (RLS 0 baris) → ditolak", async () => {
    setup(null);

    const res = await createCheckoutAction(INV, "premium");

    expect(res.status).toBe("error");
    expect(orders()).toHaveLength(0);
  });

  it.each(["active", "suspended"])(
    "status %s tidak boleh checkout (sudah dibayar / bukan self-service)",
    async (status) => {
      setup({ id: INV, status, slug: "andi-sinta" });

      const res = await createCheckoutAction(INV, "premium");

      expect(res.status).toBe("error");
      expect(orders()).toHaveLength(0);
      expect(createPaymentLink).not.toHaveBeenCalled();
    },
  );

  it.each(["draft", "expired", "pending_payment"])(
    "status %s BOLEH checkout",
    async (status) => {
      setup({ id: INV, status, slug: "andi-sinta" });

      const res = await createCheckoutAction(INV, "premium");

      expect(res.status).toBe("redirect");
    },
  );

  it("slug masih `draft-…` → diblokir SEBELUM order (alamat terkunci saat aktif)", async () => {
    setup({ id: INV, status: "draft", slug: "draft-a1b2c3" });

    const res = await createCheckoutAction(INV, "premium");

    expect(res.status).toBe("error");
    expect(orders()).toHaveLength(0);
    expect(createPaymentLink).not.toHaveBeenCalled();
  });

  it("kode paket di luar enum (termasuk kode add-on) ditolak", async () => {
    for (const code of ["momen_50", "gratis", ""]) {
      calls = [];
      setup({ id: INV, status: "draft", slug: "andi-sinta" });

      const res = await createCheckoutAction(INV, code);

      expect(res.status).toBe("error");
      expect(orders()).toHaveLength(0);
    }
  });

  it("paket tak ditemukan/non-aktif → ditolak", async () => {
    setup({ id: INV, status: "draft", slug: "andi-sinta" }, null);

    const res = await createCheckoutAction(INV, "premium");

    expect(res.status).toBe("error");
    expect(orders()).toHaveLength(0);
  });
});

describe("createCheckoutAction — jalur sukses", () => {
  it("nominal dari DB (bukan klien) & order pending", async () => {
    setup({ id: INV, status: "draft", slug: "andi-sinta" });

    const res = await createCheckoutAction(INV, "premium");

    expect(res).toEqual({
      status: "redirect",
      url: "https://pakasir.test/pay/XYZ",
    });
    const payload = orders()[0]?.payload as Record<string, unknown>;
    expect(payload.amount_idr).toBe(299000);
    expect(payload.package_id).toBe("pkg-premium");
    expect(payload.user_id).toBe(USER);
    expect(payload.status).toBe("pending");

    // Link bayar memakai nominal yang SAMA dengan order.
    expect(createPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({ amountIdr: 299000 }),
    );
  });

  it("undangan TIDAK diaktifkan; transisi hanya draft → pending_payment, ber-guard", async () => {
    setup({ id: INV, status: "draft", slug: "andi-sinta" });

    await createCheckoutAction(INV, "premium");

    const upd = calls.find(
      (c) => c.table === "invitations" && c.op === "update",
    );
    expect(upd?.payload).toEqual({ status: "pending_payment" });
    // Guard `.eq("status","draft")` mencegah menimpa status lain (mis. expired).
    expect(upd?.filters.status).toBe("draft");
    expect(upd?.filters.id).toBe(INV);

    // Tak ada jalur yang menulis `active` di sini — aktivasi hanya lewat
    // verifikasi pembayaran yang otoritatif.
    expect(
      calls.some(
        (c) =>
          c.op === "update" &&
          (c.payload as Record<string, unknown>)?.status === "active",
      ),
    ).toBe(false);
  });
});

describe("createCheckoutAction — ketahanan pembuatan order", () => {
  it("bentrok order_code (23505) → dicoba lagi dengan kode baru", async () => {
    setup({ id: INV, status: "draft", slug: "andi-sinta" }, PKG, {
      insertErrors: [{ code: "23505" }, null],
    });

    const res = await createCheckoutAction(INV, "premium");

    expect(res.status).toBe("redirect");
    expect(orders()).toHaveLength(2);
    const a = (orders()[0]?.payload as Record<string, unknown>).order_code;
    const b = (orders()[1]?.payload as Record<string, unknown>).order_code;
    expect(a).not.toBe(b);
  });

  it("error DB selain 23505 → berhenti, tak ada link bayar", async () => {
    setup({ id: INV, status: "draft", slug: "andi-sinta" }, PKG, {
      insertErrors: [{ code: "23502" }],
    });

    const res = await createCheckoutAction(INV, "premium");

    expect(res.status).toBe("error");
    expect(orders()).toHaveLength(1); // tidak mencoba ulang
    expect(createPaymentLink).not.toHaveBeenCalled();
  });

  it("seluruh percobaan bentrok → menyerah tanpa link bayar", async () => {
    setup({ id: INV, status: "draft", slug: "andi-sinta" }, PKG, {
      insertErrors: Array.from({ length: 5 }, () => ({ code: "23505" })),
    });

    const res = await createCheckoutAction(INV, "premium");

    expect(res.status).toBe("error");
    expect(createPaymentLink).not.toHaveBeenCalled();
  });
});

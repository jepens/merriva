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
 *  - belum ada sesi jadwal BERJAM diblokir SEBELUM order, di semua status yang
 *    boleh bayar (DECISIONS #44) — tamu tak tahu kapan acaranya;
 *  - kode paket add-on tak bisa dipakai di checkout undangan;
 *  - undangan TIDAK diaktifkan di sini — hanya `draft` → `pending_payment`, dan
 *    transisinya ber-guard `.eq("status","draft")`;
 *  - bentrok `order_code` (23505) dicoba ulang, error DB lain tidak.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// `createPaymentLink` menjadi ASINKRON sejak Pakasir API v2 dan kini dibungkus
// `terbitkanLink` (`src/server/payment/link.ts`), yang juga MENYIMPAN `txn_id` ke
// baris order sebelum pelanggan diarahkan. Mock dipasang di lapisan itu: yang
// relevan bagi aksi ini adalah "dapat URL atau tidak", sementara urutan
// terbitkan-lalu-simpan diuji terpisah di tests/unit/payment-link.test.ts.
const { terbitkanLink } = vi.hoisted(() => ({
  terbitkanLink: vi.fn(async () => "https://pakasir.test/pay/XYZ"),
}));
vi.mock("@/server/payment/link", () => ({ terbitkanLink }));

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
  opts: {
    insertErrors?: ({ code: string } | null)[];
    user?: boolean;
    /** Galat query baca per tabel (mis. jadwal tak bisa dibaca). */
    errors?: Record<string, unknown>;
  } = {},
) {
  const insertErrors = opts.insertErrors ?? [];
  const errors = opts.errors ?? {};
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
    chain.maybeSingle = () =>
      Promise.resolve({ data: data[table] ?? null, error: null });
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve({
        data: data[table] ?? null,
        error: errors[table] ?? null,
      }).then(res, rej);
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
/** Satu sesi berjam — syarat jadwal terpenuhi (DECISIONS #44). */
const BERJAM = { name: "Akad", start_at: "2026-08-15T01:00:00Z" };

let calls: Call[];

beforeEach(() => {
  calls = [];
  terbitkanLink.mockClear();
});

/**
 * Setel undangan + paket + jadwal (bawaan: satu sesi berjam); `admin` merekam
 * order & transisi status.
 */
function setup(
  inv: unknown,
  pkg: unknown = PKG,
  adminOpts: { insertErrors?: ({ code: string } | null)[] } = {},
  server: {
    events?: unknown;
    errors?: Record<string, unknown>;
    /** Order pending yang sudah ada untuk undangan+paket yang sama. */
    pendingOrder?: unknown;
  } = {},
) {
  refs.server = makeClient(
    {
      invitations: inv,
      packages: pkg,
      invitation_events: "events" in server ? server.events : [BERJAM],
    },
    calls,
    { errors: server.errors },
  );
  refs.admin = makeClient(
    { orders: "pendingOrder" in server ? server.pendingOrder : null },
    calls,
    adminOpts,
  );
}

/**
 * HANYA percobaan INSERT order. Sejak penahan pembayaran-ganda dipasang
 * (AUDIT-2026-10-01 A3), jalur ini juga MEMBACA `orders` untuk mencari order
 * pending yang bisa dipakai ulang — bacaan itu bukan "order dibuat".
 */
const orders = () =>
  calls.filter((c) => c.table === "orders" && c.op === "insert");

describe("createCheckoutAction — gerbang sebelum order dibuat", () => {
  it("belum login → ditolak, tak ada order maupun link bayar", async () => {
    refs.server = makeClient({}, calls, { user: false });
    refs.admin = makeClient({}, calls);

    const res = await createCheckoutAction(INV, "premium");

    expect(res.status).toBe("error");
    expect(orders()).toHaveLength(0);
    expect(terbitkanLink).not.toHaveBeenCalled();
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
      expect(terbitkanLink).not.toHaveBeenCalled();
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

  it("undangan yang datanya sudah di-purge TIDAK bisa dibayar (DECISIONS #40)", async () => {
    // Kerangka pasca-retensi: foto/tamu/ucapan sudah dihapus permanen. Dashboard
    // menyembunyikannya, tetapi URL aktivasi lama masih bisa dibuka.
    setup({
      id: INV,
      status: "expired",
      slug: "andi-sinta",
      purged_at: "2026-01-05T00:00:00.000Z",
    });

    const res = await createCheckoutAction(INV, "premium");

    expect(res.status).toBe("error");
    expect(orders()).toHaveLength(0);
    expect(terbitkanLink).not.toHaveBeenCalled();
  });

  it("slug masih `draft-…` → diblokir SEBELUM order (alamat terkunci saat aktif)", async () => {
    setup({ id: INV, status: "draft", slug: "draft-a1b2c3" });

    const res = await createCheckoutAction(INV, "premium");

    expect(res.status).toBe("error");
    expect(orders()).toHaveLength(0);
    expect(terbitkanLink).not.toHaveBeenCalled();
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

describe("createCheckoutAction — syarat jadwal (DECISIONS #44)", () => {
  const tolakJadwal = async (
    res: Awaited<ReturnType<typeof createCheckoutAction>>,
  ) => {
    expect(res).toEqual({
      status: "error",
      message: copy.checkout.scheduleFirst,
      // Penanda agar klien me-refresh halaman aktivasi yang basi (#44).
      reason: "readiness",
    });
    expect(orders()).toHaveLength(0);
    expect(terbitkanLink).not.toHaveBeenCalled();
    // Tak ada transisi status: undangan tetap seperti semula.
    expect(
      calls.some((c) => c.table === "invitations" && c.op === "update"),
    ).toBe(false);
  };

  it.each(["draft", "expired", "pending_payment"])(
    "status %s tanpa sesi sama sekali → ditolak SEBELUM order (berlaku untuk SEMUA pembayaran)",
    async (status) => {
      setup({ id: INV, status, slug: "andi-sinta" }, PKG, {}, { events: [] });
      await tolakJadwal(await createCheckoutAction(INV, "premium"));
    },
  );

  it("hanya sesi TANPA jam → ditolak (sesi itu tak pernah tampil ke tamu)", async () => {
    setup(
      { id: INV, status: "draft", slug: "andi-sinta" },
      PKG,
      {},
      {
        events: [{ name: "Resepsi", start_at: null }],
      },
    );
    await tolakJadwal(await createCheckoutAction(INV, "premium"));
  });

  it("jadwal kosong (null dari DB) → ditolak", async () => {
    setup(
      { id: INV, status: "draft", slug: "andi-sinta" },
      PKG,
      {},
      { events: null },
    );
    await tolakJadwal(await createCheckoutAction(INV, "premium"));
  });

  it("SATU sesi berjam cukup: sesi lain yang belum berjam tak menahan bayar", async () => {
    setup(
      { id: INV, status: "draft", slug: "andi-sinta" },
      PKG,
      {},
      {
        events: [BERJAM, { name: "Resepsi", start_at: null }],
      },
    );
    const res = await createCheckoutAction(INV, "premium");
    expect(res.status).toBe("redirect");
    expect(orders()).toHaveLength(1);
  });

  it("alamat placeholder DAN jadwal kosong → pesan alamat lebih dulu (urutan halaman aktivasi)", async () => {
    setup(
      { id: INV, status: "draft", slug: "draft-a1b2c3" },
      PKG,
      {},
      { events: [] },
    );
    const res = await createCheckoutAction(INV, "premium");
    expect(res).toEqual({
      status: "error",
      message: copy.checkout.setSlugFirst,
      // Penanda agar klien me-refresh halaman aktivasi yang basi (#44).
      reason: "readiness",
    });
    expect(orders()).toHaveLength(0);
  });

  it("jadwal tak bisa dibaca → GAGAL-TERTUTUP: tak ada order maupun link bayar", async () => {
    setup(
      { id: INV, status: "draft", slug: "andi-sinta" },
      PKG,
      {},
      {
        errors: { invitation_events: { message: "timeout" } },
      },
    );
    const res = await createCheckoutAction(INV, "premium");
    expect(res).toEqual({ status: "error", message: copy.common.error });
    expect(orders()).toHaveLength(0);
    expect(terbitkanLink).not.toHaveBeenCalled();
  });

  it("jadwal dibaca dari undangan INI, lewat klien pengguna (RLS), bukan service_role", async () => {
    setup({ id: INV, status: "draft", slug: "andi-sinta" });
    await createCheckoutAction(INV, "premium");
    const baca = calls.filter((c) => c.table === "invitation_events");
    expect(baca).toHaveLength(1);
    expect(baca[0].filters.invitation_id).toBe(INV);
    expect(
      (
        refs.admin as { from: { mock: { calls: unknown[][] } } }
      ).from.mock.calls.some(([t]) => t === "invitation_events"),
    ).toBe(false);
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
    expect(terbitkanLink).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ amountIdr: 299000 }),
    );
  });

  it("order PENDING untuk paket yang sama dipakai ulang — bukan order kedua", async () => {
    // Penyebab utama pembayaran ganda: pemilik menekan bayar, meninggalkan
    // halaman Pakasir, lalu mencoba lagi. Dulu setiap percobaan membuat order
    // baru; bila keduanya dibayar, satu-satunya penyelesaiannya adalah refund.
    setup(
      { id: INV, status: "pending_payment", slug: "andi-sinta" },
      PKG,
      {},
      {
        pendingOrder: { order_code: "MRV-LAMA01", amount_idr: 299000 },
      },
    );

    const res = await createCheckoutAction(INV, "premium");

    expect(res).toEqual({
      status: "redirect",
      url: "https://pakasir.test/pay/XYZ",
    });
    expect(orders()).toHaveLength(0);
    // Link mengarah ke order LAMA, dengan nominal dari ORDER itu — bukan harga
    // paket saat ini, karena Pakasir menagih sesuai order yang sudah dibuat.
    expect(terbitkanLink).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderCode: "MRV-LAMA01", amountIdr: 299000 }),
    );
  });

  it("pencarian order pending disaring undangan, paket, status, DAN purpose", async () => {
    setup(
      { id: INV, status: "pending_payment", slug: "andi-sinta" },
      PKG,
      {},
      {
        pendingOrder: { order_code: "MRV-LAMA01", amount_idr: 299000 },
      },
    );

    await createCheckoutAction(INV, "premium");

    const baca = calls.find((c) => c.table === "orders" && c.op === "select");
    expect(baca?.filters).toMatchObject({
      invitation_id: INV,
      package_id: "pkg-premium",
      status: "pending",
      // Lihat test berikutnya untuk alasan `purpose`.
      purpose: "purchase",
    });
  });

  it("order UPGRADE yang menggantung TIDAK dipakai ulang sebagai aktivasi (B3)", async () => {
    // Order upgrade memakai paket tujuan yang SAMA (`premium`) tetapi nominalnya
    // hanya SELISIH harga. Tanpa filter `purpose`, pemilik yang punya order
    // upgrade belum lunas lalu menekan "Aktifkan"/"Perpanjang" akan dipakaikan
    // ulang order selisih itu — mendapat masa aktif PENUH dengan membayar
    // selisihnya. Filter inilah satu-satunya yang memisahkan dua harga untuk
    // satu paket, dan `toMatchObject` di test di atas tak akan pernah
    // menangkap ketidakhadirannya.
    const dipakai: Record<string, unknown>[] = [];
    setup(
      { id: INV, status: "expired", slug: "andi-sinta" },
      PKG,
      {},
      { pendingOrder: null },
    );

    await createCheckoutAction(INV, "premium");

    for (const c of calls) {
      if (c.table === "orders" && c.op === "select") dipakai.push(c.filters);
    }
    expect(dipakai).not.toHaveLength(0);
    for (const f of dipakai) expect(f.purpose).toBe("purchase");
  });

  it("order yang dibuat ditandai `purpose: purchase` secara eksplisit", async () => {
    // Jenis order adalah bagian kontrak jalur uang: membiarkannya bergantung
    // pada default kolom membuat perubahan default di DB mengubah arti order
    // tanpa satu baris kode pun berubah.
    setup({ id: INV, status: "draft", slug: "andi-sinta" });

    await createCheckoutAction(INV, "premium");

    expect(orders()[0]?.payload).toMatchObject({ purpose: "purchase" });
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
    expect(terbitkanLink).not.toHaveBeenCalled();
  });

  it("seluruh percobaan bentrok → menyerah tanpa link bayar", async () => {
    setup({ id: INV, status: "draft", slug: "andi-sinta" }, PKG, {
      insertErrors: Array.from({ length: 5 }, () => ({ code: "23505" })),
    });

    const res = await createCheckoutAction(INV, "premium");

    expect(res.status).toBe("error");
    expect(terbitkanLink).not.toHaveBeenCalled();
  });
});

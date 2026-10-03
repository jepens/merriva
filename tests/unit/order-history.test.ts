import { beforeEach, describe, expect, it } from "vitest";

import {
  attachRefs,
  buysActivePeriod,
  fetchOwnOrderPage,
  orderKindLabel,
  pendingPaymentPath,
  ORDER_HISTORY_PAGE_SIZE,
  type OrderRecord,
} from "@/server/orders/history";

/**
 * Riwayat pesanan pelanggan (AUDIT-2026-10-01 A4).
 *
 * Stub di bawah MEREKAM setiap argumen `.select()`, `.eq()`, `.in()`,
 * `.order()`, dan `.range()`. Itu disengaja: mock yang menulis
 * `chain.eq = () => chain` pernah membuat pemeriksaan kepemilikan di repo ini
 * tak teruji sama sekali — filternya bisa dihapus dan test tetap hijau.
 *
 * Dua invarian terpenting di berkas ini menyangkut kebocoran data:
 *   - `select` pada `orders` tak boleh `*` dan tak boleh memuat
 *     `raw_notification` (berisi payload mentah Pakasir dan `admin_id`);
 *   - `orders` HANYA dibaca klien sesi, `packages` HANYA klien admin.
 */

type Panggilan = {
  klien: "sesi" | "admin";
  tabel: string;
  select?: string;
  eq: [string, unknown][];
  in?: [string, unknown[]];
  order?: [string, unknown];
  range?: [number, number];
};

const state = {
  panggilan: [] as Panggilan[],
  data: {} as Record<string, { data: unknown; error: unknown }>,
};

function buatKlien(klien: "sesi" | "admin") {
  return {
    from(tabel: string) {
      const rec: Panggilan = { klien, tabel, eq: [] };
      state.panggilan.push(rec);
      const hasil = () => state.data[tabel] ?? { data: [], error: null };
      const chain: Record<string, unknown> = {};
      chain.select = (cols: string) => {
        rec.select = cols;
        return chain;
      };
      chain.eq = (col: string, val: unknown) => {
        rec.eq.push([col, val]);
        return chain;
      };
      chain.in = (col: string, vals: unknown[]) => {
        rec.in = [col, vals];
        return chain;
      };
      chain.order = (col: string, opts: unknown) => {
        rec.order = [col, opts];
        return chain;
      };
      chain.range = (a: number, b: number) => {
        rec.range = [a, b];
        return chain;
      };
      chain.then = (
        ok: (v: unknown) => unknown,
        fail: (e: unknown) => unknown,
      ) => Promise.resolve(hasil()).then(ok, fail);
      return chain;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const sesi = buatKlien("sesi");
const admin = buatKlien("admin");

function barisOrder(i: number, patch: Record<string, unknown> = {}) {
  return {
    order_code: `MRV-00000${i}`,
    status: "paid",
    amount_idr: 99000,
    payment_method: "qris",
    created_at: `2026-08-0${i}T03:00:00.000Z`,
    paid_at: `2026-08-0${i}T03:05:00.000Z`,
    invitation_id: "inv-1",
    package_id: "pkg-basic",
    ...patch,
  };
}

function cari(tabel: string) {
  const p = state.panggilan.find((x) => x.tabel === tabel);
  if (!p) throw new Error(`tabel ${tabel} tak pernah dibaca`);
  return p;
}

beforeEach(() => {
  state.panggilan = [];
  state.data = {};
});

describe("fetchOwnOrderPage", () => {
  it("tak pernah select('*') dan tak pernah membaca raw_notification", () => {
    state.data.orders = { data: [barisOrder(1)], error: null };
    return fetchOwnOrderPage(sesi, "u-1", 1).then(() => {
      const sel = cari("orders").select!;
      expect(sel).not.toBe("*");
      expect(sel).not.toContain("*");
      expect(sel).not.toContain("raw_notification");
      // Grant SELECT `authenticated` masih mencakup seluruh kolom `orders`,
      // jadi daftar eksplisit inilah satu-satunya yang menahan kebocoran.
      expect(sel).toContain("order_code");
      expect(sel).toContain("amount_idr");
    });
  });

  it("menyaring per pemilik, mengurutkan terbaru dulu", async () => {
    state.data.orders = { data: [barisOrder(1)], error: null };

    await fetchOwnOrderPage(sesi, "u-1", 1);

    const p = cari("orders");
    expect(p.klien).toBe("sesi");
    expect(p.eq).toEqual([["user_id", "u-1"]]);
    expect(p.order).toEqual(["created_at", { ascending: false }]);
  });

  it("mengambil PAGE_SIZE+1 baris; baris lebihnya dibuang dan menandai hasNext", async () => {
    const banyak = Array.from(
      { length: ORDER_HISTORY_PAGE_SIZE + 1 },
      (_, i) => ({
        ...barisOrder(1),
        order_code: `MRV-${String(i).padStart(6, "0")}`,
      }),
    );
    state.data.orders = { data: banyak, error: null };

    const { rows, hasNext } = await fetchOwnOrderPage(sesi, "u-1", 1);

    expect(cari("orders").range).toEqual([0, ORDER_HISTORY_PAGE_SIZE]);
    expect(hasNext).toBe(true);
    expect(rows).toHaveLength(ORDER_HISTORY_PAGE_SIZE);
    // Baris ke-(N+1) hanya penanda, tak boleh ikut tampil.
    expect(rows.at(-1)!.orderCode).toBe(
      `MRV-${String(ORDER_HISTORY_PAGE_SIZE - 1).padStart(6, "0")}`,
    );
  });

  it("tepat PAGE_SIZE baris → hasNext false (tak ada halaman kosong)", async () => {
    state.data.orders = {
      data: Array.from({ length: ORDER_HISTORY_PAGE_SIZE }, () =>
        barisOrder(1),
      ),
      error: null,
    };
    const { hasNext } = await fetchOwnOrderPage(sesi, "u-1", 1);
    expect(hasNext).toBe(false);
  });

  it("halaman 2 menggeser range, bukan mengulang halaman 1", async () => {
    state.data.orders = { data: [], error: null };
    await fetchOwnOrderPage(sesi, "u-1", 2);
    expect(cari("orders").range).toEqual([
      ORDER_HISTORY_PAGE_SIZE,
      ORDER_HISTORY_PAGE_SIZE * 2,
    ]);
  });

  it("galat DB MELEMPAR — tak pernah menjawab daftar kosong", async () => {
    // Halaman yang gunanya membuktikan pembayaran tak boleh berkata "belum ada
    // pesanan" saat DB bermasalah: itu membuat pelanggan mengira uangnya hilang.
    state.data.orders = {
      data: null,
      error: { message: "statement timeout", code: "57014" },
    };
    await expect(fetchOwnOrderPage(sesi, "u-1", 1)).rejects.toThrow(
      /riwayat pesanan/,
    );
  });
});

describe("attachRefs", () => {
  const records: OrderRecord[] = [
    {
      orderCode: "MRV-000001",
      status: "paid",
      amountIdr: 99000,
      paymentMethod: "qris",
      createdAt: "2026-08-01T03:00:00.000Z",
      paidAt: "2026-08-01T03:05:00.000Z",
      invitationId: "inv-1",
      packageId: "pkg-basic",
      purpose: "purchase",
    },
  ];

  it("undangan dibaca klien SESI dengan filter pemilik; paket dibaca klien ADMIN", async () => {
    state.data.invitations = {
      data: [
        { id: "inv-1", slug: "andi-sinta", status: "active", purged_at: null },
      ],
      error: null,
    };
    state.data.packages = {
      data: [{ id: "pkg-basic", name: "Basic", kind: "invitation" }],
      error: null,
    };

    const out = await attachRefs(sesi, admin, "u-1", records);

    const inv = cari("invitations");
    expect(inv.klien).toBe("sesi");
    expect(inv.eq).toEqual([["user_id", "u-1"]]);
    expect(inv.in).toEqual(["id", ["inv-1"]]);

    const pkg = cari("packages");
    // Klien admin dipakai SENGAJA: paket yang dinonaktifkan saat ganti harga
    // mengembalikan NULL senyap bagi pemilik, dan riwayat lama kehilangan nama
    // DAN `kind` sehingga add-on jadi salah label.
    expect(pkg.klien).toBe("admin");
    expect(pkg.in).toEqual(["id", ["pkg-basic"]]);
    // `is_active` TIDAK boleh difilter — itu justru yang hendak dilewati.
    expect(pkg.eq).toEqual([]);

    expect(out[0]).toMatchObject({
      packageName: "Basic",
      packageKind: "invitation",
      invitationSlug: "andi-sinta",
      invitationPurged: false,
    });
  });

  it("tabel orders TIDAK PERNAH disentuh klien admin", async () => {
    state.data.invitations = { data: [], error: null };
    state.data.packages = { data: [], error: null };

    await attachRefs(sesi, admin, "u-1", records);

    // Satu kelalaian `.eq("user_id", …)` di jalur admin akan membocorkan order
    // seluruh pelanggan sekaligus.
    expect(
      state.panggilan.filter(
        (p) => p.tabel === "orders" && p.klien === "admin",
      ),
    ).toHaveLength(0);
  });

  it("undangan yang sudah dipurge ditandai, bukan disembunyikan", async () => {
    state.data.invitations = {
      data: [
        {
          id: "inv-1",
          slug: "andi-sinta",
          status: "expired",
          purged_at: "2026-09-01T00:00:00.000Z",
        },
      ],
      error: null,
    };
    state.data.packages = { data: [], error: null };

    const out = await attachRefs(sesi, admin, "u-1", records);

    expect(out[0].invitationPurged).toBe(true);
    expect(out[0].invitationSlug).toBe("andi-sinta");
  });

  it("packages.kind tak dikenal → null, bukan crash", async () => {
    state.data.invitations = { data: [], error: null };
    state.data.packages = {
      data: [{ id: "pkg-basic", name: "Sesuatu", kind: "kind_baru" }],
      error: null,
    };

    const out = await attachRefs(sesi, admin, "u-1", records);
    expect(out[0].packageKind).toBeNull();
  });

  it("daftar kosong tak menyentuh DB sama sekali", async () => {
    const out = await attachRefs(sesi, admin, "u-1", []);
    expect(out).toEqual([]);
    expect(state.panggilan).toHaveLength(0);
  });
});

describe("orderKindLabel", () => {
  const c = {
    kindInvitation: "Paket undangan",
    kindAddonMomen: "Add-on Album Momen",
    kindUpgrade: "Upgrade paket",
    kindUnknown: "Pesanan",
  };

  it("label jenis dari packages.kind, bukan dari nominal", () => {
    // `premium` dan `momen_50` sama-sama Rp199.000 → nominal tak bisa
    // membedakan jenis, dan menebaknya dari nama paket sama rapuhnya.
    expect(orderKindLabel("invitation", "purchase", c)).toBe(c.kindInvitation);
    expect(orderKindLabel("addon_momen", "purchase", c)).toBe(c.kindAddonMomen);
    expect(orderKindLabel(null, "purchase", c)).toBe(c.kindUnknown);
  });

  it("order upgrade TIDAK terbaca sebagai paket undangan biasa (B3)", () => {
    // Paket tujuan upgrade memang paket undangan, jadi `kind` sendirian akan
    // melabelinya identik dengan aktivasi — dan riwayat pesanan pelanggan jadi
    // memperlihatkan dua "Paket undangan" untuk satu undangan.
    expect(orderKindLabel("invitation", "upgrade", c)).toBe(c.kindUpgrade);
  });
});

describe("pendingPaymentPath", () => {
  const INV = "inv-1";

  it("order upgrade menuju halaman upgrade, BUKAN /bayar", async () => {
    // `/bayar` berkunci pada status UNDANGAN dan langsung menyatakan
    // "Pembayaran berhasil! Undangan Anda kini aktif" bila undangannya
    // `active` — tepat keadaan SETIAP pembeli upgrade. Mengirimnya ke sana
    // berarti layar sukses untuk pembayaran yang belum terjadi.
    expect(pendingPaymentPath(INV, "invitation", "upgrade")).toBe(
      "/dashboard/undangan/inv-1/upgrade",
    );
  });

  it("add-on menuju halaman kelola album (alasan yang sama)", () => {
    expect(pendingPaymentPath(INV, "addon_momen", "purchase")).toBe(
      "/dashboard/undangan/inv-1/momen",
    );
  });

  it("purpose MENANG atas kind — aturan yang sama di label & RPC", () => {
    // Kombinasi ini TAK TERJANGKAU lewat produk: checkout upgrade memfilter
    // `kind='invitation'`. Ia dipaku bukan karena bisa terjadi, melainkan karena
    // urutan pemeriksaannya kalau tidak akan jadi satu-satunya aturan presedensi
    // di repo ini yang tak diuji — sementara `orderKindLabel` dan kedua cabang
    // RPC semuanya memeriksa `purpose` lebih dulu. Satu aturan, di semua tempat.
    expect(pendingPaymentPath(INV, "addon_momen", "upgrade")).toBe(
      "/dashboard/undangan/inv-1/upgrade",
    );
  });

  it("aktivasi & perpanjangan menuju /bayar", () => {
    expect(pendingPaymentPath(INV, "invitation", "purchase")).toBe(
      "/dashboard/undangan/inv-1/bayar",
    );
    // Paket tak terbaca → jalur paling umum, bukan halaman yang tak relevan.
    expect(pendingPaymentPath(INV, null, "purchase")).toBe(
      "/dashboard/undangan/inv-1/bayar",
    );
  });
});

describe("buysActivePeriod", () => {
  it("hanya order PEMBELIAN paket undangan yang membeli masa aktif", () => {
    expect(buysActivePeriod("invitation", "purchase")).toBe(true);
  });

  it("upgrade TIDAK membeli masa aktif — kuitansinya tak boleh mengaku begitu", () => {
    // Inti B3: tanpa ini kuitansi upgrade mencetak "Masa aktif dibeli: 12 bulan"
    // untuk pembayaran selisih yang tak membeli satu bulan pun. Pada dokumen
    // bukti pembayaran itu keterangan yang salah.
    expect(buysActivePeriod("invitation", "upgrade")).toBe(false);
  });

  it("add-on Album Momen juga tidak (album ikut retensi undangan)", () => {
    expect(buysActivePeriod("addon_momen", "purchase")).toBe(false);
    expect(buysActivePeriod(null, "purchase")).toBe(false);
  });
});

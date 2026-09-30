import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Halaman riwayat pesanan ASLI (AUDIT-2026-10-01 A4), dirender dengan dua klien
 * Supabase palsu yang MEREKAM setiap argumen filter.
 *
 * Invarian inti: SELURUH order pemilik tampil. Sebelum halaman ini, satu-satunya
 * bacaan order dari sisi pelanggan memakai `.limit(1)` — perpanjangan dan add-on
 * Album Momen menimbun order aktivasi pertama, sehingga kode order yang
 * diwajibkan kebijakan refund praktis hilang.
 */

vi.mock("@/server/guards/auth", () => ({
  requireUser: vi.fn(async () => ({ id: "u-1" })),
}));

type Panggilan = {
  klien: "sesi" | "admin";
  tabel: string;
  select?: string;
  eq: [string, unknown][];
};

const { refs } = vi.hoisted(() => ({
  refs: {
    panggilan: [] as Panggilan[],
    data: {} as Record<string, { data: unknown; error: unknown }>,
  },
}));

function buatKlien(klien: "sesi" | "admin") {
  return {
    from(tabel: string) {
      const rec: Panggilan = { klien, tabel, eq: [] };
      refs.panggilan.push(rec);
      const hasil = () => refs.data[tabel] ?? { data: [], error: null };
      const chain: Record<string, unknown> = {};
      for (const op of ["in", "order", "range"]) chain[op] = () => chain;
      chain.select = (cols: string) => {
        rec.select = cols;
        return chain;
      };
      chain.eq = (col: string, val: unknown) => {
        rec.eq.push([col, val]);
        return chain;
      };
      chain.then = (
        ok: (v: unknown) => unknown,
        fail: (e: unknown) => unknown,
      ) => Promise.resolve(hasil()).then(ok, fail);
      return chain;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => buatKlien("sesi"),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => buatKlien("admin"),
}));

import { copy } from "@/lib/copy";
import OrdersPage from "@/app/(dashboard)/dashboard/pesanan/page";

const t = copy.dashboard.orders;

/** Tiga order pada SATU undangan: aktivasi, perpanjangan, lalu add-on Momen. */
const TIGA_ORDER = [
  {
    order_code: "MRV-ADDON1",
    status: "paid",
    amount_idr: 199000,
    payment_method: "qris",
    created_at: "2026-08-20T03:00:00.000Z",
    paid_at: "2026-08-20T03:05:00.000Z",
    invitation_id: "inv-1",
    package_id: "pkg-momen",
  },
  {
    order_code: "MRV-RENEW1",
    status: "paid",
    amount_idr: 99000,
    payment_method: null,
    created_at: "2026-08-10T03:00:00.000Z",
    paid_at: "2026-08-10T03:05:00.000Z",
    invitation_id: "inv-1",
    package_id: "pkg-basic",
  },
  {
    order_code: "MRV-FIRST1",
    status: "paid",
    amount_idr: 99000,
    payment_method: "manual",
    created_at: "2026-02-01T03:00:00.000Z",
    paid_at: "2026-02-01T03:05:00.000Z",
    invitation_id: "inv-1",
    package_id: "pkg-basic",
  },
];

const INV_AKTIF = [
  { id: "inv-1", slug: "andi-sinta", status: "active", purged_at: null },
];
const PAKET = [
  { id: "pkg-basic", name: "Basic", kind: "invitation" },
  { id: "pkg-momen", name: "Album Momen 50", kind: "addon_momen" },
];

async function renderHalaman(page?: string) {
  render(await OrdersPage({ searchParams: Promise.resolve({ page }) }));
}

function panggilan(tabel: string) {
  const p = refs.panggilan.find((x) => x.tabel === tabel);
  if (!p) throw new Error(`tabel ${tabel} tak pernah dibaca`);
  return p;
}

beforeEach(() => {
  refs.panggilan = [];
  refs.data = {
    orders: { data: TIGA_ORDER, error: null },
    invitations: { data: INV_AKTIF, error: null },
    packages: { data: PAKET, error: null },
  };
});
afterEach(cleanup);

describe("/dashboard/pesanan", () => {
  it("menampilkan SEMUA order, bukan hanya yang terakhir", async () => {
    await renderHalaman();

    // Inti temuan A4.
    expect(screen.getByText("MRV-FIRST1")).toBeTruthy();
    expect(screen.getByText("MRV-RENEW1")).toBeTruthy();
    expect(screen.getByText("MRV-ADDON1")).toBeTruthy();
  });

  it("urutan dari DB dipertahankan (terbaru dulu)", async () => {
    await renderHalaman();

    const kode = screen.getAllByText(/^MRV-/).map((el) => el.textContent);
    expect(kode).toEqual(["MRV-ADDON1", "MRV-RENEW1", "MRV-FIRST1"]);
  });

  it("membaca orders dengan klien sesi, tersaring pemilik, tanpa raw_notification", async () => {
    await renderHalaman();

    const p = panggilan("orders");
    expect(p.klien).toBe("sesi");
    expect(p.eq).toEqual([["user_id", "u-1"]]);
    expect(p.select).not.toContain("raw_notification");
    expect(p.select).not.toContain("*");
  });

  it("add-on dibedakan dari paket undangan lewat kind, bukan nominal", async () => {
    await renderHalaman();

    // `premium` dan `momen_50` sama-sama Rp199.000 — label harus dari `kind`.
    expect(screen.getByText(t.kindAddonMomen)).toBeTruthy();
    expect(screen.getAllByText(t.kindInvitation)).toHaveLength(2);
    expect(screen.getByText("Album Momen 50")).toBeTruthy();
  });

  it("metode pembayaran: null → tanda pisah, manual → labelnya", async () => {
    await renderHalaman();

    expect(screen.getByText(t.methodLabel.manual)).toBeTruthy();
    expect(screen.getByText("QRIS")).toBeTruthy();
    expect(screen.getAllByText(t.dash).length).toBeGreaterThan(0);
  });

  it("tanggal memakai JAM — dua order di hari sama tak boleh tampil identik", async () => {
    refs.data.orders = {
      data: [
        {
          ...TIGA_ORDER[0],
          order_code: "MRV-PAGI01",
          created_at: "2026-08-20T01:00:00.000Z",
        },
        {
          ...TIGA_ORDER[0],
          order_code: "MRV-SORE01",
          created_at: "2026-08-20T09:00:00.000Z",
        },
      ],
      error: null,
    };

    await renderHalaman();

    const dibuat = screen
      .getAllByText(t.colCreated)
      .map((dt) => dt.nextElementSibling?.textContent);
    expect(dibuat).toHaveLength(2);
    expect(dibuat[0]).not.toBe(dibuat[1]);
  });

  it("undangan yang sudah dipurge: slug sebagai teks, TANPA tautan", async () => {
    refs.data.invitations = {
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

    await renderHalaman();

    expect(screen.getAllByText(t.invitationDeleted).length).toBeGreaterThan(0);
    // Halaman /edit sengaja menyembunyikan baris ber-purged_at → jangan ditaut.
    expect(
      document.querySelectorAll('a[href*="/dashboard/undangan/inv-1/edit"]'),
    ).toHaveLength(0);
  });

  it("order lunas tapi undangan belum aktif → kartu perhatian + kontak dukungan", async () => {
    refs.data.orders = {
      data: [{ ...TIGA_ORDER[2], order_code: "MRV-STUCK1" }],
      error: null,
    };
    refs.data.invitations = {
      data: [
        {
          id: "inv-1",
          slug: "andi-sinta",
          status: "pending_payment",
          purged_at: null,
        },
      ],
      error: null,
    };

    await renderHalaman();

    expect(screen.getByText(t.attentionTitle)).toBeTruthy();
    expect(screen.getAllByText(copy.support.email).length).toBeGreaterThan(0);
    // Kode order ikut ke mailto agar pelanggan tak perlu menyalinnya sendiri.
    const mailto =
      document.querySelector<HTMLAnchorElement>('a[href^="mailto:"]')!;
    expect(decodeURIComponent(mailto.getAttribute("href")!)).toContain(
      "MRV-STUCK1",
    );
  });

  it("add-on yang lunas TIDAK memicu kartu perhatian", async () => {
    // Add-on tak mengubah status undangan — membandingkannya akan memberi
    // alarm palsu pada setiap pembeli Album Momen.
    refs.data.orders = { data: [TIGA_ORDER[0]], error: null };
    refs.data.invitations = {
      data: [
        { id: "inv-1", slug: "andi-sinta", status: "expired", purged_at: null },
      ],
      error: null,
    };

    await renderHalaman();

    expect(screen.queryByText(t.attentionTitle)).toBeNull();
  });

  it("belum ada order → ajakan, bukan halaman kosong", async () => {
    refs.data.orders = { data: [], error: null };

    await renderHalaman();

    expect(screen.getByText(t.emptyTitle)).toBeTruthy();
  });

  it("galat DB MELEMPAR dan tak pernah berkata 'belum ada pesanan'", async () => {
    refs.data.orders = {
      data: null,
      error: { message: "statement timeout", code: "57014" },
    };

    await expect(
      OrdersPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow();
    expect(screen.queryByText(t.emptyTitle)).toBeNull();
  });
});

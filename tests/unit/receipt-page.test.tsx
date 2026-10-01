import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Halaman kuitansi `/dashboard/pesanan/[kode]` (AUDIT-2026-10-01 A4).
 *
 * Yang dikunci di sini terutama dua hal: kode order milik orang lain TIDAK
 * boleh dibedakan dari kode yang tak ada (kalau berbeda, halaman ini menjadi
 * oracle untuk menebak kode pelanggan lain), dan dokumen ini tak pernah
 * mengaku sebagai bukti bayar untuk pesanan yang belum lunas.
 */

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/server/guards/auth", () => ({
  requireUser: vi.fn(async () => ({ id: "u-1", email: "rina@contoh.co.id" })),
}));

type Panggilan = {
  klien: "sesi" | "admin";
  tabel: string;
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
      const hasil = () => refs.data[tabel] ?? { data: null, error: null };
      const chain: Record<string, unknown> = {};
      for (const op of ["select", "in", "order", "range"])
        chain[op] = () => chain;
      chain.eq = (col: string, val: unknown) => {
        rec.eq.push([col, val]);
        return chain;
      };
      chain.maybeSingle = () => Promise.resolve(hasil());
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
import ReceiptPage, {
  generateMetadata,
} from "@/app/(dashboard)/dashboard/pesanan/[kode]/page";

const t = copy.dashboard.orders;
const KODE = "MRV-8F3K2Q";

const ORDER_LUNAS = {
  order_code: KODE,
  status: "paid",
  amount_idr: 99000,
  payment_method: "qris",
  created_at: "2026-08-01T03:00:00.000Z",
  paid_at: "2026-08-01T03:05:00.000Z",
  invitation_id: "inv-1",
  package_id: "pkg-basic",
};

async function buka(kode = KODE) {
  render(await ReceiptPage({ params: Promise.resolve({ kode }) }));
}

beforeEach(() => {
  refs.panggilan = [];
  refs.data = {
    orders: { data: ORDER_LUNAS, error: null },
    invitations: {
      data: [
        {
          id: "inv-1",
          slug: "andi-sinta",
          status: "active",
          active_until: "2027-02-01T00:00:00.000Z",
          purged_at: null,
        },
      ],
      error: null,
    },
    packages: {
      data: [
        {
          id: "pkg-basic",
          name: "Basic",
          kind: "invitation",
          duration_months: 6,
        },
      ],
      error: null,
    },
    profiles: { data: { full_name: "Rina Pertiwi" }, error: null },
  };
});
afterEach(cleanup);

describe("kuitansi — penjagaan akses", () => {
  it("kode berbentuk salah → notFound, tanpa menyentuh DB", async () => {
    await expect(buka("bukan-kode")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(refs.panggilan).toHaveLength(0);
  });

  it("order milik orang lain tak bisa dibedakan dari kode yang tak ada", async () => {
    // RLS mengembalikan null untuk keduanya; halaman harus menjawab sama.
    refs.data.orders = { data: null, error: null };
    await expect(buka()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("galat DB MELEMPAR — tak pernah menyamar jadi 'kuitansi tidak ada'", async () => {
    // Bedanya menentukan: `notFound()` memberi tahu pelanggan bahwa bukti
    // pembayarannya tak ada, padahal yang gagal hanya koneksi DB. Ini kelas
    // yang sama dengan DECISIONS #45/#46 — galat bacaan tak boleh menyamar
    // jadi "data memang kosong".
    refs.data.orders = {
      data: null,
      error: { message: "statement timeout", code: "57014" },
    };

    await expect(buka()).rejects.toThrow(/kuitansi/);
    await expect(buka()).rejects.not.toThrow("NEXT_NOT_FOUND");
  });

  it("bacaan order disaring kode DAN pemilik", async () => {
    await buka();
    const p = refs.panggilan.find((x) => x.tabel === "orders")!;
    expect(p.klien).toBe("sesi");
    expect(p.eq).toEqual([
      ["order_code", KODE],
      ["user_id", "u-1"],
    ]);
  });

  it("kode disalin berikut spasi & huruf kecil tetap diterima", async () => {
    await buka(`  ${KODE.toLowerCase()}  `);
    const p = refs.panggilan.find((x) => x.tabel === "orders")!;
    expect(p.eq[0]).toEqual(["order_code", KODE]);
  });
});

describe("kuitansi — isi dokumen", () => {
  it("memuat penerbit dan alamat kontaknya", async () => {
    await buka();
    expect(screen.getByText(t.issuedBy)).toBeTruthy();
    expect(screen.getByText(`· ${copy.support.email}`)).toBeTruthy();
  });

  it("memuat kode, nominal, metode, paket, durasi, dan pembeli", async () => {
    await buka();
    expect(screen.getByText(KODE)).toBeTruthy();
    expect(screen.getByText("Rp99.000")).toBeTruthy();
    expect(screen.getByText("QRIS")).toBeTruthy();
    expect(screen.getByText("Basic")).toBeTruthy();
    expect(screen.getByText(t.durationMonths(6))).toBeTruthy();
    expect(screen.getByText("Rina Pertiwi", { exact: false })).toBeTruthy();
    expect(screen.getByText("rina@contoh.co.id")).toBeTruthy();
  });

  it("order lunas menyatakan sah tanpa tanda tangan", async () => {
    await buka();
    expect(screen.getByText(t.receiptValidityNote)).toBeTruthy();
    expect(screen.queryByText(t.receiptUnpaidNotice)).toBeNull();
  });

  it("order belum lunas TIDAK mengaku sebagai bukti bayar", async () => {
    refs.data.orders = {
      data: { ...ORDER_LUNAS, status: "pending", paid_at: null },
      error: null,
    };

    await buka();

    // Muncul dua kali: sebagai Alert dan sebagai catatan di dokumen.
    expect(screen.getAllByText(t.receiptUnpaidNotice).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText(t.receiptValidityNote)).toBeNull();
    // Tanggal bayar kosong → tanda pisah, bukan "null".
    expect(screen.getAllByText(t.dash).length).toBeGreaterThan(0);
  });

  it("add-on Momen tak menampilkan durasi maupun masa aktif undangan", async () => {
    refs.data.packages = {
      data: [
        {
          id: "pkg-basic",
          name: "Album Momen 50",
          kind: "addon_momen",
          duration_months: 6,
        },
      ],
      error: null,
    };

    await buka();

    expect(screen.getByText(t.kindAddonMomen)).toBeTruthy();
    expect(screen.queryByText(t.colDuration)).toBeNull();
    expect(screen.queryByText(t.colActiveUntil)).toBeNull();
  });

  it("undangan terpurge: slug tetap tercetak, ditandai sudah dihapus", async () => {
    refs.data.invitations = {
      data: [
        {
          id: "inv-1",
          slug: "andi-sinta",
          status: "expired",
          active_until: "2026-08-01T00:00:00.000Z",
          purged_at: "2027-02-01T00:00:00.000Z",
        },
      ],
      error: null,
    };

    await buka();

    // Nama mempelai sudah di-scrub dari `content`, jadi slug satu-satunya
    // label yang bertahan pada baris pasca-retensi.
    expect(screen.getByText("/andi-sinta", { exact: false })).toBeTruthy();
    expect(screen.getByText(t.invitationDeleted)).toBeTruthy();
  });

  it("judul tab memuat kode order untuk kode sah, judul generik untuk kode salah", async () => {
    const ok = await generateMetadata({
      params: Promise.resolve({ kode: KODE }),
    });
    expect(ok.title).toBe(t.receiptMetaTitle(KODE));

    const buruk = await generateMetadata({
      params: Promise.resolve({ kode: "salah" }),
    });
    expect(buruk.title).toBe(t.receiptTitle);
  });
});

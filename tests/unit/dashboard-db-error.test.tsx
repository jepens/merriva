import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Galat DB di permukaan ter-auth tak boleh menyamar jadi "belum ada data"
 * (AUDIT-2026-10-01 §6, kelas yang sama dengan DECISIONS #45/#46).
 *
 * Seluruh halaman dashboard & admin dulu memakai `const { data } = await …`
 * tanpa memeriksa `error`. Satu kedipan DB menghasilkan layar yang MEYAKINKAN:
 * "Belum ada undangan" bagi pemilik yang undangannya sedang aktif, dan tabel
 * order kosong di panel yang dipakai merekonsiliasi uang. Keduanya bukan
 * kegagalan yang terlihat — justru itu yang membuatnya mahal.
 */

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));
vi.mock("@/server/guards/auth", () => ({
  requireUser: vi.fn(async () => ({ id: "u-1" })),
  requireAdmin: vi.fn(async () => ({ id: "admin-1" })),
}));

const { refs } = vi.hoisted(() => ({
  refs: { data: {} as Record<string, { data: unknown; error: unknown }> },
}));

function klien() {
  return {
    from(tabel: string) {
      const hasil = () => refs.data[tabel] ?? { data: [], error: null };
      const chain: Record<string, unknown> = {};
      for (const op of [
        "select",
        "eq",
        "is",
        "in",
        "not",
        "order",
        "range",
        "limit",
        "ilike",
      ]) {
        chain[op] = () => chain;
      }
      chain.single = () => Promise.resolve(hasil());
      chain.maybeSingle = () => Promise.resolve(hasil());
      chain.then = (
        ok: (v: unknown) => unknown,
        bad: (e: unknown) => unknown,
      ) => Promise.resolve(hasil()).then(ok, bad);
      return chain;
    },
  };
}
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => klien(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => klien(),
}));

import { copy } from "@/lib/copy";
import DashboardPage from "@/app/(dashboard)/dashboard/page";

const BOOM = {
  message: "canceling statement due to statement timeout",
  code: "57014",
};

beforeEach(() => {
  refs.data = {};
});
afterEach(cleanup);

describe("daftar undangan", () => {
  it("galat DB MELEMPAR, dan tak pernah berkata 'Belum ada undangan'", async () => {
    refs.data.invitations = { data: null, error: BOOM };

    // Pesan kosong itu meyakinkan justru karena ia bentuk layar yang sah —
    // pemilik menyimpulkan karyanya hilang, bukan bahwa sistemnya sedang sakit.
    await expect(DashboardPage()).rejects.toThrow(/daftar dashboard/);
    expect(screen.queryByText(copy.dashboard.emptyTitle)).toBeNull();
  });

  it("daftar yang benar-benar kosong TETAP menampilkan ajakan", async () => {
    // Pembedaannya yang penting: kosong ≠ gagal. Keduanya tak boleh tertukar.
    refs.data.invitations = { data: [], error: null };

    render(await DashboardPage());

    expect(screen.getByText(copy.dashboard.emptyTitle)).toBeTruthy();
  });

  it("baris pasca-retensi tetap disembunyikan, bukan dianggap galat", async () => {
    refs.data.invitations = {
      data: [
        {
          id: "inv-1",
          slug: "andi-sinta",
          category: "wedding",
          status: "active",
          event_date: "2026-12-20",
        },
      ],
      error: null,
    };

    render(await DashboardPage());

    expect(screen.getByText("andi-sinta", { exact: false })).toBeTruthy();
    expect(screen.queryByText(copy.dashboard.emptyTitle)).toBeNull();
  });
});

/**
 * Gerbang aktivasi hanya menuntut SATU SESI JADWAL yang lengkap — bukan
 * `event_date`. Jadi undangan bisa aktif dan benar di mana-mana (halaman tamu,
 * gambar OG, berkas kalender semuanya menurunkan tanggal dari sesi) sementara
 * kartu dashboard satu-satunya yang berkata "Tanggal belum diatur", membuat
 * pemiliknya mencari isian yang tak pernah wajib.
 */
describe("tanggal di kartu dashboard", () => {
  const undangan = (extra: object) => ({
    data: [
      {
        id: "inv-1",
        slug: "khitanan-rafa",
        category: "family",
        status: "active",
        event_date: null,
        settings: {},
        ...extra,
      },
    ],
    error: null,
  });

  it("`event_date` kosong → pakai sesi jadwal paling awal", async () => {
    refs.data.invitations = undangan({});
    refs.data.invitation_events = {
      data: [{ invitation_id: "inv-1", start_at: "2026-12-20T02:00:00Z" }],
      error: null,
    };

    render(await DashboardPage());

    // 02:00 UTC = 09:00 WIB, masih 20 Desember — bukan pergeseran hari.
    expect(screen.getByText("2026-12-20")).toBeTruthy();
    expect(screen.queryByText("Tanggal belum diatur")).toBeNull();
  });

  it("zona undangan dihormati, bukan selalu WIB", async () => {
    // Jamnya dipilih supaya WIB dan WIT BERBEDA HARI — itulah seluruh guna
    // test ini. 15:30 UTC → WIB (+7) 22:30 tanggal 20, WIT (+9) 00:30 tanggal
    // 21. Versi pertama test ini memakai 17:30 UTC, yang menghasilkan tanggal
    // 21 di KEDUA zona: ia lulus tanpa membedakan apa pun.
    refs.data.invitations = undangan({
      settings: { timezone: "Asia/Jayapura" },
    });
    refs.data.invitation_events = {
      data: [{ invitation_id: "inv-1", start_at: "2026-12-20T15:30:00Z" }],
      error: null,
    };

    render(await DashboardPage());

    expect(screen.getByText("2026-12-21")).toBeTruthy();
  });

  it("`event_date` ada → ia yang menang, sesi tak menimpanya", async () => {
    refs.data.invitations = undangan({ event_date: "2026-10-31" });
    refs.data.invitation_events = {
      data: [{ invitation_id: "inv-1", start_at: "2026-12-20T02:00:00Z" }],
      error: null,
    };

    render(await DashboardPage());

    expect(screen.getByText("2026-10-31")).toBeTruthy();
  });

  it("tanpa sesi berjam sama sekali → tetap 'Tanggal belum diatur'", async () => {
    refs.data.invitations = undangan({});
    refs.data.invitation_events = { data: [], error: null };

    render(await DashboardPage());

    expect(screen.getByText("Tanggal belum diatur")).toBeTruthy();
  });
});

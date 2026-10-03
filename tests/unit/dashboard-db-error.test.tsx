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

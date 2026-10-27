import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Menutup penjualan add-on Album Momen adalah gerbang rilis yang BENAR-BENAR
 * dipakai: `update public.packages set is_active = false where kind =
 * 'addon_momen'` (LAUNCH-CHECKLIST Fase 4, dijalankan 12 Okt 2026), supaya tier
 * `momen_5` yang gratis + self-service tak menghabiskan kuota media sebelum
 * penyimpanannya siap. `pnpm ops:verify` bahkan memperingatkan bila ada tier
 * yang menyala.
 *
 * Yang tak pernah ikut dipikirkan: halaman dashboard-nya. Query tier menyaring
 * `is_active=true`, jadi katalog tertutup menghasilkan array kosong — dan
 * panelnya tetap dirender, menampilkan ajakan "Pilih kapasitas peserta:" di
 * atas grid tanpa satu pun kartu. Pemiliknya tidak melihat gerbang; ia melihat
 * halaman yang gagal memuat, dan tak ada satu pun galat yang bisa ia laporkan.
 */

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  // Dipakai panel aktivasi (client component) setelah tier gratis dibuat.
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/server/guards/auth", () => ({
  requireUser: vi.fn(async () => ({ id: "u-1" })),
  isPaymentExempt: vi.fn(async () => false),
}));
// Server Action tak boleh dimuat di jsdom; panel hanya perlu referensinya.
vi.mock("@/server/actions/momen-checkout", () => ({
  activateFreeMomenAction: vi.fn(),
  createMomenCheckoutAction: vi.fn(),
}));

const { refs } = vi.hoisted(() => ({
  refs: { data: {} as Record<string, { data: unknown; error: unknown }> },
}));

function klien() {
  return {
    from(tabel: string) {
      const hasil = () => refs.data[tabel] ?? { data: [], error: null };
      const chain: Record<string, unknown> = {};
      for (const op of ["select", "eq", "in", "order", "limit"]) {
        chain[op] = () => chain;
      }
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

import MomenManagePage from "@/app/(dashboard)/dashboard/undangan/[id]/momen/page";
import { copy } from "@/lib/copy";

const a = copy.momen.activate;
const ID = "aaac1903-d4c6-4058-ba45-36eeb6684177";

/** Satu-satunya pemanggilan halaman: undangan aktif, belum punya album. */
function halaman() {
  return MomenManagePage({
    params: Promise.resolve({ id: ID }),
    searchParams: Promise.resolve({}),
  });
}

beforeEach(() => {
  refs.data = {
    invitations: {
      data: { id: ID, slug: "lala-lele", status: "active", user_id: "u-1" },
      error: null,
    },
    momen_albums: { data: null, error: null },
    orders: { data: null, error: null },
  };
});
afterEach(cleanup);

describe("halaman add-on Album Momen", () => {
  it("katalog tertutup menyebut dirinya, bukan meminta memilih dari nol pilihan", async () => {
    refs.data.packages = { data: [], error: null };

    render(await halaman());

    expect(screen.getByText(a.closedTitle)).toBeTruthy();
    // Inti regresinya: ajakan memilih tak boleh muncul tanpa yang bisa dipilih.
    expect(screen.queryByText(a.intro)).toBeNull();
  });

  it("katalog terbuka tetap menampilkan tier yang bisa dipilih", async () => {
    // Pembedaan yang menentukan: pesan "belum dibuka" tak boleh menelan
    // keadaan normal — kalau ia muncul juga di sini, test pertama lulus
    // karena alasan yang salah.
    refs.data.packages = {
      data: [
        {
          id: "pkg-1",
          code: "momen_5",
          price_idr: 0,
          limits: { quota_peserta: 5 },
        },
      ],
      error: null,
    };

    render(await halaman());

    expect(screen.getByText(a.intro)).toBeTruthy();
    expect(screen.getByText(a.peserta(5))).toBeTruthy();
    expect(screen.queryByText(a.closedTitle)).toBeNull();
  });
});

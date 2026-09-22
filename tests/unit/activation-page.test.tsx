import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Halaman aktivasi ASLI (SPEC §4.8 langkah 0, DECISIONS #44), dirender dengan
 * klien Supabase palsu:
 *  - SEMUA syarat yang belum terpenuhi tampil sekaligus, masing-masing dengan
 *    tautan ke tempat perbaikannya (jadwal → langsung langkah Jadwal);
 *  - pemilih paket TIDAK tampil selama masih ada syarat;
 *  - sesi berisi yang belum berjam tak menahan bayar, tetapi disebut namanya;
 *  - jadwal tak bisa dibaca → halaman tak mengklaim "jadwal kosong" (penahan
 *    server gagal-tertutup, lihat checkout-action.test.ts).
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));
vi.mock("@/server/guards/auth", () => ({
  requireUser: vi.fn(async () => ({ id: "u-1" })),
}));
vi.mock("@/server/actions/checkout", () => ({
  createCheckoutAction: vi.fn(),
}));

const { refs } = vi.hoisted(() => ({
  refs: {
    inv: null as unknown,
    events: [] as unknown,
    eventsError: null as unknown,
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.order = () => chain;
      chain.maybeSingle = () =>
        Promise.resolve({ data: refs.inv, error: null });
      chain.then = (
        ok: (v: unknown) => unknown,
        fail: (e: unknown) => unknown,
      ) =>
        Promise.resolve(
          table === "invitation_events"
            ? { data: refs.events, error: refs.eventsError }
            : table === "packages"
              ? {
                  data: [
                    {
                      code: "basic",
                      name: "Basic",
                      price_idr: 99000,
                      duration_months: 3,
                      limits: {},
                      is_active: true,
                    },
                  ],
                  error: null,
                }
              : { data: null, error: null },
        ).then(ok, fail);
      return chain;
    },
  }),
}));

import ActivateInvitationPage from "@/app/(dashboard)/dashboard/undangan/[id]/aktifkan/page";
import { copy } from "@/lib/copy";

const ID = "9a500f03-f12d-4d66-85fc-af8ebcedd350";
const BERJAM = { name: "Akad", start_at: "2026-08-15T01:00:00Z" };

async function buka() {
  render(await ActivateInvitationPage({ params: Promise.resolve({ id: ID }) }));
}

const tombolPaket = () =>
  screen.queryByRole("button", { name: copy.checkout.choose });

afterEach(cleanup);
beforeEach(() => {
  refs.inv = { id: ID, status: "draft", slug: "andi-sinta", purged_at: null };
  refs.events = [BERJAM];
  refs.eventsError = null;
});

describe("halaman aktivasi — daftar syarat sebelum bayar", () => {
  it("alamat & jadwal kurang: KEDUANYA tampil sekaligus, urut, dengan tautan perbaikannya", async () => {
    refs.inv = {
      id: ID,
      status: "draft",
      slug: "draft-a1b2c3",
      purged_at: null,
    };
    refs.events = [];
    await buka();

    expect(
      screen.getByRole("heading", { name: copy.checkout.readinessTitle }),
    ).toBeInTheDocument();
    const butir = screen.getAllByRole("listitem");
    expect(butir).toHaveLength(2);
    expect(within(butir[0]).getByRole("heading")).toHaveTextContent(
      copy.checkout.readiness.slug.title,
    );
    expect(
      within(butir[0]).getByRole("link", {
        name: copy.checkout.readiness.slug.cta,
      }),
    ).toHaveAttribute("href", `/dashboard/undangan/${ID}/edit`);
    expect(within(butir[1]).getByRole("heading")).toHaveTextContent(
      copy.checkout.readiness.schedule.title,
    );
    expect(
      within(butir[1]).getByRole("link", {
        name: copy.checkout.readiness.schedule.cta,
      }),
    ).toHaveAttribute("href", `/dashboard/undangan/${ID}/edit?langkah=jadwal`);

    expect(tombolPaket()).toBeNull();
  });

  it.each(["draft", "pending_payment", "expired"])(
    "status %s hanya dengan sesi TANPA jam → syarat jadwal, tanpa pemilih paket",
    async (status) => {
      refs.inv = { id: ID, status, slug: "andi-sinta", purged_at: null };
      refs.events = [{ name: "Resepsi", start_at: null }];
      await buka();

      const butir = screen.getAllByRole("listitem");
      expect(butir).toHaveLength(1);
      expect(butir[0]).toHaveTextContent(
        copy.checkout.readiness.schedule.title,
      );
      expect(tombolPaket()).toBeNull();
    },
  );

  it("siap: pemilih paket tampil, tanpa kartu syarat", async () => {
    await buka();

    expect(
      screen.queryByRole("heading", { name: copy.checkout.readinessTitle }),
    ).toBeNull();
    expect(tombolPaket()).toBeInTheDocument();
  });

  it("sesi lain yang belum berjam TIDAK menahan bayar, tetapi disebut namanya + tautan ke Jadwal", async () => {
    refs.events = [BERJAM, { name: "Resepsi", start_at: null }];
    await buka();

    expect(tombolPaket()).toBeInTheDocument();
    expect(
      screen.getByText(copy.checkout.unscheduledNote(["Resepsi"]), {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: copy.checkout.unscheduledCta }),
    ).toHaveAttribute("href", `/dashboard/undangan/${ID}/edit?langkah=jadwal`);
  });

  it("baris sesi KOSONG total (sisa lama) tak disebut di catatan — tak ada yang bisa diperbaiki di kartunya", async () => {
    refs.events = [
      BERJAM,
      {
        name: "",
        start_at: null,
        end_at: null,
        venue_name: null,
        address: null,
        maps_url: null,
      },
    ];
    await buka();

    expect(tombolPaket()).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: copy.checkout.unscheduledCta }),
    ).toBeNull();
  });

  it("jadwal tak bisa dibaca: halaman tak mengklaim jadwal kosong (server tetap gagal-tertutup)", async () => {
    refs.events = null;
    refs.eventsError = { message: "timeout" };
    await buka();

    expect(
      screen.queryByText(copy.checkout.readiness.schedule.title),
    ).toBeNull();
    expect(tombolPaket()).toBeInTheDocument();
  });

  it("galat jadwal TIDAK menyembunyikan syarat alamat", async () => {
    refs.inv = {
      id: ID,
      status: "draft",
      slug: "draft-a1b2c3",
      purged_at: null,
    };
    refs.events = null;
    refs.eventsError = { message: "timeout" };
    await buka();

    const butir = screen.getAllByRole("listitem");
    expect(butir).toHaveLength(1);
    expect(butir[0]).toHaveTextContent(copy.checkout.readiness.slug.title);
    expect(tombolPaket()).toBeNull();
  });
});

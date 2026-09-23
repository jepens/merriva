import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Sisi KLIEN dari DECISIONS #46 — dua perilaku yang hanya hidup di komponen dan
 * karenanya tak tertangkap test server:
 *
 *  1. `?g=` gagal sementara → TOKEN tamu tetap dipakai. Ini yang paling mahal:
 *     tanpa token, RSVP tamu tersimpan TAK TERTAUT, jumlah orangnya jatuh ke 2,
 *     dan di dashboard tamu itu tetap "belum RSVP" meski sudah konfirmasi.
 *  2. Dinding ucapan: "muat lebih" yang GAGAL tak boleh menghabiskan tombolnya
 *     (dulu `hasMore` ikut ditimpa false → tamu kehilangan sisa ucapan diam-diam).
 */

const { viewGuestByTokenAction, getGuestbookAction } = vi.hoisted(() => ({
  viewGuestByTokenAction: vi.fn(),
  getGuestbookAction: vi.fn(),
}));
vi.mock("@/server/actions/personalization", () => ({ viewGuestByTokenAction }));
vi.mock("@/server/actions/guestbook", () => ({ getGuestbookAction }));

import { copy } from "@/lib/copy";
import { GuestPersonalizationProvider } from "@/components/public/guest-personalization";
import { useGuestContext } from "@/components/public/guest-context";
import { GuestbookWall } from "@/components/public/guestbook/guestbook-wall";

const SLUG = "andi-sinta";
const TOKEN = "tokentamu123";

function Probe() {
  const g = useGuestContext();
  return (
    <span data-testid="ctx">{`${g.recipientName ?? "-"}|${g.guestToken ?? "-"}`}</span>
  );
}

function renderWithToken(search = `?g=${TOKEN}`) {
  window.history.replaceState({}, "", `/${SLUG}${search}`);
  return render(
    <GuestPersonalizationProvider slug={SLUG}>
      <Probe />
    </GuestPersonalizationProvider>,
  );
}

const ctx = () => screen.getByTestId("ctx").textContent;

beforeEach(() => {
  viewGuestByTokenAction.mockReset();
  getGuestbookAction.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("personalisasi ?g= — token selamat dari gangguan", () => {
  it("dua kali galat → nama kosong tapi TOKEN tetap dipegang (RSVP tetap tertaut)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    viewGuestByTokenAction.mockResolvedValue({ status: "error" });

    renderWithToken();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    await waitFor(() => expect(ctx()).toBe(`-|${TOKEN}`));
    // Coba-ulang sekali, bukan berkali-kali (link WA disebar serentak).
    expect(viewGuestByTokenAction).toHaveBeenCalledTimes(2);
  });

  it("galat lalu berhasil → sapaan muncul tanpa tamu memuat ulang", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    viewGuestByTokenAction
      .mockResolvedValueOnce({ status: "error" })
      .mockResolvedValueOnce({ status: "ok", name: "Sasa" });

    renderWithToken();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    await waitFor(() => expect(ctx()).toBe(`Sasa|${TOKEN}`));
  });

  it("token MEMANG tak dikenal → tak ada token yang dipegang (bukan sekadar galat)", async () => {
    viewGuestByTokenAction.mockResolvedValue({ status: "none" });

    renderWithToken();

    await waitFor(() =>
      expect(viewGuestByTokenAction).toHaveBeenCalledTimes(1),
    );
    expect(ctx()).toBe("-|-");
  });

  it("rate limit juga mempertahankan token", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    viewGuestByTokenAction.mockResolvedValue({ status: "rate" });

    renderWithToken();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    await waitFor(() => expect(ctx()).toBe(`-|${TOKEN}`));
  });
});

describe("dinding ucapan — gagal ≠ habis", () => {
  const entry = (id: string) => ({
    id,
    name: "Sasa",
    message: `ucapan ${id}`,
    createdAt: "2026-12-20T02:00:00Z",
  });

  it("muat awal gagal → 'coba lagi', BUKAN 'belum ada ucapan'", async () => {
    getGuestbookAction.mockResolvedValue({
      entries: [],
      hasMore: false,
      failed: true,
    });

    render(<GuestbookWall slug={SLUG} />);

    await screen.findByText(copy.guestbook.wall.failed, { exact: false });
    expect(screen.queryByText(copy.guestbook.wall.empty)).toBeNull();
    expect(
      screen.getByRole("button", { name: copy.guestbook.wall.retry }),
    ).toBeTruthy();
  });

  it("'muat lebih' gagal → tombolnya TETAP ada (kursor tak dihabiskan)", async () => {
    getGuestbookAction.mockResolvedValueOnce({
      entries: [entry("a")],
      hasMore: true,
    });
    render(<GuestbookWall slug={SLUG} />);
    const more = await screen.findByRole("button", {
      name: copy.guestbook.wall.loadMore,
    });

    getGuestbookAction.mockResolvedValueOnce({
      entries: [],
      hasMore: false,
      failed: true,
    });
    fireEvent.click(more);

    await screen.findByText(copy.guestbook.wall.failed, { exact: false });
    // Inti regresi: halaman berikutnya masih bisa dicoba ulang.
    expect(
      screen.getByRole("button", { name: copy.guestbook.wall.loadMore }),
    ).toBeTruthy();
    // Ucapan yang sudah termuat tidak ikut hilang.
    expect(screen.getByText("ucapan a")).toBeTruthy();
  });

  it("dinding memang kosong → 'belum ada ucapan', tanpa ajakan coba lagi", async () => {
    getGuestbookAction.mockResolvedValue({ entries: [], hasMore: false });

    render(<GuestbookWall slug={SLUG} />);

    await screen.findByText(copy.guestbook.wall.empty);
    expect(
      screen.queryByRole("button", { name: copy.guestbook.wall.retry }),
    ).toBeNull();
  });
});

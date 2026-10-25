import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pemilih paket saat server MENOLAK checkout (DECISIONS #44):
 *  - karena syarat bayar (halaman aktivasi basi, mis. jadwal dikosongkan di tab
 *    lain) → halaman di-refresh agar daftar syarat + tautan perbaikan tampil;
 *  - galat lain → tak di-refresh, dan pesannya digulirkan ke pandangan. Di
 *    ponsel kartu paket bertumpuk, jadi pesan di bawah kisi dulu jatuh di luar
 *    layar dan tombol terasa diam saja.
 */

const { refresh, checkout } = vi.hoisted(() => ({
  refresh: vi.fn(),
  checkout: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));
vi.mock("@/server/actions/checkout", () => ({
  createCheckoutAction: checkout,
}));

import { PackageChooser } from "@/components/dashboard/package-chooser";
import { copy } from "@/lib/copy";
import { resolveLimits } from "@/lib/limits";

const PAKET = [
  {
    code: "basic",
    name: "Basic",
    priceIdr: 99000,
    durationMonths: 6,
    limits: resolveLimits({}),
  },
  {
    code: "premium",
    name: "Premium",
    priceIdr: 199000,
    durationMonths: 12,
    limits: resolveLimits({}),
  },
];

async function pilihBasic() {
  const user = userEvent.setup();
  render(<PackageChooser invitationId="inv-1" packages={PAKET} />);
  await user.click(
    screen.getAllByRole("button", { name: copy.checkout.choose })[0],
  );
}

afterEach(cleanup);
beforeEach(() => {
  refresh.mockReset();
  checkout.mockReset();
});

describe("PackageChooser — penolakan server", () => {
  it("syarat bayar belum terpenuhi → pesan tampil DAN halaman di-refresh (daftar syarat menggantikan pemilih)", async () => {
    checkout.mockResolvedValue({
      status: "error",
      message: copy.checkout.scheduleFirst,
      reason: "readiness",
    });
    await pilihBasic();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      copy.checkout.scheduleFirst,
    );
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(checkout).toHaveBeenCalledWith("inv-1", "basic");
  });

  it("galat lain → TIDAK di-refresh; pesan digulirkan ke pandangan", async () => {
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    checkout.mockResolvedValue({
      status: "error",
      message: copy.checkout.packageUnavailable,
    });
    await pilihBasic();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(copy.checkout.packageUnavailable);
    expect(refresh).not.toHaveBeenCalled();
    expect(scroll.mock.contexts).toContain(alert);
    scroll.mockRestore();
  });

  it("tombol kembali aktif setelah ditolak (bisa mencoba lagi)", async () => {
    checkout.mockResolvedValue({ status: "error" });
    await pilihBasic();

    await screen.findByRole("alert");
    for (const b of screen.getAllByRole("button", {
      name: copy.checkout.choose,
    })) {
      expect(b).toBeEnabled();
    }
  });
});

describe("PackageChooser — akun Admin/Pro (DECISIONS #100)", () => {
  it("tanpa harga & notis pembayaran; 'Aktifkan gratis' memanggil aksi yang sama", async () => {
    // Galat agar klik tak memicu navigasi (jsdom tak mengenal `location.assign`).
    checkout.mockResolvedValue({ status: "error", message: "x" });
    const user = userEvent.setup();
    render(<PackageChooser invitationId="inv-1" packages={[PAKET[1]]} free />);

    expect(screen.getByText(copy.checkout.freePrice)).toBeInTheDocument();
    expect(screen.queryByText(/Rp\s?199\.000/)).toBeNull();
    expect(screen.queryByText(copy.checkout.securedBy)).toBeNull();
    expect(screen.queryByText(copy.checkout.popular)).toBeNull();
    expect(
      screen.queryByRole("button", { name: copy.checkout.choose }),
    ).toBeNull();

    await user.click(
      screen.getByRole("button", { name: copy.checkout.freeCta }),
    );
    expect(checkout).toHaveBeenCalledWith("inv-1", "premium");
  });
});

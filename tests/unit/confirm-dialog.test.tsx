import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ConfirmProvider,
  useConfirm,
  type ConfirmOptions,
} from "@/components/confirm-dialog";
import { copy } from "@/lib/copy";

// Provider hidup di layout; rute diganti lewat tiruan ini.
const nav = vi.hoisted(() => ({ pathname: "/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

/**
 * Pengganti `window.confirm` di dashboard & admin: dialog berbahasa Indonesia
 * berbasis `<dialog>` HTML. jsdom belum mengimplementasikan `showModal`, jadi
 * dipasang tiruan minimal (buka/tutup) — kecuali di test jalur cadangan.
 */

const asli = {
  showModal: HTMLDialogElement.prototype.showModal,
  close: HTMLDialogElement.prototype.close,
};

function pasangDialogTiruan() {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
}

let hasil: Promise<boolean> | null = null;

function Pemicu(props: { options: ConfirmOptions }) {
  const confirm = useConfirm();
  return (
    <button type="button" onClick={() => (hasil = confirm(props.options))}>
      pemicu
    </button>
  );
}

function pohon(options: ConfirmOptions) {
  return (
    <ConfirmProvider>
      <Pemicu options={options} />
    </ConfirmProvider>
  );
}

function buka(options: ConfirmOptions) {
  const r = render(pohon(options));
  act(() => {
    screen.getByText("pemicu").click();
  });
  return r;
}

const dialogTerbuka = () =>
  document.querySelector("dialog")!.hasAttribute("open");

/** `performance.now()` yang bisa digeser — jeda klik ganda diukur dengannya. */
function jamTiruan(mulai = 1000) {
  const jam = { sekarang: mulai };
  vi.spyOn(performance, "now").mockImplementation(() => jam.sekarang);
  return jam;
}

const HAPUS: ConfirmOptions = {
  title: "Hapus undangan ini secara permanen?",
  description: "Semua data akan dihapus.",
  confirmLabel: "Ya, hapus permanen",
  destructive: true,
};

beforeEach(() => {
  hasil = null;
  nav.pathname = "/dashboard";
  pasangDialogTiruan();
});
afterEach(() => {
  cleanup();
  HTMLDialogElement.prototype.showModal = asli.showModal;
  HTMLDialogElement.prototype.close = asli.close;
  vi.restoreAllMocks();
});

describe("ConfirmProvider / useConfirm", () => {
  it("menampilkan judul, penjelasan, dan tombol berbahasa Indonesia — tanpa window.confirm", () => {
    const native = vi.spyOn(window, "confirm");
    buka(HAPUS);
    const dialog = document.querySelector("dialog")!;
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(screen.getByText(HAPUS.title)).toBeInTheDocument();
    expect(screen.getByText(HAPUS.description!)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: HAPUS.confirmLabel }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: copy.common.cancel }),
    ).toBeInTheDocument();
    expect(native).not.toHaveBeenCalled();
  });

  it("tombol setuju → true, dialog tertutup", async () => {
    buka(HAPUS);
    act(() => {
      screen.getByRole("button", { name: HAPUS.confirmLabel }).click();
    });
    await expect(hasil).resolves.toBe(true);
    expect(document.querySelector("dialog")!.hasAttribute("open")).toBe(false);
  });

  it("tombol Batal → false", async () => {
    buka(HAPUS);
    act(() => {
      screen.getByRole("button", { name: copy.common.cancel }).click();
    });
    await expect(hasil).resolves.toBe(false);
  });

  it("Esc (event cancel) → false", async () => {
    buka(HAPUS);
    act(() => {
      fireEvent(
        document.querySelector("dialog")!,
        new Event("cancel", { cancelable: true }),
      );
    });
    await expect(hasil).resolves.toBe(false);
  });

  it("klik latar (di luar kartu) → false", async () => {
    buka(HAPUS);
    act(() => {
      fireEvent.click(document.querySelector("dialog")!);
    });
    await expect(hasil).resolves.toBe(false);
  });

  it("aksi permanen: fokus awal di Batal (Enter tak langsung menghapus)", () => {
    buka(HAPUS);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: copy.common.cancel }),
    );
  });

  it("aksi biasa: fokus awal di tombol setuju", () => {
    buka({ title: "Pakai tema Warta?", confirmLabel: "Ya, pakai tema ini" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Ya, pakai tema ini" }),
    );
  });

  it("peramban tanpa showModal (di luar baseline) → jatuh ke window.confirm", async () => {
    // @ts-expect-error — mensimulasikan peramban lama tanpa showModal.
    HTMLDialogElement.prototype.showModal = undefined;
    const native = vi.spyOn(window, "confirm").mockReturnValue(true);
    buka(HAPUS);
    await expect(hasil).resolves.toBe(true);
    expect(native).toHaveBeenCalledWith(
      `${HAPUS.title}\n\n${HAPUS.description}`,
    );
  });

  it("klik ganda pada pemicu: klik kedua (< 500 ms) tak menyetujui/menutup", async () => {
    const jam = jamTiruan();
    buka(HAPUS);
    const ya = screen.getByRole("button", { name: HAPUS.confirmLabel });
    const dialog = document.querySelector("dialog")!;
    jam.sekarang += 150;
    act(() => {
      fireEvent.click(ya, { detail: 2 });
    });
    expect(dialogTerbuka()).toBe(true);
    act(() => {
      fireEvent.pointerDown(dialog);
      fireEvent.click(dialog, { detail: 2 });
    });
    expect(dialogTerbuka()).toBe(true);
    // Klik sungguhan sesudah jeda → diterima.
    jam.sekarang += 600;
    act(() => {
      fireEvent.click(ya, { detail: 1 });
    });
    await expect(hasil).resolves.toBe(true);
  });

  it("aktivasi keyboard (detail 0) tak terkena jeda klik ganda", async () => {
    const jam = jamTiruan();
    buka({ title: "Pakai tema Warta?", confirmLabel: "Ya, pakai tema ini" });
    jam.sekarang += 10;
    act(() => {
      fireEvent.click(
        screen.getByRole("button", { name: "Ya, pakai tema ini" }),
        { detail: 0 },
      );
    });
    await expect(hasil).resolves.toBe(true);
  });

  it("memblok teks dari dalam kartu lalu melepas di latar → tetap terbuka", async () => {
    const jam = jamTiruan();
    buka(HAPUS);
    const dialog = document.querySelector("dialog")!;
    jam.sekarang += 2000;
    act(() => {
      fireEvent.pointerDown(screen.getByText(HAPUS.title));
      fireEvent.click(dialog, { detail: 1 });
    });
    expect(dialogTerbuka()).toBe(true);
    // Tekan DAN lepas di latar → batal.
    act(() => {
      fireEvent.pointerDown(dialog);
      fireEvent.click(dialog, { detail: 1 });
    });
    await expect(hasil).resolves.toBe(false);
  });

  it("pindah rute selagi terbuka (Back/tautan) → batal, dialog tertutup", async () => {
    const { rerender } = buka(HAPUS);
    nav.pathname = "/dashboard/undangan/lain";
    rerender(pohon(HAPUS));
    await expect(hasil).resolves.toBe(false);
    expect(dialogTerbuka()).toBe(false);
  });

  it("di luar provider → galat yang jelas", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Pemicu options={HAPUS} />)).toThrow(/ConfirmProvider/);
  });
});

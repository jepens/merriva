import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import InvitationDashboardError from "@/app/(dashboard)/dashboard/undangan/[id]/error";
import MomenLoadError from "@/app/[slug]/momen/error";
import GlobalError from "@/app/global-error";
import PreviewLoadError from "@/app/preview/[id]/error";
import { copy } from "@/lib/copy";

/**
 * Layar galat (DECISIONS #45): pesan berbahasa Indonesia + "Coba lagi" yang
 * memanggil `unstable_retry` (muat ulang data server lalu render ulang) — bukan
 * `reset`, yang merender ulang tanpa data baru dan langsung gagal lagi.
 */

afterEach(cleanup);

describe.each([
  ["Album Momen (tamu)", MomenLoadError, copy.public.loadError],
  ["pratinjau pemilik", PreviewLoadError, copy.preview.loadError],
  ["dashboard undangan", InvitationDashboardError, copy.common.loadError],
] as const)("layar galat %s", (_nama, Boundary, text) => {
  it("menjelaskan masalahnya dan 'Coba lagi' memuat ulang dari server", async () => {
    const retry = vi.fn();
    render(<Boundary error={new Error("boom")} unstable_retry={retry} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(text.title);
    expect(alert).toHaveTextContent(text.body);
    // Pesan galat mentah tak pernah ditampilkan ke tamu/pemilik.
    expect(alert).not.toHaveTextContent("boom");

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: text.retry }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe("boundary dashboard", () => {
  it("tampil DI DALAM layout (tanpa <main> sendiri) agar header & navigasi tetap ada", () => {
    render(
      <InvitationDashboardError
        error={new Error("boom")}
        unstable_retry={vi.fn()}
      />,
    );
    expect(document.querySelector("main")).toBeNull();
  });
});

describe("halaman galat global (boundary runtime halaman dinamis)", () => {
  // Merender <html> di dalam kontainer jsdom memicu peringatan DOM nesting →
  // periksa pohon elemennya, bukan hasil render.
  const el = GlobalError() as React.ReactElement<{
    lang: string;
    children: React.ReactElement<{ children: React.ReactElement }>;
  }>;

  it("berbahasa Indonesia, bukan halaman 500 bawaan Next yang berbahasa Inggris", () => {
    expect(el.props.lang).toBe("id");
    render(el.props.children.props.children);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: copy.common.loadError.retry }),
    ).toBeInTheDocument();
  });

  it("teksnya TETAP sama dengan copy.common.loadError", () => {
    // Berkas itu sengaja tak mengimpor `copy` (masuk graf klien SETIAP route →
    // bundel halaman tamu melewati anggaran). Test ini penggantinya.
    render(el.props.children.props.children);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(copy.common.loadError.title);
    expect(alert).toHaveTextContent(copy.common.loadError.body);
  });
});

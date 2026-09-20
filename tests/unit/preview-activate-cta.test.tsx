import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// `next/link` butuh konteks App Router; di jsdom cukup anchor biasa.
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import {
  PreviewBanner,
  type PreviewChrome,
} from "@/components/preview/preview-banner";
import { copy } from "@/lib/copy";

afterEach(cleanup);

const AKTIVASI = "/dashboard/undangan/inv-1/aktifkan";

describe("CTA aktivasi di bar pratinjau", () => {
  it("pemilik melihat ajakan aktivasi menuju halaman aktivasi", () => {
    render(
      <PreviewBanner
        editHref="/dashboard/undangan/inv-1/edit"
        activate={{ href: AKTIVASI, label: copy.preview.activateCta.activate }}
      />,
    );
    const cta = screen.getByRole("link", {
      name: copy.preview.activateCta.activate,
    });
    expect(cta).toHaveAttribute("href", AKTIVASI);
    // Jalan pulang ke editor harus tetap ada — lingkaran editor↔pratinjau utuh.
    expect(
      screen.getByRole("link", { name: copy.preview.backToEditor }),
    ).toBeInTheDocument();
  });

  it("pratinjau tema publik (demo) TIDAK pernah membocorkan tautan dasbor", () => {
    // Tipe `PreviewChrome` melarang kombinasi ini; cast memaksanya terjadi untuk
    // membuktikan gerbang runtime-nya juga menahan (mis. props dari data dinamis).
    const bocor = {
      demo: true,
      activate: { href: AKTIVASI, label: copy.preview.activateCta.activate },
    } as unknown as PreviewChrome;
    render(<PreviewBanner {...bocor} />);

    expect(
      screen.queryByRole("link", { name: copy.preview.activateCta.activate }),
    ).toBeNull();
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href") ?? "").not.toContain("/dashboard");
    }
  });

  it("undangan aktif (tanpa prop activate) hanya menampilkan tautan editor", () => {
    render(<PreviewBanner editHref="/dashboard/undangan/inv-1/edit" />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(
      screen.queryByRole("link", { name: copy.preview.activateCta.activate }),
    ).toBeNull();
  });
});

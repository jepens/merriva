import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TurnstileWidget } from "@/components/public/guestbook/turnstile-widget";

/**
 * Token Turnstile SEKALI PAKAI. Server memverifikasinya sebelum menyentuh DB,
 * jadi begitu kiriman ditolak (mis. gangguan DB — DECISIONS #46) token tamu
 * sudah hangus di Cloudflare: tanpa reset, setiap "coba lagi" berakhir
 * "verifikasi gagal" dan RSVP tamu hilang untuk selamanya.
 */

const api = {
  render: vi.fn(
    (_el: HTMLElement, _opts: Record<string, unknown>) => "widget-1",
  ),
  reset: vi.fn((_id: string) => {}),
};

/** Opsi yang diterima `turnstile.render` pada pemasangan pertama. */
const renderOpts = () => api.render.mock.calls[0]![1];

beforeEach(() => {
  api.render.mockClear().mockReturnValue("widget-1");
  api.reset.mockClear();
  (window as unknown as { turnstile?: unknown }).turnstile = api;
});
afterEach(() => {
  cleanup();
  delete (window as unknown as { turnstile?: unknown }).turnstile;
});

describe("TurnstileWidget — reset tantangan", () => {
  it("resetKey naik → widget di-reset dan token lama dibuang", () => {
    const onToken = vi.fn();
    const { rerender } = render(
      <TurnstileWidget siteKey="kunci" onToken={onToken} resetKey={0} />,
    );
    expect(api.render).toHaveBeenCalledTimes(1);
    expect(api.reset).not.toHaveBeenCalled();

    rerender(
      <TurnstileWidget siteKey="kunci" onToken={onToken} resetKey={1} />,
    );

    expect(api.reset).toHaveBeenCalledWith("widget-1");
    // Token yang sudah terpakai WAJIB dikosongkan; kalau tidak, kiriman
    // berikutnya mengirim token hangus yang sama.
    expect(onToken).toHaveBeenCalledWith("");
  });

  it("render ulang tanpa perubahan resetKey tak meminta tantangan baru", () => {
    const onToken = vi.fn();
    const { rerender } = render(
      <TurnstileWidget siteKey="kunci" onToken={onToken} resetKey={2} />,
    );
    rerender(
      <TurnstileWidget siteKey="kunci" onToken={onToken} resetKey={2} />,
    );

    // Termasuk pemasangan pertama: `resetKey` awal bukan permintaan reset.
    expect(api.reset).not.toHaveBeenCalled();
    expect(onToken).not.toHaveBeenCalled();
  });

  it("reset mencabut penanda interaksi — tantangan baru bisa kembali tak terlihat", () => {
    const onToken = vi.fn();
    const { container, rerender } = render(
      <TurnstileWidget
        siteKey="kunci"
        onToken={onToken}
        resetKey={0}
        appearance="interaction-only"
      />,
    );
    const box = container.querySelector(".gb-turnstile")!;
    (renderOpts()["before-interactive-callback"] as () => void)();
    expect(box.hasAttribute("data-interactive")).toBe(true);

    rerender(
      <TurnstileWidget
        siteKey="kunci"
        onToken={onToken}
        resetKey={1}
        appearance="interaction-only"
      />,
    );

    expect(api.reset).toHaveBeenCalledWith("widget-1");
    expect(box.hasAttribute("data-interactive")).toBe(false);
  });

  it("skrip Turnstile belum termuat → permintaan reset tak melempar", () => {
    delete (window as unknown as { turnstile?: unknown }).turnstile;
    const onToken = vi.fn();
    const { rerender } = render(
      <TurnstileWidget siteKey="kunci" onToken={onToken} resetKey={0} />,
    );

    expect(() =>
      rerender(
        <TurnstileWidget siteKey="kunci" onToken={onToken} resetKey={1} />,
      ),
    ).not.toThrow();
  });
});

/**
 * Form tamu memakai Turnstile tak terlihat (SPEC §4.6, DECISIONS #128); daftar
 * akun, reset sandi, dan Album Momen sengaja tetap menampilkan widget — opsi
 * render mereka tak boleh berubah sedikit pun.
 */
describe("TurnstileWidget — appearance", () => {
  it("appearance diberikan → diteruskan ke turnstile.render", () => {
    const { container } = render(
      <TurnstileWidget
        siteKey="kunci"
        onToken={vi.fn()}
        appearance="interaction-only"
      />,
    );

    expect(renderOpts()).toMatchObject({
      sitekey: "kunci",
      appearance: "interaction-only",
    });
    expect(
      container.querySelector(".gb-turnstile")?.getAttribute("data-appearance"),
    ).toBe("interaction-only");
  });

  it("tanpa prop → opsi render persis seperti dulu (tanpa kunci appearance)", () => {
    const { container } = render(
      <TurnstileWidget siteKey="kunci" onToken={vi.fn()} />,
    );

    expect(Object.keys(renderOpts()).sort()).toEqual(
      ["callback", "error-callback", "expired-callback", "sitekey"].sort(),
    );
    expect(
      container.querySelector(".gb-turnstile")?.hasAttribute("data-appearance"),
    ).toBe(false);
  });

  it("Cloudflare meminta interaksi → wadah ditandai, token tetap lewat onToken", () => {
    const onToken = vi.fn();
    const { container } = render(
      <TurnstileWidget
        siteKey="kunci"
        onToken={onToken}
        appearance="interaction-only"
      />,
    );
    const box = container.querySelector(".gb-turnstile")!;
    expect(box.hasAttribute("data-interactive")).toBe(false);

    (renderOpts()["before-interactive-callback"] as () => void)();
    expect(box.hasAttribute("data-interactive")).toBe(true);

    (renderOpts().callback as (t: string) => void)("tok-1");
    expect(onToken).toHaveBeenCalledWith("tok-1");
  });
});

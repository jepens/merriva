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
  render: vi.fn(() => "widget-1"),
  reset: vi.fn(),
};

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

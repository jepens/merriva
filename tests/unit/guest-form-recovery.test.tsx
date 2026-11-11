import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "Silakan coba lagi" harus BISA berhasil (DECISIONS #46 — koreksi temuan
 * review). Dua cara ajakan itu dulu berubah jadi jalan buntu:
 *
 *  1. Token Turnstile sekali pakai. Server memverifikasinya SEBELUM membaca DB,
 *     jadi saat bacaan gagal token tamu sudah hangus di Cloudflare — kiriman
 *     berikutnya pasti "verifikasi gagal" sampai widget-nya di-reset.
 *  2. Server action yang MELEMPAR (WiFi venue putus, id aksi basi sesudah
 *     deploy) tak pernah ditangkap: form tersangkut "Mengirim…" selamanya dan
 *     dinding ucapan tersangkut "Memuat…", tanpa satu pun pesan.
 */

const { submitRsvpAction, submitGiftNoteAction, getGuestbookAction } =
  vi.hoisted(() => ({
    submitRsvpAction: vi.fn(),
    submitGiftNoteAction: vi.fn(),
    getGuestbookAction: vi.fn(),
  }));
vi.mock("@/server/actions/guestbook", () => ({
  submitRsvpAction,
  submitGiftNoteAction,
  getGuestbookAction,
}));

/**
 * Widget palsu: memaparkan `resetKey` & `appearance` agar permintaan reset dan
 * mode tak terlihat bisa di-assert; klik = token tiba.
 */
vi.mock("@/components/public/guestbook/turnstile-widget", () => ({
  TurnstileWidget: ({
    onToken,
    resetKey = 0,
    appearance,
  }: {
    onToken: (t: string) => void;
    resetKey?: number;
    appearance?: string;
  }) => (
    <button
      type="button"
      data-testid="turnstile"
      data-reset={String(resetKey)}
      data-appearance={appearance}
      onClick={() => onToken("token-baru")}
    >
      turnstile
    </button>
  ),
}));

import { copy } from "@/lib/copy";
import { RsvpForm } from "@/components/public/guestbook/rsvp-form";
import { GiftConfirm } from "@/components/public/guestbook/gift-confirm";
import { GuestbookWall } from "@/components/public/guestbook/guestbook-wall";

const SLUG = "andi-sinta";
const t = copy.guestbook.form;

const resetCount = () =>
  screen.getByTestId("turnstile").getAttribute("data-reset");

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
  submitRsvpAction.mockReset();
  submitGiftNoteAction.mockReset();
  getGuestbookAction.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

function isiRsvp() {
  fireEvent.change(screen.getByRole("textbox", { name: t.name }), {
    target: { value: "Sasa" },
  });
  fireEvent.click(screen.getByTestId("turnstile"));
}

describe("RsvpForm — pulih dari penolakan", () => {
  it("ditolak server → tantangan Turnstile BARU diminta, tombol hidup lagi", async () => {
    submitRsvpAction.mockResolvedValue({
      status: "error",
      message: copy.common.error,
    });
    render(<RsvpForm slug={SLUG} />);
    isiRsvp();
    expect(resetCount()).toBe("0");

    fireEvent.click(screen.getByRole("button", { name: t.submit }));

    await screen.findByText(copy.common.error);
    expect(resetCount()).toBe("1");
    expect(screen.getByRole("button", { name: t.submit })).not.toBeDisabled();
  });

  it("aksi MELEMPAR → pesan galat, bukan tombol mati selamanya", async () => {
    submitRsvpAction.mockRejectedValue(new Error("Failed to fetch"));
    render(<RsvpForm slug={SLUG} />);
    isiRsvp();

    fireEvent.click(screen.getByRole("button", { name: t.submit }));

    await screen.findByText(copy.common.error);
    const btn = screen.getByRole("button", { name: t.submit });
    expect(btn).not.toBeDisabled();
    expect(btn.textContent).not.toBe(t.submitting);
    expect(resetCount()).toBe("1");
  });

  it("penolakan SEBELUM verifikasi (invalid/rate) tak membuang token yang masih sah", async () => {
    // Urutan server: Zod → honeypot → rate limit → Turnstile → DB. Me-reset di
    // sini membuang tantangan yang baik, lalu kiriman perbaikan berikutnya
    // ditolak "Verifikasi anti-bot gagal" karena token barunya belum tiba.
    submitRsvpAction.mockResolvedValueOnce({
      status: "error",
      reason: "invalid",
      message: t.invalid,
    });
    render(<RsvpForm slug={SLUG} />);
    isiRsvp();

    fireEvent.click(screen.getByRole("button", { name: t.submit }));
    await screen.findByText(t.invalid);
    expect(resetCount()).toBe("0");

    submitRsvpAction.mockResolvedValueOnce({
      status: "error",
      reason: "rate",
      message: t.rateLimited,
    });
    fireEvent.click(screen.getByRole("button", { name: t.submit }));
    await screen.findByText(t.rateLimited);
    expect(resetCount()).toBe("0");
  });

  it("penolakan SESUDAH verifikasi (captcha/ditutup/galat) tetap minta tantangan baru", async () => {
    submitRsvpAction.mockResolvedValueOnce({
      status: "error",
      reason: "captcha",
      message: t.captchaFailed,
    });
    render(<RsvpForm slug={SLUG} />);
    isiRsvp();

    fireEvent.click(screen.getByRole("button", { name: t.submit }));

    await screen.findByText(t.captchaFailed);
    expect(resetCount()).toBe("1");
  });

  it("berhasil → tak ada reset, form berganti pesan sukses", async () => {
    submitRsvpAction.mockResolvedValue({ status: "success", moderated: false });
    render(<RsvpForm slug={SLUG} />);
    isiRsvp();

    fireEvent.click(screen.getByRole("button", { name: t.submit }));

    await screen.findByText(t.success);
    expect(screen.queryByTestId("turnstile")).toBeNull();
  });
});

describe("GiftConfirm — pulih dari penolakan", () => {
  async function buka() {
    render(<GiftConfirm slug={SLUG} />);
    fireEvent.click(
      screen.getByRole("button", { name: copy.guestbook.gift.trigger }),
    );
    await screen.findByTestId("turnstile");
  }

  it("aksi MELEMPAR → pesan galat + Turnstile di-reset", async () => {
    submitGiftNoteAction.mockRejectedValue(new Error("Failed to fetch"));
    await buka();
    fireEvent.change(
      screen.getByRole("textbox", { name: copy.guestbook.gift.name }),
      {
        target: { value: "Sasa" },
      },
    );
    // Token tiba dulu — tanpanya kiriman berhenti di "memverifikasi" (#128).
    fireEvent.click(screen.getByTestId("turnstile"));

    fireEvent.click(
      screen.getByRole("button", { name: copy.guestbook.gift.submit }),
    );

    await screen.findByText(copy.common.error);
    expect(resetCount()).toBe("1");
  });
});

/**
 * Turnstile tak terlihat di form tamu (SPEC §4.6, DECISIONS #128): tamu tak
 * melihat spinner, jadi bisa menekan Kirim sebelum token tiba. Dulu kiriman
 * tanpa token sampai ke server → jatah rate limit terbuang, tantangan yang
 * sedang berjalan di-reset, dan tamu membaca "Verifikasi anti-bot gagal".
 */
describe("Form tamu — Kirim sebelum token Turnstile tiba", () => {
  const alertText = () => screen.getByRole("alert").textContent;

  it("RSVP: widget tak terlihat; tanpa token → tanpa server & tanpa reset, lalu terkirim dengan token", async () => {
    render(<RsvpForm slug={SLUG} />);
    expect(
      screen.getByTestId("turnstile").getAttribute("data-appearance"),
    ).toBe("interaction-only");
    fireEvent.change(screen.getByRole("textbox", { name: t.name }), {
      target: { value: "Sasa" },
    });

    fireEvent.click(screen.getByRole("button", { name: t.submit }));

    await screen.findByText(t.verifying);
    expect(submitRsvpAction).not.toHaveBeenCalled();
    expect(resetCount()).toBe("0");
    // Tombol tak dimatikan menunggu token (skrip diblokir = tombol mati diam).
    expect(screen.getByRole("button", { name: t.submit })).not.toBeDisabled();

    let selesai: (v: unknown) => void = () => {};
    submitRsvpAction.mockReturnValueOnce(
      new Promise((r) => {
        selesai = r;
      }),
    );
    fireEvent.click(screen.getByTestId("turnstile")); // token tiba
    fireEvent.click(screen.getByRole("button", { name: t.submit }));

    // Pesan "memverifikasi" hilang begitu kiriman berikutnya berjalan.
    await screen.findByRole("button", { name: t.submitting });
    expect(screen.queryByText(t.verifying)).toBeNull();
    expect(submitRsvpAction).toHaveBeenCalledTimes(1);
    expect(submitRsvpAction).toHaveBeenCalledWith(
      expect.objectContaining({ turnstileToken: "token-baru" }),
    );

    selesai({ status: "success", moderated: false });
    await screen.findByText(t.success);
  });

  it("RSVP tanpa site key (dev) → tak menunggu token, langsung ke server", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    submitRsvpAction.mockResolvedValue({ status: "success", moderated: false });
    render(<RsvpForm slug={SLUG} />);
    fireEvent.change(screen.getByRole("textbox", { name: t.name }), {
      target: { value: "Sasa" },
    });

    fireEvent.click(screen.getByRole("button", { name: t.submit }));

    await screen.findByText(t.success);
    expect(submitRsvpAction).toHaveBeenCalledWith(
      expect.objectContaining({ turnstileToken: "" }),
    );
  });

  it("amplop: widget tak terlihat; tanpa token → tanpa server & tanpa reset, lalu terkirim dengan token", async () => {
    const g = copy.guestbook.gift;
    render(<GiftConfirm slug={SLUG} />);
    fireEvent.click(screen.getByRole("button", { name: g.trigger }));
    expect(
      (await screen.findByTestId("turnstile")).getAttribute("data-appearance"),
    ).toBe("interaction-only");
    fireEvent.change(screen.getByRole("textbox", { name: g.name }), {
      target: { value: "Sasa" },
    });

    fireEvent.click(screen.getByRole("button", { name: g.submit }));

    await screen.findByText(t.verifying);
    expect(submitGiftNoteAction).not.toHaveBeenCalled();
    expect(resetCount()).toBe("0");
    expect(screen.getByRole("button", { name: g.submit })).not.toBeDisabled();

    // Token tiba → kiriman sampai ke server; galatnya MENGGANTI pesan tadi.
    submitGiftNoteAction.mockResolvedValueOnce({
      status: "error",
      reason: "captcha",
      message: t.captchaFailed,
    });
    fireEvent.click(screen.getByTestId("turnstile"));
    fireEvent.click(screen.getByRole("button", { name: g.submit }));

    await screen.findByText(t.captchaFailed);
    expect(alertText()).toBe(t.captchaFailed);
    expect(submitGiftNoteAction).toHaveBeenCalledTimes(1);
    expect(submitGiftNoteAction).toHaveBeenCalledWith(
      expect.objectContaining({ turnstileToken: "token-baru" }),
    );
  });
});

describe("GuestbookWall — aksi yang melempar", () => {
  it("muat awal melempar → 'coba lagi', bukan tersangkut 'Memuat…'", async () => {
    getGuestbookAction.mockRejectedValue(new Error("Failed to fetch"));

    render(<GuestbookWall slug={SLUG} />);

    await screen.findByText(copy.guestbook.wall.failed, { exact: false });
    expect(
      screen.getByRole("button", { name: copy.guestbook.wall.retry }),
    ).toBeTruthy();
  });

  it("'muat lebih' melempar → tombolnya tetap ada", async () => {
    getGuestbookAction.mockResolvedValueOnce({
      entries: [
        {
          id: "a",
          name: "Sasa",
          message: "ucapan a",
          createdAt: "2026-12-20T02:00:00Z",
        },
      ],
      hasMore: true,
    });
    render(<GuestbookWall slug={SLUG} />);
    const more = await screen.findByRole("button", {
      name: copy.guestbook.wall.loadMore,
    });

    getGuestbookAction.mockRejectedValueOnce(new Error("Failed to fetch"));
    fireEvent.click(more);

    await screen.findByText(copy.guestbook.wall.failed, { exact: false });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: copy.guestbook.wall.loadMore }),
      ).not.toBeDisabled(),
    );
    expect(screen.getByText("ucapan a")).toBeTruthy();
  });
});

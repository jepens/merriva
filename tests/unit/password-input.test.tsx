import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PasswordInput } from "@/components/auth/password-input";
import { RegisterForm } from "@/components/auth/register-form";
import { LoginForm } from "@/components/auth/login-form";
import { copy } from "@/lib/copy";

/**
 * Tombol "lihat kata sandi" (AUDIT-2026-10-01 B2).
 *
 * Form pendaftaran dulu tak punya satu pun pengaman salah-ketik: tak ada kolom
 * konfirmasi, tak ada tombol lihat, dan syarat panjangnya baru muncul SETELAH
 * submit ditolak. Salah ketik satu karakter menghasilkan akun yang kata
 * sandinya tak diketahui pemiliknya — dan karena respons pendaftaran sengaja
 * generik demi anti-enumerasi, mendaftar ulang justru menjawab "Akun dibuat".
 */

vi.mock("@/server/actions/auth", () => ({
  signUpAction: vi.fn(),
  signInAction: vi.fn(),
}));
// Turnstile memuat skrip eksternal — tak relevan untuk uji ini.
vi.mock("@/components/auth/turnstile-field", () => ({
  TurnstileField: () => null,
}));

afterEach(cleanup);

function field(): HTMLInputElement {
  return document.querySelector<HTMLInputElement>("#password")!;
}
function toggle(): HTMLButtonElement {
  return screen.getByRole("button", {
    name: new RegExp(`${copy.auth.passwordShow}|${copy.auth.passwordHide}`),
  });
}

describe("PasswordInput", () => {
  it("menukar type antara password dan text saat ditekan", async () => {
    const user = userEvent.setup();
    render(<PasswordInput id="password" name="password" />);

    expect(field().type).toBe("password");
    await user.click(toggle());
    expect(field().type).toBe("text");
    await user.click(toggle());
    expect(field().type).toBe("password");
  });

  it("aria-pressed & aria-label mengikuti keadaan, bukan tetap", async () => {
    const user = userEvent.setup();
    render(<PasswordInput id="password" name="password" />);

    expect(toggle()).toHaveProperty("ariaPressed", "false");
    expect(toggle().getAttribute("aria-label")).toBe(copy.auth.passwordShow);

    await user.click(toggle());

    expect(toggle()).toHaveProperty("ariaPressed", "true");
    expect(toggle().getAttribute("aria-label")).toBe(copy.auth.passwordHide);
  });

  it("tombolnya type='button' — kalau tidak, menekannya MENGIRIM formulir", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PasswordInput id="password" name="password" />
      </form>,
    );

    expect(toggle().getAttribute("type")).toBe("button");
    await user.click(toggle());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("name & autoComplete tetap diteruskan (form submit tak boleh rusak)", async () => {
    const user = userEvent.setup();
    render(
      <PasswordInput
        id="password"
        name="password"
        autoComplete="new-password"
      />,
    );

    await user.type(field(), "kata-sandi-rahasia");

    expect(field().name).toBe("password");
    expect(field().autocomplete).toBe("new-password");
    // Nilainya bertahan melewati pergantian type — React tak me-remount input.
    await user.click(toggle());
    expect(field().value).toBe("kata-sandi-rahasia");
  });

  it("hint ditautkan ke input lewat aria-describedby", () => {
    render(
      <PasswordInput
        id="password"
        name="password"
        hint={copy.auth.passwordHint}
      />,
    );

    const id = field().getAttribute("aria-describedby");
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)?.textContent).toBe(
      copy.auth.passwordHint,
    );
  });
});

describe("form auth memakai tombol lihat", () => {
  it("pendaftaran: ada tombol lihat DAN syarat panjang terlihat sebelum submit", () => {
    render(<RegisterForm />);

    expect(toggle()).toBeTruthy();
    // Dulu "minimal 8 karakter" hanya muncul sebagai pesan penolakan — setelah
    // tantangan Turnstile terlanjur terpakai.
    expect(screen.getByText(copy.auth.passwordHint)).toBeTruthy();
  });

  it("masuk: juga punya tombol lihat — di situlah korban salah-ketik terjebak", () => {
    render(<LoginForm />);
    expect(toggle()).toBeTruthy();
  });
});

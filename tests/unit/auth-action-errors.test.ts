import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kegagalan aksi AUTH tidak boleh senyap (AUDIT-2026-10-01 A1).
 *
 * Jalur daftar → verifikasi → masuk BELUM PERNAH sekali pun berhasil di proyek
 * produksi (`auth.users` hanya berisi satu admin buatan manual). Penyebab yang
 * paling mungkin — Custom SMTP belum disetel, sehingga Supabase MENOLAK
 * mengirim ke alamat di luar anggota tim project — tidak terlihat oleh siapa
 * pun: `requestPasswordResetAction` sengaja SELALU menjawab sukses generik demi
 * anti-enumerasi, dan `signUpAction` menjawab pesan generik.
 *
 * Yang diuji di sini adalah pemisahan dua hal yang mudah tertukar:
 *   - JAWABAN ke pengguna tetap buram (anti-enumerasi, temuan review M1.1 &
 *     DECISIONS #39) — itu keputusan keamanan dan tidak boleh berubah;
 *   - JEJAK diagnostik di server wajib ada.
 * Sebelum ini keduanya sama-sama tidak ada. Aksi auth sama sekali tak punya
 * test, jadi berkas ini juga menutup celah itu.
 */

const { reportHandledError } = vi.hoisted(() => ({
  reportHandledError: vi.fn(),
}));
vi.mock("@/lib/observability", () => ({ reportHandledError }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/lib/request-ip", () => ({
  checkClientRateLimit: vi.fn(async () => ({
    ok: true,
    remaining: 9,
    retryAfterMs: 0,
  })),
  getClientIp: async () => "1.2.3.4",
  staticRateKey: (action: string, value: string) => `${action}:${value}`,
}));
vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: vi.fn(async () => true),
}));

type AuthResult = { data?: unknown; error: unknown };

const { auth } = vi.hoisted(() => ({
  auth: {
    signUp: vi.fn<() => Promise<AuthResult>>(),
    resetPasswordForEmail: vi.fn<() => Promise<AuthResult>>(),
    updateUser: vi.fn<() => Promise<AuthResult>>(),
    getUser: vi.fn<() => Promise<{ data: { user: unknown } }>>(),
    getClaims: vi.fn<() => Promise<{ data: unknown }>>(),
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth }),
}));

import { copy } from "@/lib/copy";
import {
  requestPasswordResetAction,
  signUpAction,
  updatePasswordAction,
} from "@/server/actions/auth";
import { idleState } from "@/server/actions/types";

const EMAIL = "calon.pelanggan@contoh.co.id";
const NAMA = "Rina Pertiwi";

/** Bentuk galat GoTrue sungguhan (objek polos dengan `code` + `status`). */
const SMTP_DITOLAK = {
  message: "Error sending confirmation email",
  code: "unexpected_failure",
  status: 500,
  name: "AuthApiError",
};

function formDaftar(): FormData {
  const fd = new FormData();
  fd.set("full_name", NAMA);
  fd.set("email", EMAIL);
  fd.set("password", "kata-sandi-kuat");
  fd.set("phone", "08123456789");
  fd.set("turnstile", "token-turnstile");
  return fd;
}

function formReset(): FormData {
  const fd = new FormData();
  fd.set("email", EMAIL);
  fd.set("turnstile", "token-turnstile");
  return fd;
}

function formSandiBaru(): FormData {
  const fd = new FormData();
  fd.set("password", "kata-sandi-baru");
  fd.set("confirm", "kata-sandi-baru");
  return fd;
}

/** Argumen `extra` pada panggilan terakhir — yang benar-benar dikirim ke Sentry. */
function extraTerakhir(): Record<string, unknown> {
  const call = reportHandledError.mock.calls.at(-1);
  return (call?.[2] ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
  reportHandledError.mockClear();
  auth.signUp.mockReset();
  auth.resetPasswordForEmail.mockReset();
  auth.updateUser.mockReset();
  auth.getUser.mockReset();
  auth.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
  auth.getClaims.mockReset();
  // Default: sesi yang baru lahir dari klik tautan email — bentuk NYATA yang
  // dihasilkan `verifyOtp({ type: "recovery" })` pada proyek ini.
  auth.getClaims.mockResolvedValue({
    data: {
      claims: {
        amr: [{ method: "otp", timestamp: Math.floor(Date.now() / 1000) }],
      },
    },
  });
});

describe("signUpAction — kegagalan kirim email verifikasi", () => {
  it("dilaporkan sebagai auth.signup, pengguna tetap menerima pesan generik", async () => {
    auth.signUp.mockResolvedValue({ error: SMTP_DITOLAK });

    const state = await signUpAction(idleState, formDaftar());

    expect(state).toEqual({
      status: "error",
      message: copy.auth.genericAuthError,
    });
    expect(reportHandledError).toHaveBeenCalledTimes(1);
    const [err, area] = reportHandledError.mock.calls[0]!;
    expect(err).toBe(SMTP_DITOLAK);
    expect(area).toBe("auth.signup");
    expect(extraTerakhir()).toEqual({
      code: "unexpected_failure",
      status: 500,
    });
  });

  it("email sudah terdaftar TIDAK dilaporkan — itu jalur normal anti-enumerasi", async () => {
    auth.signUp.mockResolvedValue({
      error: {
        message: "User already registered",
        code: "user_already_exists",
      },
    });

    const state = await signUpAction(idleState, formDaftar());

    // Jawaban HARUS identik dengan pendaftaran baru (DECISIONS: temuan M1.1).
    expect(state).toEqual({
      status: "success",
      message: copy.auth.signupSuccess,
    });
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("tidak melaporkan apa pun saat pendaftaran berhasil", async () => {
    auth.signUp.mockResolvedValue({ error: null });

    const state = await signUpAction(idleState, formDaftar());

    expect(state.status).toBe("success");
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("extra tidak memuat email maupun nama — `extra` ikut terkirim ke Sentry", async () => {
    auth.signUp.mockResolvedValue({ error: SMTP_DITOLAK });

    await signUpAction(idleState, formDaftar());

    // Diperiksa atas SELURUH nilai extra, bukan hanya kunci yang terpikirkan:
    // satu kunci baru yang lalai ditambahkan kelak akan menjatuhkan test ini.
    const serialized = JSON.stringify(extraTerakhir());
    expect(serialized).not.toContain(EMAIL);
    expect(serialized).not.toContain("contoh.co.id");
    expect(serialized).not.toContain(NAMA);
    expect(serialized).not.toContain("08123456789");
  });
});

describe("requestPasswordResetAction — anti-enumerasi dipertahankan, jejak ditambahkan", () => {
  it("kegagalan kirim dilaporkan TAPI pengguna tetap melihat sukses generik", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: SMTP_DITOLAK });

    const state = await requestPasswordResetAction(idleState, formReset());

    // Inti temuan: layar berbunyi "tautan sudah dikirim" walau tak ada yang
    // terkirim. Itu SENGAJA — yang dulu hilang hanyalah jejaknya.
    expect(state).toEqual({
      status: "success",
      message: copy.auth.resetSent,
    });
    expect(reportHandledError).toHaveBeenCalledTimes(1);
    const [err, area] = reportHandledError.mock.calls[0]!;
    expect(err).toBe(SMTP_DITOLAK);
    expect(area).toBe("auth.reset");
    expect(JSON.stringify(extraTerakhir())).not.toContain(EMAIL);
  });

  it("pengiriman berhasil → tidak ada laporan", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });

    const state = await requestPasswordResetAction(idleState, formReset());

    expect(state.status).toBe("success");
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("Turnstile gagal → tak pernah menyentuh Supabase, jadi tak ada laporan palsu", async () => {
    const { verifyTurnstile } = await import("@/lib/turnstile");
    vi.mocked(verifyTurnstile).mockResolvedValueOnce(false);

    const state = await requestPasswordResetAction(idleState, formReset());

    expect(state.status).toBe("success"); // tetap generik (anti-enumerasi)
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(reportHandledError).not.toHaveBeenCalled();
  });
});

describe("updatePasswordAction — penolakan GoTrue meninggalkan jejak", () => {
  it("galat updateUser dilaporkan sebagai auth.update-password", async () => {
    auth.updateUser.mockResolvedValue({
      error: { message: "Password is known to be weak", code: "weak_password" },
    });

    const state = await updatePasswordAction(idleState, formSandiBaru());

    expect(state).toEqual({
      status: "error",
      message: copy.auth.genericAuthError,
    });
    expect(reportHandledError).toHaveBeenCalledTimes(1);
    expect(reportHandledError.mock.calls[0]![1]).toBe("auth.update-password");
    expect(extraTerakhir()).toEqual({ code: "weak_password", status: null });
  });

  it("sesi login biasa DITOLAK — inti celah pengambilalihan akun", async () => {
    // Sebelumnya `getUser()` tak-null adalah satu-satunya syarat, jadi siapa
    // pun yang memegang perangkat yang masih login bisa mengganti kata sandi
    // di sini tanpa tahu yang lama.
    auth.getClaims.mockResolvedValue({
      data: {
        claims: {
          amr: [
            { method: "password", timestamp: Math.floor(Date.now() / 1000) },
          ],
        },
      },
    });

    const state = await updatePasswordAction(idleState, formSandiBaru());

    expect(state).toEqual({
      status: "error",
      message: copy.auth.recoveryGrantMissing,
    });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("tautan email yang sudah basi ditolak", async () => {
    auth.getClaims.mockResolvedValue({
      data: {
        claims: {
          amr: [
            { method: "otp", timestamp: Math.floor(Date.now() / 1000) - 7200 },
          ],
        },
      },
    });

    const state = await updatePasswordAction(idleState, formSandiBaru());

    expect(state.status).toBe("error");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("sesi dari tautan email yang segar tetap boleh — pemulihan tak boleh rusak", async () => {
    auth.updateUser.mockResolvedValue({ error: null });

    await expect(
      updatePasswordAction(idleState, formSandiBaru()),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(auth.updateUser).toHaveBeenCalledWith({
      password: "kata-sandi-baru",
    });
  });

  it("tanpa sesi → pesan generik TANPA laporan (bukan kerusakan, tautan kedaluwarsa)", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });

    const state = await updatePasswordAction(idleState, formSandiBaru());

    expect(state.status).toBe("error");
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(reportHandledError).not.toHaveBeenCalled();
  });
});

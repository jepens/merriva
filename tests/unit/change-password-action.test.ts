import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ganti kata sandi dari dalam akun (AUDIT-2026-10-01 B1).
 *
 * Temuannya: produk sama sekali tak punya jalur ini — pelanggan yang hanya
 * ingin mengganti sandi harus berpura-pura lupa dan menunggu email.
 *
 * Invarian paling penting di berkas ini bukan "form-nya jalan", melainkan bahwa
 * kata sandi lama BENAR-BENAR diverifikasi. Jebakannya nyata: `updateUser`
 * menerima parameter `current_password`, tetapi GoTrue hanya memvalidasinya bila
 * setelan proyek `REQUIRE_CURRENT_PASSWORD` aktif — bila mati, parameter itu
 * DIABAIKAN DIAM-DIAM dan kodenya tampak aman sambil tak memeriksa apa pun.
 * Karena itu verifikasinya dilakukan sendiri, dan test ini menguncinya.
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

const { limiter } = vi.hoisted(() => ({ limiter: { ok: true } }));
vi.mock("@/lib/request-ip", () => ({
  checkClientRateLimit: vi.fn(async () => ({
    ok: limiter.ok,
    remaining: 1,
    retryAfterMs: 0,
  })),
  getClientIp: async () => "1.2.3.4",
  staticRateKey: (a: string, v: string) => `${a}:${v}`,
}));
vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: vi.fn(async () => true),
}));

const { sesi, publik } = vi.hoisted(() => ({
  sesi: {
    getUser: vi.fn(),
    updateUser: vi.fn(),
    signInWithPassword: vi.fn(),
  },
  publik: { signInWithPassword: vi.fn() },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: sesi }),
}));
vi.mock("@/lib/supabase/public", () => ({
  createSupabasePublicClient: () => ({ auth: publik }),
}));

import { copy } from "@/lib/copy";
import { changePasswordAction } from "@/server/actions/auth";
import { idleState } from "@/server/actions/types";

const LAMA = "sandi-lama-benar";
const BARU = "sandi-baru-kuat";

function form(
  patch: Partial<Record<"current" | "password" | "confirm", string>> = {},
): FormData {
  const fd = new FormData();
  fd.set("current", patch.current ?? LAMA);
  fd.set("password", patch.password ?? BARU);
  fd.set("confirm", patch.confirm ?? BARU);
  return fd;
}

beforeEach(() => {
  reportHandledError.mockClear();
  limiter.ok = true;
  sesi.getUser.mockReset();
  sesi.updateUser.mockReset();
  sesi.signInWithPassword.mockReset();
  publik.signInWithPassword.mockReset();
  sesi.getUser.mockResolvedValue({
    data: { user: { id: "u-1", email: "rina@contoh.co.id" } },
  });
  sesi.updateUser.mockResolvedValue({ error: null });
  publik.signInWithPassword.mockResolvedValue({ error: null });
});

describe("changePasswordAction — verifikasi kata sandi lama", () => {
  it("kata sandi lama SALAH → ditolak, dan updateUser TIDAK pernah dipanggil", async () => {
    publik.signInWithPassword.mockResolvedValue({
      error: {
        message: "Invalid login credentials",
        code: "invalid_credentials",
      },
    });

    const state = await changePasswordAction(idleState, form());

    expect(state.status).toBe("error");
    expect(
      state.status === "error" ? state.fieldErrors?.current : undefined,
    ).toEqual([copy.auth.currentPasswordWrong]);
    expect(sesi.updateUser).not.toHaveBeenCalled();
  });

  it("verifikasi memakai klien TANPA cookie — sesi pengguna tak ditulis ulang", async () => {
    await changePasswordAction(idleState, form());

    expect(publik.signInWithPassword).toHaveBeenCalledWith({
      email: "rina@contoh.co.id",
      password: LAMA,
    });
    // Kalau verifikasi memakai klien sesi, percobaan login ini akan menimpa
    // cookie sesi pengguna — efek samping yang tak kasatmata sampai produksi.
    expect(sesi.signInWithPassword).not.toHaveBeenCalled();
  });

  it("kata sandi lama benar → updateUser dipanggil dengan sandi BARU", async () => {
    const state = await changePasswordAction(idleState, form());

    expect(sesi.updateUser).toHaveBeenCalledWith({ password: BARU });
    expect(state).toEqual({
      status: "success",
      message: copy.auth.passwordChanged,
    });
  });

  it("TIDAK bersandar pada current_password milik GoTrue", async () => {
    await changePasswordAction(idleState, form());

    // Parameter itu hanya divalidasi bila setelan proyek aktif; bila mati ia
    // diabaikan diam-diam. Mengirimkannya akan menyesatkan pembaca kode
    // berikutnya seolah-olah ia yang menjaga.
    const arg = sesi.updateUser.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg).not.toHaveProperty("current_password");
  });
});

describe("changePasswordAction — penjagaan lain", () => {
  it("belum login → tak ada verifikasi maupun perubahan", async () => {
    sesi.getUser.mockResolvedValue({ data: { user: null } });

    const state = await changePasswordAction(idleState, form());

    expect(state.status).toBe("error");
    expect(publik.signInWithPassword).not.toHaveBeenCalled();
    expect(sesi.updateUser).not.toHaveBeenCalled();
  });

  it("rate limit tercapai → ditolak SEBELUM menyentuh verifikasi", async () => {
    limiter.ok = false;

    const state = await changePasswordAction(idleState, form());

    expect(state).toEqual({
      status: "error",
      message: copy.auth.rateLimited,
    });
    // Urutannya menentukan: bila verifikasi jalan lebih dulu, form ini menjadi
    // oracle penebak kata sandi bagi pemegang sesi yang dicuri.
    expect(publik.signInWithPassword).not.toHaveBeenCalled();
  });

  it("rate limit punya lapis PER-AKUN, bukan hanya per jaringan", async () => {
    const { checkClientRateLimit } = await import("@/lib/request-ip");

    await changePasswordAction(idleState, form());

    // Argumennya diperiksa, bukan sekadar "limiter dipanggil": credential
    // stuffing datang terdistribusi, jadi plafon per-jaringan saja tak
    // menyentuh percobaan terhadap satu akun.
    const [aksi, , , lapis] = vi.mocked(checkClientRateLimit).mock.calls[0]!;
    expect(aksi).toBe("auth-change-pw");
    expect(lapis).toBeTruthy();
    expect(lapis![0]!.key).toContain("u-1");
  });

  it("konfirmasi tak cocok → ditolak Zod, nol panggilan ke Supabase", async () => {
    const state = await changePasswordAction(
      idleState,
      form({ confirm: "beda-sendiri" }),
    );

    expect(
      state.status === "error" ? state.fieldErrors?.confirm : undefined,
    ).toBeTruthy();
    expect(publik.signInWithPassword).not.toHaveBeenCalled();
    expect(sesi.updateUser).not.toHaveBeenCalled();
  });

  it("sandi baru sama dengan yang lama → ditolak", async () => {
    const state = await changePasswordAction(
      idleState,
      form({ password: LAMA, confirm: LAMA }),
    );

    expect(
      state.status === "error" ? state.fieldErrors?.password : undefined,
    ).toBeTruthy();
    expect(sesi.updateUser).not.toHaveBeenCalled();
  });

  it("sandi baru terlalu pendek → ditolak sebelum verifikasi", async () => {
    const state = await changePasswordAction(
      idleState,
      form({ password: "pendek", confirm: "pendek" }),
    );

    expect(
      state.status === "error" ? state.fieldErrors?.password : undefined,
    ).toBeTruthy();
    expect(publik.signInWithPassword).not.toHaveBeenCalled();
  });

  it("penolakan GoTrue saat menyimpan → dilaporkan, pesan generik", async () => {
    sesi.updateUser.mockResolvedValue({
      error: { message: "Password is known to be weak", code: "weak_password" },
    });

    const state = await changePasswordAction(idleState, form());

    expect(state).toEqual({
      status: "error",
      message: copy.auth.genericAuthError,
    });
    expect(reportHandledError.mock.calls[0]![1]).toBe("auth.change-password");
  });
});

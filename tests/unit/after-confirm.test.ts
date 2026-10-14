import { render } from "@testing-library/react";
import type { NextRequest } from "next/server";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tujuan yang bertahan melintasi konfirmasi email (DECISIONS #80).
 *
 * Pendaftar email yang datang dari "Gunakan tema ini" kehilangan temanya:
 * pendaftaran berakhir di layar "cek email Anda" tanpa redirect, dan tautan di
 * email TIDAK dibangun oleh kode ini — templat Supabase membangunnya sendiri
 * dari `{{ .SiteURL }}`, sehingga `emailRedirectTo` tak pernah sampai ke
 * peramban. Tujuannya karena itu dititipkan ke cookie.
 *
 * Dua sifat yang paling mudah rusak diam-diam dijaga di sini: cookie TIDAK
 * boleh membajak jalur reset kata sandi (yang menyebut tujuannya sendiri di
 * URL), dan nilai cookie harus disanitasi ULANG saat dibaca — ia datang dari
 * peramban, dan "kita sendiri yang menulisnya" bukan jaminan apa pun.
 */

const { store } = vi.hoisted(() => ({
  store: new Map<string, string>(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) =>
      store.has(n) ? { name: n, value: store.get(n)! } : undefined,
    set: (n: string, v: string) => store.set(n, v),
    delete: (arg: string | { name: string }) =>
      store.delete(typeof arg === "string" ? arg : arg.name),
  }),
}));

vi.mock("@/lib/observability", () => ({ reportHandledError: vi.fn() }));

type Hasil = { error: unknown };
const { auth } = vi.hoisted(() => ({
  auth: {
    verifyOtp: vi.fn<() => Promise<Hasil>>(),
    signUp: vi.fn<() => Promise<Hasil>>(),
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth }),
}));

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
  staticRateKey: (a: string, v: string) => `${a}:${v}`,
}));
vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: vi.fn(async () => true),
}));

import { GET as confirm } from "@/app/auth/confirm/route";
import {
  stashNextForConfirm,
  takeNextForConfirm,
} from "@/lib/auth/after-confirm";
import { RegisterForm } from "@/components/auth/register-form";
import { signUpAction } from "@/server/actions/auth";
import { idleState } from "@/server/actions/types";

const COOKIE = "mrv_after_confirm";
const TEMA = "/dashboard/undangan/baru?tema=eternal-rose";

const minta = (qs: string) =>
  new Request(
    `https://0.0.0.0:3000/auth/confirm${qs}`,
  ) as unknown as NextRequest;

const tujuan = (res: Response) => res.headers.get("Location");

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  auth.verifyOtp.mockResolvedValue({ error: null });
  auth.signUp.mockResolvedValue({ error: null });
});

describe("signUpAction menitipkan tujuan", () => {
  const daftar = (next?: string) => {
    const fd = new FormData();
    fd.set("full_name", "Rina Pertiwi");
    fd.set("email", "calon.pelanggan@contoh.co.id");
    fd.set("password", "kataSandi123!");
    if (next !== undefined) fd.set("next", next);
    return signUpAction(idleState, fd);
  };

  it("tujuan dari form ikut tersimpan", async () => {
    await expect(daftar(TEMA)).resolves.toMatchObject({ status: "success" });
    expect(store.get(COOKIE)).toBe(TEMA);
  });

  it("email yang SUDAH terdaftar menitipkan hal yang sama", async () => {
    // Anti-enumerasi mengatur jawaban ke pengguna; bila cookie hanya muncul
    // untuk email baru, pembedanya tetap bisa diamati dari luar — jawaban yang
    // sama tetapi perilaku yang berbeda.
    auth.signUp.mockResolvedValue({
      error: { code: "user_already_exists", message: "already registered" },
    });
    await expect(daftar(TEMA)).resolves.toMatchObject({ status: "success" });
    expect(store.get(COOKIE)).toBe(TEMA);
  });

  it("pendaftaran yang GAGAL tidak menitipkan apa pun", async () => {
    auth.signUp.mockResolvedValue({
      error: { code: "unexpected_failure", message: "smtp down" },
    });
    await expect(daftar(TEMA)).resolves.toMatchObject({ status: "error" });
    expect(store.size).toBe(0);
  });

  it("tanpa `next` di form, tak ada cookie", async () => {
    await daftar();
    expect(store.size).toBe(0);
  });
});

describe("form pendaftaran mengirim tujuan itu", () => {
  // Tanpa ini seluruh rantai bisa putus di titik paling awal tanpa satu pun
  // test merah: `signUpAction` diuji dengan FormData buatan sendiri, yang
  // SELALU memuat `next` — sedangkan form sungguhan boleh jadi tidak.
  const medan = (next?: string) =>
    render(createElement(RegisterForm, { next })).container.querySelector(
      'input[name="next"]',
    );

  it("tujuan dirender sebagai medan tersembunyi", () => {
    expect(medan(TEMA)?.getAttribute("value")).toBe(TEMA);
  });

  it("tanpa tujuan, tak ada medan kosong yang ikut terkirim", () => {
    expect(medan(undefined)).toBe(null);
  });
});

describe("menitipkan tujuan", () => {
  it("path internal disimpan", async () => {
    await stashNextForConfirm(TEMA);
    expect(store.get(COOKIE)).toBe(TEMA);
  });

  it("tanpa tujuan khusus, cookie TIDAK ditulis", async () => {
    // `/dashboard` sudah perilaku bawaan; menulis cookie untuk itu hanya
    // menambah sesuatu yang harus dibersihkan tanpa mengubah apa pun.
    await stashNextForConfirm(undefined);
    await stashNextForConfirm("");
    expect(store.size).toBe(0);
  });

  it.each([
    ["URL absolut", "https://jahat.example/x"],
    ["protocol-relative", "//jahat.example"],
    ["bukan path", "dashboard"],
    ["bukan string", 42],
  ])("%s ditolak, bukan disimpan", async (_n, nilai) => {
    await stashNextForConfirm(nilai);
    expect(store.size).toBe(0);
  });
});

describe("mengambil tujuan", () => {
  it("dibaca sekali lalu dibuang", async () => {
    await stashNextForConfirm(TEMA);
    expect(await takeNextForConfirm()).toBe(TEMA);
    // Sekali pakai: tautan konfirmasi berikutnya tak boleh mewarisi niat lama.
    expect(await takeNextForConfirm()).toBe(null);
  });

  it("cookie yang dirusak di peramban tetap disanitasi", async () => {
    // Nilainya datang KEMBALI dari peramban. Pengguna (atau skrip) bisa
    // menggantinya; "kita yang menulisnya" bukan jaminan apa pun.
    store.set(COOKIE, "https://jahat.example/ambil-alih");
    expect(await takeNextForConfirm()).toBe(null);
  });

  it("tanpa cookie → null", async () => {
    expect(await takeNextForConfirm()).toBe(null);
  });
});

describe("GET /auth/confirm memakai titipan itu", () => {
  it("konfirmasi akun mendarat di tema yang dipilih sebelum mendaftar", async () => {
    await stashNextForConfirm(TEMA);
    const res = await confirm(minta("?token_hash=th_1&type=signup"));
    expect(tujuan(res)).toBe("/dashboard/undangan/baru?tema=eternal-rose");
    expect(store.has(COOKIE)).toBe(false);
  });

  it("tanpa titipan → `/dashboard`, seperti sebelumnya", async () => {
    const res = await confirm(minta("?token_hash=th_1&type=signup"));
    expect(tujuan(res)).toBe("/dashboard");
  });

  it("RESET SANDI tak bisa dibajak titipan pendaftaran", async () => {
    // Templat recovery menyebut tujuannya sendiri di URL. Bila cookie menang,
    // sesi recovery berumur pendek itu dibuang ke halaman lain dan pengguna
    // tak pernah sampai ke form ganti kata sandi.
    await stashNextForConfirm(TEMA);
    const res = await confirm(
      minta("?token_hash=th_1&type=recovery&next=%2Freset-password%2Fubah"),
    );
    expect(tujuan(res)).toBe("/reset-password/ubah");
  });

  it("`next` di URL tetap disanitasi", async () => {
    const res = await confirm(
      minta("?token_hash=th_1&type=signup&next=https%3A%2F%2Fjahat.example"),
    );
    expect(tujuan(res)).toBe("/dashboard");
  });

  it("verifikasi gagal → titipan TIDAK terpakai dan tak hangus", async () => {
    // Tautan kedaluwarsa itu lumrah; menghanguskan niat pengguna pada percobaan
    // pertama membuat percobaan berikutnya mendarat di tempat yang salah.
    auth.verifyOtp.mockResolvedValue({ error: { message: "expired" } });
    await stashNextForConfirm(TEMA);
    const res = await confirm(minta("?token_hash=th_1&type=signup"));
    expect(tujuan(res)).toBe("/masuk?error=verify");
    expect(store.get(COOKIE)).toBe(TEMA);
  });
});

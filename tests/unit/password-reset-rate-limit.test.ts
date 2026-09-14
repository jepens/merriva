import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `requestPasswordResetAction` — Turnstile DULU, baru kunci `auth-reset-ip` &
 * `auth-reset-email` dicatat dalam SATU keputusan (DECISIONS #39).
 *
 * Dulu kunci email dicatat sebelum Turnstile dan walau batas jaringan sudah
 * menolak: tanpa token apa pun, email acak membuat kunci limiter penuh yang
 * hidup 15 menit dan mendesak penghitung lain (termasuk plafon email korban)
 * keluar dari memori.
 * Memakai limiter & keying ASLI; `next/headers` palsu hanya menyuplai alamat.
 */

const { human, ipRef, send } = vi.hoisted(() => ({
  human: { current: true },
  ipRef: { current: "203.0.113.7" },
  send: vi.fn(() => Promise.resolve({ data: {}, error: null })),
}));

vi.mock("next/headers", () => ({
  headers: () =>
    Promise.resolve(new Headers({ "cf-connecting-ip": ipRef.current })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/env", () => ({ appUrl: "https://merriva.test" }));
vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: () => Promise.resolve(human.current),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () =>
    Promise.resolve({ auth: { resetPasswordForEmail: send } }),
}));

import { __rateLimitKeyCount, __resetRateLimit } from "@/lib/rate-limit";
import { requestPasswordResetAction } from "@/server/actions/auth";

function resetForm(email: string): FormData {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("turnstile", "token");
  return fd;
}

async function requestReset(email: string) {
  return requestPasswordResetAction(undefined as never, resetForm(email));
}

beforeEach(() => {
  __resetRateLimit();
  send.mockClear();
  ipRef.current = "203.0.113.7";
  human.current = true;
});

describe("requestPasswordResetAction — kunci limiter di belakang Turnstile & batas jaringan", () => {
  it("email acak dari satu jaringan TIDAK membuat kunci limiter tanpa batas", async () => {
    for (let i = 0; i < 50; i += 1) await requestReset(`korban${i}@contoh.id`);

    expect(send).toHaveBeenCalledTimes(5);
    // 1 kunci jaringan + 5 kunci email (hanya dari request yang lolos jaringan).
    expect(__rateLimitKeyCount()).toBe(6);
  });

  it("anti email-bombing tetap utuh: satu email dari banyak jaringan berhenti di 3 kiriman", async () => {
    for (let i = 0; i < 10; i += 1) {
      ipRef.current = `198.51.${i}.9`;
      await requestReset("korban@contoh.id");
    }

    expect(send).toHaveBeenCalledTimes(3);
  });

  it("respons tetap sukses generik saat dibatasi (anti-enumerasi)", async () => {
    const results = [];
    for (let i = 0; i < 8; i += 1) results.push(await requestReset("a@b.id"));

    expect(send).toHaveBeenCalledTimes(3);
    expect(new Set(results.map((r) => JSON.stringify(r))).size).toBe(1);
  });

  it("Turnstile gagal → tak ada kunci limiter sama sekali (email acak tak membanjiri memori)", async () => {
    human.current = false;
    for (let i = 0; i < 30; i += 1) await requestReset(`junk${i}@contoh.id`);

    expect(send).not.toHaveBeenCalled();
    expect(__rateLimitKeyCount()).toBe(0);
  });

  it("alamat salah ketik tak menghabiskan jatah jaringan untuk alamat yang benar", async () => {
    for (let i = 0; i < 5; i += 1) await requestReset("typo@contoh.id");
    await requestReset("benar@contoh.id");

    // 3 kiriman ke alamat typo (plafon email), lalu alamat benar tetap terkirim:
    // 2 percobaan typo yang ditolak plafon email tak memakai slot jaringan.
    expect(send).toHaveBeenCalledTimes(4);
  });
});

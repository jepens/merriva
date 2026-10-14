import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

/**
 * Cookie sesi Supabase wajib ber-atribut `Secure` di produksi (DECISIONS #78).
 *
 * `DEFAULT_COOKIE_OPTIONS` milik `@supabase/ssr` hanya berisi
 * `{ path, sameSite: "lax", httpOnly: false, maxAge }` — **tanpa `secure`**.
 * Dokumentasi vendor tidak menyebutkannya; nilainya hanya terlihat dari
 * kodenya, jadi tak ada yang akan menemukannya dengan membaca dokumen.
 *
 * Tanpa `Secure`, satu-satunya yang menahan access + refresh token pemilik agar
 * tak berjalan di atas HTTP polos adalah HSTS — yang baru mengikat SETELAH satu
 * respons HTTPS diterima, dan tidak selalu bertahan di WebView tertanam,
 * yaitu jalur utama produk ini.
 *
 * Kedua pemanggil diuji karena middleware MENULIS ULANG cookie sesi pada tiap
 * navigasi: menambal satu sisi saja akan ditimpa sisi lain pada request
 * berikutnya — perbaikan yang terlihat selesai padahal tidak.
 */

/**
 * Parameternya DIDEKLARASIKAN meski tak dipakai: `vi.fn()` tanpa parameter
 * membuat `mock.calls[0]` bertipe tuple kosong, sehingga `[2]` lolos vitest
 * tetapi GAGAL `tsc` — dan CI baru memerah setelah commit.
 */
const { createServerClient } = vi.hoisted(() => ({
  createServerClient: vi.fn(
    (
      _url: string,
      _key: string,
      _opts?: { cookieOptions?: { secure?: boolean; httpOnly?: boolean } },
    ) => ({
      auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    }),
  ),
}));
vi.mock("@supabase/ssr", () => ({ createServerClient }));

vi.mock("@/lib/env", () => ({
  getSupabaseUrl: () => "https://contoh.supabase.co",
  getSupabaseAnonKey: () => "anon",
}));

vi.mock("next/headers", () => ({
  headers: async () => ({ get: () => null }),
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));

const opsi = () =>
  createServerClient.mock.calls[0]?.[2] as
    { cookieOptions?: { secure?: boolean } } | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe.each([
  [
    "server (Server Component / Action / Route Handler)",
    "@/lib/supabase/server",
  ],
  [
    "middleware (menulis ulang cookie tiap navigasi)",
    "@/lib/supabase/middleware",
  ],
])("klien %s", (_nama, modul) => {
  const panggil = async (nodeEnv: string) => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    vi.resetModules();
    const mod = (await import(modul)) as Record<string, unknown>;
    if (modul.endsWith("server")) {
      await (mod.createSupabaseServerClient as () => Promise<unknown>)();
    } else {
      const request = {
        cookies: { getAll: () => [], set: () => {} },
        headers: new Headers(),
      };
      await (mod.updateSession as (r: unknown) => Promise<unknown>)(request);
    }
  };

  it("produksi → `secure: true`", async () => {
    await panggil("production");
    expect(opsi()?.cookieOptions?.secure).toBe(true);
  });

  it("dev → `secure: false`, agar http://localhost tetap bisa login", async () => {
    await panggil("development");
    expect(opsi()?.cookieOptions?.secure).toBe(false);
  });

  it("`httpOnly` TIDAK disentuh — klien peramban membacanya", async () => {
    // `lib/supabase/browser.ts` membaca cookie ini lewat `document.cookie`.
    // Menyetel `httpOnly: true` di sini akan mematikannya, dan gejalanya
    // ("kadang ter-logout sendiri") jauh dari sebabnya.
    await panggil("production");
    expect(opsi()?.cookieOptions).not.toHaveProperty("httpOnly");
  });
});

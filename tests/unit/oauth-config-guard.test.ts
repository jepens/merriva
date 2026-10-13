import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Login Google berhenti SEBELUM dimulai bila `NEXT_PUBLIC_APP_URL` kosong.
 *
 * KEJADIAN NYATA (2026-10-14, produksi). `NEXT_PUBLIC_APP_URL` tak diisi sebagai
 * build-arg di Easypanel, jadi `appUrl` memakai default `http://localhost:3000`
 * dan `redirect_to` yang dikirim ke Supabase menunjuk localhost. Supabase
 * menolaknya (tak ada di daftar izin), jatuh ke Site URL, dan `?code=` mendarat
 * di HALAMAN DEPAN alih-alih `/auth/callback`. Tak ada yang menukarnya menjadi
 * sesi. Pengguna melihat beranda lagi, seolah tak terjadi apa-apa.
 *
 * Yang membuatnya mahal bukan bug-nya, melainkan KESUNYIANNYA: tak ada galat di
 * peramban, tak ada galat di server, tak ada entri di Sentry. Satu-satunya
 * petunjuk hanya terlihat bila seseorang membaca query string di bilah alamat.
 *
 * Dua sifat dijaga di sini:
 *  1. ada JEJAK di Sentry dengan sebab yang disebut terang-terangan;
 *  2. pesan ke pengguna BERBEDA dari "gagal, coba lagi" — menyuruh mencoba lagi
 *     pada salah konfigurasi adalah saran yang keliru, dan membuat pengguna
 *     menyalahkan akun Google-nya sendiri.
 */

const { reportHandledError } = vi.hoisted(() => ({
  reportHandledError: vi.fn(),
}));
vi.mock("@/lib/observability", () => ({ reportHandledError }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
}));

const { signInWithOAuth } = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(async () => ({
    data: { url: "https://accounts.google.com/o/oauth2/v2/auth?x=1" },
    error: null,
  })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { signInWithOAuth } }),
}));

import { copy } from "@/lib/copy";
import { signInWithGoogleAction } from "@/server/actions/auth";

/** Aksi ini selalu berakhir dengan `redirect()`; kembalikan tujuannya. */
async function tujuanRedirect(): Promise<string> {
  try {
    await signInWithGoogleAction(new FormData());
  } catch (e) {
    const m = /^NEXT_REDIRECT:(.*)$/.exec((e as Error).message);
    if (m) return m[1];
    throw e;
  }
  throw new Error("aksi tidak melakukan redirect");
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("produksi tanpa NEXT_PUBLIC_APP_URL", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
  });

  it("tarian OAuth tidak pernah dimulai", async () => {
    // Memulainya hanya memindahkan kegagalan ke tempat yang tak bisa kita lihat:
    // begitu pengguna berada di accounts.google.com, kendali ada di Supabase dan
    // Google, dan hasilnya adalah beranda tanpa sesi tanpa jejak apa pun.
    await expect(tujuanRedirect()).resolves.toBe("/masuk?error=config");
    expect(signInWithOAuth).not.toHaveBeenCalled();
  });

  it("dilaporkan dengan sebab yang disebut, bukan galat generik", async () => {
    await tujuanRedirect();
    const [err, area, extra] = reportHandledError.mock.calls[0];
    expect(area).toBe("auth.oauth.config");
    expect((err as Error).message).toContain("NEXT_PUBLIC_APP_URL");
    // `redirectTo` ikut dilampirkan: yang membaca Sentry langsung melihat
    // localhost dan tahu persis apa yang kurang, tanpa menebak.
    expect((extra as { redirectTo: string }).redirectTo).toContain("localhost");
  });

  it("area laporannya BEDA dari kegagalan OAuth biasa", async () => {
    // `auth.oauth` berarti "Google/Supabase menolak"; `auth.oauth.config`
    // berarti "kita yang belum selesai memasang". Menyatukannya membuat yang
    // bisa diperbaiki dalam dua menit tenggelam di antara yang tidak.
    await tujuanRedirect();
    expect(reportHandledError.mock.calls[0][1]).not.toBe("auth.oauth");
  });

  it("pesannya tidak menyuruh pengguna mencoba lagi", async () => {
    const pesan = copy.auth.errorOauthConfig;
    expect(pesan).not.toBe(copy.auth.errorOauthLogin);
    expect(pesan.toLowerCase()).not.toContain("coba lagi");
    // Ada jalan keluar yang benar-benar bisa ditempuh sekarang.
    expect(pesan.toLowerCase()).toContain("kata sandi");
  });
});

describe("konfigurasi benar", () => {
  it("dengan NEXT_PUBLIC_APP_URL terisi, OAuth berjalan normal", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://merriva.id");
    await expect(tujuanRedirect()).resolves.toContain("accounts.google.com");
    expect(signInWithOAuth).toHaveBeenCalled();
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("di dev, localhost memang benar — gerbang tidak menghalangi", async () => {
    // Pagar ini khusus produksi. Menyalakannya di dev akan mematikan login
    // Google di localhost, tempat `http://localhost:3000` justru nilai yang sah.
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    await expect(tujuanRedirect()).resolves.toContain("accounts.google.com");
    expect(signInWithOAuth).toHaveBeenCalled();
  });
});

describe("halaman masuk mengenali kode galatnya", () => {
  it("`config` punya pesan sendiri — bukan jatuh ke diam", async () => {
    // Kode galat tanpa entri di `errorCopy` TIDAK menampilkan apa pun: pengguna
    // dibuang ke halaman masuk tanpa penjelasan sama sekali.
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("src/app/(auth)/masuk/page.tsx", "utf8"),
    );
    expect(src).toContain("config: copy.auth.errorOauthConfig");
  });
});

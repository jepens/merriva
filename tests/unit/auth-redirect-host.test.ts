import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Redirect auth tidak boleh mengarah ke host yang mengikat server (DECISIONS #77).
 *
 * KEJADIAN NYATA (2026-10-14, produksi). Login Google BERHASIL — kode ditukar,
 * cookie sesi benar-benar tertulis — lalu peramban dikirim ke
 * `https://0.0.0.0:3000/dashboard` dan berhenti di ERR_ADDRESS_INVALID.
 * Pengguna menyimpulkan "login gagal" untuk login yang sebenarnya berhasil.
 *
 * Sebabnya `new URL(request.url).origin`. Di `output: "standalone"` Next
 * merakit `request.url` dari alamat yang DIIKAT server (`HOSTNAME=0.0.0.0`),
 * bukan dari header `Host`:
 *
 *   const initUrl = this.fetchHostname && this.port
 *     ? `${protocol}://${this.fetchHostname}:${this.port}${req.url}` : …
 *
 * KENAPA FIXTURE-NYA BERHOST `0.0.0.0:3000`: dengan fixture `localhost` setiap
 * test di berkas ini LULUS tanpa menguji apa pun — `localhost` kebetulan host
 * yang benar di mesin pengembang, jadi obat yang salah pun akan tampak bekerja.
 * Itu persis cara bug ini lolos ke produksi.
 */

const { reportHandledError } = vi.hoisted(() => ({
  reportHandledError: vi.fn(),
}));
vi.mock("@/lib/observability", () => ({ reportHandledError }));

type Hasil = { error: unknown };
const { auth } = vi.hoisted(() => ({
  auth: {
    exchangeCodeForSession: vi.fn<() => Promise<Hasil>>(),
    verifyOtp: vi.fn<(arg: unknown) => Promise<Hasil>>(),
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth }),
}));

import { relativeRedirect } from "@/lib/relative-redirect";
import { GET as callback } from "@/app/auth/callback/route";
import { GET as confirm } from "@/app/auth/confirm/route";

/** Host yang DIIKAT container — inilah yang dilihat Route Handler di produksi. */
const HOST_TERIKAT = "https://0.0.0.0:3000";
/** Host yang dilihat PERAMBAN — dasar penyelesaian `Location` relatif. */
const HOST_PUBLIK = "https://merriva.id";

const minta = (path: string) =>
  new Request(`${HOST_TERIKAT}${path}`) as unknown as NextRequest;

/** Ke mana peramban SEBENARNYA pergi setelah menyelesaikan `Location`. */
const tujuanPeramban = (res: Response, dariPath: string) =>
  new URL(res.headers.get("Location")!, `${HOST_PUBLIK}${dariPath}`).href;

beforeEach(() => {
  vi.clearAllMocks();
  auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  auth.verifyOtp.mockResolvedValue({ error: null });
});

describe("relativeRedirect", () => {
  it("Location-nya relatif — tak pernah membawa host", () => {
    const loc = relativeRedirect("/dashboard").headers.get("Location");
    expect(loc).toBe("/dashboard");
    expect(loc).not.toContain("://");
  });

  it("303, bukan 301/308 yang di-cache permanen peramban", () => {
    // 301/308 akan membuat peramban mengingat `/auth/callback → /dashboard`
    // SELAMANYA dan mematikan setiap login berikutnya, termasuk jalur galat.
    expect(relativeRedirect("/dashboard").status).toBe(303);
  });

  it("query dan fragment dipertahankan", () => {
    expect(relativeRedirect("/masuk?error=oauth").headers.get("Location")).toBe(
      "/masuk?error=oauth",
    );
    expect(relativeRedirect("/a?b=1#c").headers.get("Location")).toBe(
      "/a?b=1#c",
    );
  });

  it("dipersen-encode — nilai header di luar Latin-1 tidak konforman", () => {
    // `safeNextPath` meloloskan spasi (0x20 di atas ambang 0x1f) dan UTF-8;
    // `NextResponse.redirect` dulu meng-encode-nya diam-diam, jadi tanpa
    // langkah ini perbaikannya menukar bug kasar dengan bug halus yang
    // ditangani berbeda oleh Traefik maupun Cloudflare.
    const loc = relativeRedirect("/dashboard/café x")!.headers.get("Location")!;
    expect(loc).toBe("/dashboard/caf%C3%A9%20x");
    expect(/^[\x20-\x7e]*$/.test(loc)).toBe(true);
  });
});

describe("GET /auth/callback", () => {
  it("sukses → peramban mendarat di domain publik, bukan 0.0.0.0", async () => {
    const path = "/auth/callback?code=abc&next=%2Fdashboard";
    const res = await callback(minta(path));
    expect(res.headers.get("Location")).not.toContain("0.0.0.0");
    expect(tujuanPeramban(res, path)).toBe(`${HOST_PUBLIK}/dashboard`);
  });

  it("menghormati `next`", async () => {
    const path = "/auth/callback?code=abc&next=%2Fdashboard%2Fundangan";
    const res = await callback(minta(path));
    expect(tujuanPeramban(res, path)).toBe(`${HOST_PUBLIK}/dashboard/undangan`);
  });

  it("kode ditukar lebih dulu, baru redirect", async () => {
    await callback(minta("/auth/callback?code=abc"));
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
  });

  it("penukaran gagal → `?error=oauth` DAN dilaporkan", async () => {
    // Dulu separuh tarian OAuth ini tak punya jejak sama sekali: hanya sisi
    // pemberangkatan yang melapor, sehingga "verifier PKCE hilang" tak bisa
    // dibedakan dari "pengguna membatalkan".
    auth.exchangeCodeForSession.mockResolvedValue({
      error: { message: "invalid flow state", code: "flow_state_not_found" },
    });
    const path = "/auth/callback?code=abc";
    const res = await callback(minta(path));
    expect(tujuanPeramban(res, path)).toBe(`${HOST_PUBLIK}/masuk?error=oauth`);
    expect(reportHandledError.mock.calls[0][1]).toBe("auth.callback.exchange");
  });

  it("tanpa kode → `?error=oauth` tanpa menyentuh Supabase", async () => {
    const path = "/auth/callback";
    const res = await callback(minta(path));
    expect(tujuanPeramban(res, path)).toBe(`${HOST_PUBLIK}/masuk?error=oauth`);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("jalur galat pun tak boleh mengarah ke 0.0.0.0", async () => {
    // Cacat yang sama ada di DUA baris. Memperbaiki satu menyisakan pengguna
    // yang gagal login di jalan buntu yang sama.
    auth.exchangeCodeForSession.mockResolvedValue({ error: { message: "x" } });
    const res = await callback(minta("/auth/callback?code=abc"));
    expect(res.headers.get("Location")).not.toContain("0.0.0.0");
  });
});

describe("GET /auth/confirm — verifikasi email & reset kata sandi", () => {
  // `next` WAJIB disebut eksplisit: `safeNextPath` jatuh ke `/dashboard` bila
  // kosong, jadi test tanpa `next` tetap hijau walau jalur reset kembali rusak.
  const RESET =
    "/auth/confirm?token_hash=th_1&type=recovery&next=%2Freset-password%2Fubah";

  it("reset sandi mendarat di halaman ubah sandi, bukan 0.0.0.0", async () => {
    const res = await confirm(minta(RESET));
    expect(res.headers.get("Location")).not.toContain("0.0.0.0");
    expect(tujuanPeramban(res, RESET)).toBe(
      `${HOST_PUBLIK}/reset-password/ubah`,
    );
  });

  it("verifikasi pendaftaran mendarat di dashboard", async () => {
    const path = "/auth/confirm?token_hash=th_1&type=email";
    const res = await confirm(minta(path));
    expect(tujuanPeramban(res, path)).toBe(`${HOST_PUBLIK}/dashboard`);
  });

  it("verifyOtp gagal → `?error=verify`, dilaporkan dengan `type`", async () => {
    // `type` membedakan "verifikasi pendaftaran gagal" dari "reset sandi
    // gagal" — dua masalah dengan obat yang berbeda.
    auth.verifyOtp.mockResolvedValue({
      error: { message: "expired", code: "otp_expired" },
    });
    const res = await confirm(minta(RESET));
    expect(tujuanPeramban(res, RESET)).toBe(
      `${HOST_PUBLIK}/masuk?error=verify`,
    );
    const [, area, extra] = reportHandledError.mock.calls[0];
    expect(area).toBe("auth.confirm.verify");
    expect((extra as { type: string }).type).toBe("recovery");
  });

  it("`token_hash` TIDAK pernah ikut ke laporan", async () => {
    // Kredensial sekali pakai: sekali masuk Sentry, ia hidup di luar kendali
    // kita pada sistem yang tak pernah dimaksudkan menyimpannya.
    auth.verifyOtp.mockResolvedValue({ error: { message: "expired" } });
    await confirm(minta(RESET));
    expect(JSON.stringify(reportHandledError.mock.calls[0])).not.toContain(
      "th_1",
    );
  });

  it("tanpa token_hash/type → `?error=verify` tanpa menyentuh Supabase", async () => {
    const path = "/auth/confirm";
    const res = await confirm(minta(path));
    expect(tujuanPeramban(res, path)).toBe(`${HOST_PUBLIK}/masuk?error=verify`);
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Dua gerbang keamanan yang gagal SENYAP di produksi (DECISIONS #78).
 *
 * 1. **Turnstile menerima `localhost` tanpa syarat.** Gerbang hostname ada
 *    justru karena site key kita publik — komentarnya sendiri mengatakan itu —
 *    lalu daftar sahnya memuat `localhost`, yang membatalkannya: siapa pun bisa
 *    menyajikan widget di `http://localhost:8080` miliknya, menyelesaikan
 *    tantangan, dan mengirim tokennya ke Server Action produksi.
 *
 * 2. **Sinyal topologi IP hanya `console.warn`.** Tak ada
 *    `captureConsoleIntegration` di ketiga `Sentry.init`, jadi kondisi yang
 *    komentarnya sebut "seharusnya TIDAK PERNAH muncul" memang tak akan pernah
 *    muncul bagi siapa pun. Jebakan yang sama sudah pernah ditemukan di
 *    `email.receipt`. Taruhannya: `cf-rejected` membuat rate limit memakai IP
 *    EDGE Cloudflare, sehingga semua tamu di balik edge itu berbagi satu bucket.
 *
 * Modul diimpor ULANG per test (`resetModules`) karena keduanya menyimpan state
 * modul — `appUrl` dibaca saat impor, dan `warned` mendedup seumur proses.
 */

const { reportHandledError, refs } = vi.hoisted(() => ({
  reportHandledError: vi.fn(),
  refs: { h: {} as Record<string, string | null> },
}));
vi.mock("@/lib/observability", () => ({ reportHandledError }));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (k: string) => refs.h[k] ?? null }),
}));

const laporan = () => reportHandledError.mock.calls;

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  refs.h = {};
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** Impor ulang `turnstile.ts` dengan `appUrl` dan NODE_ENV yang ditentukan. */
async function turnstile(appUrl: string, nodeEnv = "production") {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", appUrl);
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.resetModules();
  return import("@/lib/turnstile");
}

describe("daftar host Turnstile", () => {
  it("DI PRODUKSI localhost ditolak — ini seluruh inti gerbangnya", async () => {
    // Site key publik + localhost di daftar = tantangan bisa diselesaikan di
    // mesin penyerang lalu tokennya dipakai di sini. Dampaknya pembuatan akun
    // massal dan email-bombing lewat reset kata sandi.
    const { allowedTurnstileHosts } = await turnstile("https://merriva.id");
    const set = allowedTurnstileHosts()!;
    expect(set.has("localhost")).toBe(false);
    expect(set.has("127.0.0.1")).toBe(false);
  });

  it("di luar produksi keduanya diterima — dev tetap bisa bekerja", async () => {
    const { allowedTurnstileHosts } = await turnstile(
      "http://localhost:3000",
      "development",
    );
    const set = allowedTurnstileHosts()!;
    expect(set.has("localhost")).toBe(true);
    expect(set.has("127.0.0.1")).toBe(true);
  });

  it("apex dan www saling melengkapi, dua arah", async () => {
    const { allowedTurnstileHosts } = await turnstile("https://merriva.id");
    expect([...allowedTurnstileHosts()!].sort()).toEqual([
      "merriva.id",
      "www.merriva.id",
    ]);
    const dariWww = allowedTurnstileHosts("https://www.merriva.id")!;
    expect([...dariWww].sort()).toEqual(["merriva.id", "www.merriva.id"]);
  });

  it("appUrl tak valid → null, bukan set kosong", async () => {
    // Set kosong akan MENOLAK semua token; `null` berarti "lewati pemeriksaan".
    // Membedakan keduanya mencegah appUrl yang rusak mematikan seluruh form.
    const { allowedTurnstileHosts } = await turnstile("bukan-url");
    expect(allowedTurnstileHosts()).toBe(null);
  });
});

describe("verifyTurnstile melaporkan salah pasang", () => {
  const jawab = (body: unknown) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ json: async () => body })),
    );

  it("secret kosong di produksi → gagal-tutup DAN dilaporkan", async () => {
    // Gagal-tutup sudah benar sejak dulu; yang hilang jejaknya. Tanpa laporan,
    // gejalanya adalah RSVP, amplop, Album Momen, dan pendaftaran gagal
    // SERENTAK tanpa sebab yang terlihat di mana pun.
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const { verifyTurnstile } = await turnstile("https://merriva.id");
    expect(await verifyTurnstile("tok")).toBe(false);
    expect(laporan()[0][1]).toBe("security.turnstile.secret-unset");
  });

  it("hostname asing → ditolak, dilaporkan beserta daftar yang sah", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "rahasia");
    jawab({ success: true, hostname: "localhost" });
    const { verifyTurnstile } = await turnstile("https://merriva.id");
    expect(await verifyTurnstile("tok")).toBe(false);
    const [, area, extra] = laporan()[0];
    expect(area).toBe("security.turnstile.host");
    // Daftarnya ikut agar pembaca Sentry bisa membedakan dua sebab yang sangat
    // berbeda: token dari pihak ketiga, atau `appUrl` kita sendiri salah host.
    expect(extra).toMatchObject({ hostname: "localhost" });
    expect((extra as { allowed: string[] }).allowed).toContain("merriva.id");
  });

  it("hostname sah → lolos, tanpa laporan", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "rahasia");
    jawab({ success: true, hostname: "merriva.id" });
    const { verifyTurnstile } = await turnstile("https://merriva.id");
    expect(await verifyTurnstile("tok")).toBe(true);
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("`invalid-input-secret` dilaporkan — setiap form di situs sedang gagal", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "salah");
    jawab({ success: false, "error-codes": ["invalid-input-secret"] });
    const { verifyTurnstile } = await turnstile("https://merriva.id");
    expect(await verifyTurnstile("tok")).toBe(false);
    expect(laporan()[0][1]).toBe("security.turnstile.verify");
  });

  it("penolakan biasa TIDAK dilaporkan — kebisingan membunuh laporan", async () => {
    // Bot yang ditolak itu kerja normal dan terjadi terus-menerus. Melaporkan
    // semuanya membuat orang berhenti membaca Sentry, dan saat itulah yang
    // penting ikut tak terbaca.
    vi.stubEnv("TURNSTILE_SECRET_KEY", "rahasia");
    jawab({ success: false, "error-codes": ["timeout-or-duplicate"] });
    const { verifyTurnstile } = await turnstile("https://merriva.id");
    expect(await verifyTurnstile("tok")).toBe(false);
    expect(reportHandledError).not.toHaveBeenCalled();
  });
});

describe("topologi IP klien", () => {
  /** Impor ulang `request-ip.ts` (state `warned` seumur proses). */
  async function getClientIp(
    h: Record<string, string | null>,
    nodeEnv = "production",
  ) {
    vi.stubEnv("NODE_ENV", nodeEnv);
    refs.h = h;
    vi.resetModules();
    const mod = await import("@/lib/request-ip");
    return mod.getClientIp();
  }

  const EDGE_CF = "173.245.48.1"; // di dalam rentang Cloudflare
  const PEER_LAIN = "203.0.113.9"; // publik, BUKAN Cloudflare

  it("`cf-rejected` dilaporkan — rate limit sedang memakai IP edge", async () => {
    const ip = await getClientIp({
      "x-forwarded-for": PEER_LAIN,
      "cf-connecting-ip": "198.51.100.7",
    });
    // IP yang dipakai adalah peer, bukan cf-connecting-ip: itulah kerusakannya.
    expect(ip).toBe(PEER_LAIN);
    const [, area, extra] = laporan()[0];
    expect(area).toBe("security.client-ip.topology");
    expect(extra).toEqual({ source: "cf-rejected" });
  });

  it("`unverified` dilaporkan", async () => {
    const ip = await getClientIp({ "cf-connecting-ip": "198.51.100.7" });
    expect(ip).toBe("198.51.100.7");
    expect(laporan()[0][2]).toEqual({ source: "unverified" });
  });

  it("TANPA nilai IP di laporan — UU PDP", async () => {
    await getClientIp({
      "x-forwarded-for": PEER_LAIN,
      "cf-connecting-ip": "198.51.100.7",
    });
    // SELURUH panggilan diperiksa, bukan hanya yang pertama: laporan kedua yang
    // ditambahkan kelak — dengan niat baik, "biar gampang dilacak" — adalah
    // persis cara IP mentah akan masuk ke Sentry tanpa ada yang menyadarinya.
    const serialisasi = JSON.stringify(
      laporan().map(([err, area, extra]) => [
        (err as Error).message,
        area,
        extra,
      ]),
    );
    expect(serialisasi).not.toContain(PEER_LAIN);
    expect(serialisasi).not.toContain("198.51.100.7");
  });

  it("topologi sehat (lewat Cloudflare) tak melaporkan apa pun", async () => {
    const ip = await getClientIp({
      "x-forwarded-for": `198.51.100.7, ${EDGE_CF}`,
      "cf-connecting-ip": "198.51.100.7",
    });
    expect(ip).toBe("198.51.100.7");
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("sekali per proses — satu salah pasang tak membanjiri Sentry", async () => {
    const h = {
      "x-forwarded-for": PEER_LAIN,
      "cf-connecting-ip": "198.51.100.7",
    };
    vi.stubEnv("NODE_ENV", "production");
    refs.h = h;
    vi.resetModules();
    const mod = await import("@/lib/request-ip");
    await mod.getClientIp();
    await mod.getClientIp();
    await mod.getClientIp();
    expect(laporan()).toHaveLength(1);
  });

  it("di luar produksi tidak melapor — localhost memang tak lewat Cloudflare", async () => {
    await getClientIp({ "cf-connecting-ip": "198.51.100.7" }, "development");
    expect(reportHandledError).not.toHaveBeenCalled();
  });
});

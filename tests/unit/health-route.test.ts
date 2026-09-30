import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `/api/health` adalah gerbang hidup-mati deployment: `HEALTHCHECK` di Dockerfile
 * memanggilnya, dan status non-2xx membuat Docker menandai container unhealthy →
 * Swarm membunuhnya (exit 143) → restart loop, layanan kuning di Easypanel,
 * domain "Service is not reachable". Semua itu TANPA satu pun galat di log
 * aplikasi, karena servernya sendiri sehat.
 *
 * Pernah terjadi sungguhan: probe memakai anon key, sedangkan Supabase
 * membatasi `GET /rest/v1/` hanya untuk `service_role` ("Only the `service_role`
 * API key can be used for this endpoint") → 401 → `db: "down"` → 503 selamanya.
 * Route ini sebelumnya tak punya test sama sekali.
 */

const URL_SUPABASE = "https://proyek.supabase.co";
const ANON = "anon-key";
const SERVICE = "service-role-key";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_SUPABASE);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function panggil() {
  const { GET } = await import("@/app/api/health/route");
  const res = await GET();
  return { res, body: (await res.json()) as Record<string, unknown> };
}

/** Header yang dikirim ke Supabase pada panggilan pertama. */
function kunciTerpakai(): string {
  const [, init] = fetchMock.mock.calls[0] as [
    string,
    { headers: Record<string, string> },
  ];
  return init.headers.apikey;
}

describe("/api/health — probe Supabase", () => {
  it("memakai service_role, BUKAN anon (anon ditolak 401 oleh /rest/v1/)", async () => {
    fetchMock.mockResolvedValue({ ok: true });

    const { res, body } = await panggil();

    expect(kunciTerpakai()).toBe(SERVICE);
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ status: "ok", db: "up" });
  });

  it("tanpa service_role → jatuh ke anon (dev/CI) agar tetap bisa menyala", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    fetchMock.mockResolvedValue({ ok: true });

    await panggil();

    expect(kunciTerpakai()).toBe(ANON);
  });

  it("Supabase menolak (mis. 401) → 503 supaya kegagalannya TERLIHAT", async () => {
    fetchMock.mockResolvedValue({ ok: false });

    const { res, body } = await panggil();

    expect(res.status).toBe(503);
    expect(body).toMatchObject({ status: "error", db: "down" });
  });

  it("jaringan gagal → 503, tak melempar", async () => {
    fetchMock.mockRejectedValue(new Error("fetch failed"));

    const { res, body } = await panggil();

    expect(res.status).toBe(503);
    expect(body.db).toBe("down");
  });

  it("env Supabase kosong (build/CI) → tetap 200, ditandai not_configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    const { res, body } = await panggil();

    expect(res.status).toBe(200);
    expect(body.db).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("probe menembak /rest/v1/ pada URL proyek, tanpa slash ganda", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `${URL_SUPABASE}/`);
    fetchMock.mockResolvedValue({ ok: true });

    await panggil();

    expect(fetchMock.mock.calls[0][0]).toBe(`${URL_SUPABASE}/rest/v1/`);
  });
});

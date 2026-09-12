import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Paginasi galeri Album Momen (AUDIT-2026-09-04 PER-4).
 *
 * Dua kelas invarian dijaga di sini:
 *  - PERFORMA: query selalu ber-`limit`, kursor keyset memakai `created_at`
 *    baris terakhir, dan halaman berikutnya dideteksi dengan mengambil satu
 *    baris lebih (bukan query hitung terpisah);
 *  - KEAMANAN: `loadMomenPhotosAction` adalah aksi PUBLIK, jadi gerbang fase
 *    diperiksa ULANG di dalamnya — pra-reveal tak boleh memancarkan foto,
 *    berapa pun kursor yang dikirim klien.
 */

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ ok: true, remaining: 9, retryAfterMs: 0 }),
}));
vi.mock("@/lib/request-ip", () => ({
  clientRateKey: () => Promise.resolve("k"),
  scopedClientRateKey: () => Promise.resolve("k"),
  staticRateKey: () => "k",
  getClientIp: () => Promise.resolve("1.2.3.4"),
}));
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => undefined, set: vi.fn() }),
}));
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({
    upload: vi.fn(),
    delete: vi.fn(),
    getPublicUrl: (p: string) => `https://cdn.test/${p}`,
  }),
}));

const { adminRef } = vi.hoisted(() => ({
  adminRef: { current: null as never },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => adminRef.current,
}));

import { fetchMomenPhotos, MOMEN_PAGE_SIZE } from "@/server/momen/photos";
import { loadMomenPhotosAction } from "@/server/actions/momen-guest";

const ALBUM = "11111111-1111-4111-8111-111111111111";
const SLUG = "andi-sinta";

/** Baris foto sintetis; `created_at` menurun agar urutannya realistis. */
function rows(n: number, status: "visible" | "hidden" = "visible") {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    guest_name: `Tamu ${i}`,
    device_id: `d${i}`,
    filter_id: "hangat",
    storage_path: `momen/a/p${i}/display.webp`,
    thumb_path: `momen/a/p${i}/thumb.webp`,
    status,
    created_at: new Date(Date.UTC(2026, 8, 13, 10, 0, 60 - i)).toISOString(),
  }));
}

/**
 * Builder palsu yang MEREKAM query (limit/eq/lt) apa adanya. Dibuat THENABLE —
 * seperti supabase-js, di mana setiap metode mengembalikan builder dan `await`
 * pada builder itulah yang mengeksekusi query.
 */
function makeChain(
  available: ReturnType<typeof rows>,
  calls: Record<string, unknown>,
) {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = (col: string, val: unknown) => {
    calls[`eq:${col}`] = val;
    return chain;
  };
  chain.lt = (col: string, val: unknown) => {
    calls[`lt:${col}`] = val;
    return chain;
  };
  chain.order = () => chain;
  chain.limit = (n: number) => {
    calls.limit = n;
    return chain;
  };
  chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
    const n = typeof calls.limit === "number" ? calls.limit : available.length;
    const filtered =
      calls["eq:status"] === "visible"
        ? available.filter((r) => r.status === "visible")
        : available;
    return Promise.resolve({ data: filtered.slice(0, n), error: null }).then(
      res,
      rej,
    );
  };
  return chain;
}

function makeAdmin(
  available: ReturnType<typeof rows>,
  calls: Record<string, unknown>,
) {
  const chain = makeChain(available, calls);
  return {
    from: () => chain,
    rpc: vi.fn(() =>
      Promise.resolve({
        data: [
          {
            visible_count: 3,
            hidden_count: 1,
            photographer_count: 2,
            participant_count: 2,
          },
        ],
        error: null,
      }),
    ),
  };
}

let calls: Record<string, unknown>;

beforeEach(() => {
  calls = {};
});

describe("fetchMomenPhotos — paginasi kursor", () => {
  it("SELALU memakai limit, dan meminta satu baris lebih untuk deteksi halaman berikutnya", async () => {
    const admin = makeAdmin(rows(100), calls) as never;

    await fetchMomenPhotos(admin, ALBUM);

    expect(calls.limit).toBe(MOMEN_PAGE_SIZE + 1);
  });

  it("halaman penuh → nextCursor = created_at baris TERAKHIR yang dikembalikan", async () => {
    const data = rows(100);
    const admin = makeAdmin(data, calls) as never;

    const page = await fetchMomenPhotos(admin, ALBUM);

    expect(page.photos).toHaveLength(MOMEN_PAGE_SIZE);
    // Baris ke-41 dibuang (hanya penanda "masih ada"), cursor dari baris ke-40.
    expect(page.nextCursor).toBe(data[MOMEN_PAGE_SIZE - 1]!.created_at);
  });

  it("sisa kurang dari satu halaman → nextCursor null (tak ada tombol muat lebih)", async () => {
    const admin = makeAdmin(rows(5), calls) as never;

    const page = await fetchMomenPhotos(admin, ALBUM);

    expect(page.photos).toHaveLength(5);
    expect(page.nextCursor).toBeNull();
  });

  it("kursor diteruskan sebagai filter keyset `created_at <`, bukan OFFSET", async () => {
    const admin = makeAdmin(rows(10), calls) as never;

    await fetchMomenPhotos(admin, ALBUM, {
      cursor: "2026-09-13T10:00:30.000Z",
    });

    expect(calls["lt:created_at"]).toBe("2026-09-13T10:00:30.000Z");
  });

  it("jalur TAMU memfilter status visible; jalur PEMILIK boleh menyertakan hidden", async () => {
    const adminGuest = makeAdmin(rows(3), calls) as never;
    await fetchMomenPhotos(adminGuest, ALBUM);
    expect(calls["eq:status"]).toBe("visible");

    const ownerCalls: Record<string, unknown> = {};
    const adminOwner = makeAdmin(rows(3), ownerCalls) as never;
    await fetchMomenPhotos(adminOwner, ALBUM, { includeHidden: true });
    expect(ownerCalls["eq:status"]).toBeUndefined();
  });
});

describe("loadMomenPhotosAction — gerbang fase tetap fail-closed", () => {
  /** Album aktif dengan `reveal_at` yang dapat diatur per-tes. */
  function albumAdmin(revealAt: string | null, data = rows(3)) {
    const photoChain = makeChain(data, {});

    const lookup = (table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = () =>
        Promise.resolve({
          data:
            table === "invitations"
              ? { id: "inv-1", status: "active" }
              : {
                  id: ALBUM,
                  status: "active",
                  quota_per_guest: 5,
                  allow_library_upload: true,
                  reveal_at: revealAt,
                },
          error: null,
        });
      return chain;
    };

    return {
      from: (table: string) =>
        table === "momen_photos" ? photoChain : lookup(table),
    };
  }

  it("PRA-REVEAL → daftar kosong meski klien mengirim kursor", async () => {
    // Reveal masih jauh di masa depan.
    adminRef.current = albumAdmin("2099-01-01T00:00:00+07:00") as never;

    const res = await loadMomenPhotosAction(SLUG, "2026-09-13T10:00:30.000Z");

    expect(res).toEqual({ status: "ok", photos: [], nextCursor: null });
  });

  it("SUDAH reveal → foto dikembalikan", async () => {
    adminRef.current = albumAdmin(null) as never;

    const res = await loadMomenPhotosAction(SLUG, null);

    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    expect(res.photos).toHaveLength(3);
    expect(res.photos[0]!.url).toContain("https://cdn.test/");
  });

  it("kursor berbentuk liar ditolak (tak menyentuh DB)", async () => {
    adminRef.current = albumAdmin(null) as never;

    const res = await loadMomenPhotosAction(SLUG, "x".repeat(500));

    expect(res).toEqual({ status: "error" });
  });
});

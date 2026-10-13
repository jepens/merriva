import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route unduhan ZIP: foto GALERI (baru, DECISIONS #70) dan Album MOMEN.
 *
 * Keduanya diuji bersama karena keduanya menjaga satu janji yang sama: email
 * peringatan pra-purge H-30/H-7 dan `/syarat` menyuruh pemilik mengunduh datanya
 * sebelum retensi menghapusnya. Route yang menolak di keadaan yang justru menuju
 * purge akan mengubah janji itu menjadi kebohongan.
 *
 * Yang paling berharga di berkas ini dua hal:
 *  1. keduanya SENGAJA tidak memeriksa status undangan maupun status album —
 *     undangan `expired` dan album `archived` adalah PELANGGAN YANG PALING BUTUH;
 *  2. `purged_at` adalah satu-satunya penolakan berbasis keadaan, dan jawabannya
 *     410, bukan 404: barisnya ada, isinya yang sudah tidak ada.
 */

const { auth, invRow, mediaRows, albumRow, photoRows } = vi.hoisted(() => ({
  auth: { user: { id: "u1" } as unknown },
  invRow: { data: null as unknown, error: null },
  mediaRows: { data: [] as unknown[], count: 0, error: null },
  albumRow: { data: null as unknown, error: null },
  photoRows: { data: [] as unknown[], error: null },
}));

/** Rantai PostgREST palsu: `from()` dijawab per tabel. */
function klien(mode: "rls" | "admin") {
  return {
    auth: {
      getUser: () => Promise.resolve({ data: { user: auth.user } }),
    },
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.order = () => chain;
      chain.maybeSingle = () =>
        Promise.resolve(table === "invitations" ? invRow : albumRow);
      // `media` & `momen_photos` dibaca sebagai list (tanpa maybeSingle).
      chain.then = (res: (v: unknown) => unknown) =>
        Promise.resolve(table === "media" ? mediaRows : photoRows).then(res);
      void mode;
      return chain;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => klien("rls"),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => klien("admin"),
}));
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({
    getPublicUrl: (p: string) => `https://cdn.uji.test/${p}`,
  }),
}));

/** `downloadZip` palsu: habiskan generator & catat nama berkasnya. */
const { terkumpul } = vi.hoisted(() => ({ terkumpul: [] as string[] }));
vi.mock("client-zip", () => ({
  downloadZip: (gen: AsyncIterable<{ name: string }>) => ({
    body: new ReadableStream({
      async start(ctrl) {
        for await (const f of gen) terkumpul.push(f.name);
        ctrl.close();
      },
    }),
  }),
}));

import { GET as galeriZip } from "@/app/(dashboard)/dashboard/undangan/[id]/galeri/zip/route";
import { GET as momenZip } from "@/app/(dashboard)/dashboard/undangan/[id]/momen/zip/route";

const ID = "44444444-4444-4444-8444-444444444444";
const req = () => new Request("https://merriva.id/x");
const p = (id = ID) => ({ params: Promise.resolve({ id }) });

/** Jalankan route lalu habiskan stream-nya supaya generator benar-benar jalan. */
async function jalankan(route: typeof galeriZip, id = ID): Promise<Response> {
  const res = await route(req(), p(id));
  if (res.body) await new Response(res.body).arrayBuffer();
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  terkumpul.length = 0;
  auth.user = { id: "u1" };
  invRow.data = { id: ID, slug: "andi-sinta", purged_at: null };
  mediaRows.data = [
    {
      storage_path: "inv/x/m1",
      sort_order: 0,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      storage_path: "inv/x/m2",
      sort_order: 1,
      created_at: "2026-01-02T00:00:00Z",
    },
  ];
  albumRow.data = { id: "alb1" };
  photoRows.data = [
    {
      guest_name: "Budi",
      storage_path: "momen/x/1.webp",
      created_at: "2026-01-01T00:00:00Z",
    },
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("bytes", { status: 200 })),
  );
});

describe("ZIP galeri — gerbang", () => {
  it("tanpa sesi → 401", async () => {
    auth.user = null;
    expect((await jalankan(galeriZip)).status).toBe(401);
  });

  it("id bukan UUID → 404 tanpa menyentuh DB", async () => {
    expect((await jalankan(galeriZip, "bukan-uuid")).status).toBe(404);
  });

  it("undangan orang lain → 404 (RLS mengosongkannya)", async () => {
    invRow.data = null;
    expect((await jalankan(galeriZip)).status).toBe(404);
  });

  it("belum ada foto → 404", async () => {
    mediaRows.data = [];
    expect((await jalankan(galeriZip)).status).toBe(404);
  });

  it("data sudah dipurge → 410 Gone, BUKAN 404", async () => {
    // Bedanya penting bagi pemilik yang bertanya: barisnya ada, isinya yang
    // sudah tidak ada. 404 akan terbaca "salah alamat".
    invRow.data = {
      id: ID,
      slug: "andi-sinta",
      purged_at: "2027-04-01T00:00:00Z",
    };
    expect((await jalankan(galeriZip)).status).toBe(410);
  });
});

describe("ZIP galeri — isi", () => {
  it("berhasil → zip + nama berkas memuat slug", async () => {
    const res = await jalankan(galeriZip);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
    expect(res.headers.get("Content-Disposition")).toContain(
      "foto-galeri-andi-sinta.zip",
    );
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("mengambil varian 1600px, bukan thumbnail 400px", async () => {
    // `media.storage_path` adalah PREFIX; mengunduh thumbnail akan memberi
    // pemilik berkas 400 px yang tak berguna untuk apa pun.
    await jalankan(galeriZip);
    const urls = (
      fetch as unknown as { mock: { calls: string[][] } }
    ).mock.calls.map((c) => c[0]);
    expect(urls).toEqual([
      "https://cdn.uji.test/inv/x/m1/1600.webp",
      "https://cdn.uji.test/inv/x/m2/1600.webp",
    ]);
  });

  it("nama di dalam ZIP berurutan dan ber-padding", async () => {
    await jalankan(galeriZip);
    expect(terkumpul).toEqual(["foto-001.webp", "foto-002.webp"]);
  });

  it("foto yang gagal diambil DILEWATI, ZIP tetap jadi", async () => {
    // Pemilik yang kehilangan satu foto jauh lebih baik daripada pemilik yang
    // tak bisa mengunduh apa pun menjelang purge.
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        n += 1;
        return n === 1
          ? new Response(null, { status: 500 })
          : new Response("bytes", { status: 200 });
      }),
    );
    const res = await jalankan(galeriZip);
    expect(res.status).toBe(200);
    expect(terkumpul).toEqual(["foto-002.webp"]);
  });

  it("fetch yang MELEMPAR juga dilewati, bukan menggagalkan route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("DNS mati");
      }),
    );
    expect((await jalankan(galeriZip)).status).toBe(200);
    expect(terkumpul).toEqual([]);
  });
});

describe("ZIP Album Momen — regresi album terarsip", () => {
  it("album ADA → 200, apa pun statusnya", async () => {
    // Inti perbaikannya (DECISIONS #70). Route ini dulu menolak apa pun selain
    // `status='active'`, sementara halaman Momen menawarkan tombol unduh begitu
    // `photo_count > 0`. Refund add-on mengarsipkan album, jadi pemilik melihat
    // tombol yang dijanjikan `archivedBody` lalu mendapat 404. Select-nya kini
    // tak lagi membaca `status` sama sekali.
    albumRow.data = { id: "alb1" };
    expect((await jalankan(momenZip)).status).toBe(200);
  });

  it("tak ada album sama sekali → 404", async () => {
    albumRow.data = null;
    expect((await jalankan(momenZip)).status).toBe(404);
  });

  it("data sudah dipurge → 410", async () => {
    invRow.data = {
      id: ID,
      slug: "andi-sinta",
      purged_at: "2027-04-01T00:00:00Z",
    };
    expect((await jalankan(momenZip)).status).toBe(410);
  });

  it("nama berkas memakai nama tamu yang dibersihkan", async () => {
    photoRows.data = [
      {
        guest_name: "Budi/../etc",
        storage_path: "momen/x/1.webp",
        created_at: "2026-01-01T00:00:00Z",
      },
    ];
    await jalankan(momenZip);
    expect(terkumpul[0]).not.toContain("/");
    expect(terkumpul[0]).toContain("Budi");
  });
});

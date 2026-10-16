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

// Parameter DIDEKLARASIKAN: `mock.calls[0][1]` di bawah tak lolos tsc bila
// `vi.fn()` dibiarkan tanpa tipe, sementara vitest tetap hijau.
const { reportHandledError } = vi.hoisted(() => ({
  reportHandledError:
    vi.fn<
      (err: unknown, area: string, extra?: Record<string, unknown>) => void
    >(),
}));
vi.mock("@/lib/observability", () => ({ reportHandledError }));

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
    // tak bisa mengunduh apa pun menjelang purge. Nomornya BERLUBANG, tidak
    // bergeser: `foto-002` tanpa `foto-001` memberi tahu pemilik ada yang
    // hilang; menggeser nomornya justru menyembunyikan itu darinya.
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

  it("yang hilang sebagian tetap DILAPORKAN, lengkap dengan hitungannya", async () => {
    // Tanpa ini, satu-satunya saksi atas objek yang dijatuhkan storage adalah
    // pemilik yang menghitung sendiri isi ZIP-nya.
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
    await jalankan(galeriZip);
    expect(reportHandledError).toHaveBeenCalledTimes(1);
    expect(reportHandledError.mock.calls[0][1]).toBe("zip.galeri");
    expect(reportHandledError.mock.calls[0][2]).toMatchObject({
      gagal: 1,
      total: 2,
    });
  });

  it("arsip yang utuh TIDAK melapor apa pun", async () => {
    // Alarm yang berbunyi di hari normal berhenti dibaca orang.
    await jalankan(galeriZip);
    expect(reportHandledError).not.toHaveBeenCalled();
  });
});

/**
 * PADAM TOTAL — kegagalan yang dulu paling tidak terlihat di repo ini.
 *
 * Route ini mengalirkan ZIP lewat generator, jadi status HTTP sudah terkirim
 * sebelum satu byte foto pun diambil; dan karena foto yang gagal memang sengaja
 * dilewati, storage yang mati total menghasilkan ZIP yang SAH, 200 OK, bernama
 * `foto-galeri-andi-sinta.zip`, dan kosong. Sebelum perbaikan ini ada test
 * hijau yang justru MENGESAHKAN perilaku itu — ia menegaskan 200 dengan nol
 * berkas dan menyebutnya "dilewati, bukan menggagalkan route".
 *
 * Yang membuatnya berbahaya bukan kode-nya, melainkan konteksnya: email
 * peringatan pra-purge H-30/H-7 dan `/syarat` menyuruh pemilik mengunduh
 * datanya SEBELUM retensi menghapusnya. Arsip kosong yang terlihat berhasil,
 * tepat di jalur penyelamatan terakhir itu, terbaca oleh pemilik sebagai
 * "berarti foto saya memang sudah hilang" — dan kami tak pernah tahu.
 */
describe("ZIP — padam total dibedakan dari gagal sebagian", () => {
  const padamkan = () =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("DNS mati");
      }),
    );

  it("galeri: semua foto gagal → 503, BUKAN zip kosong 200", async () => {
    padamkan();
    const res = await jalankan(galeriZip);
    expect(res.status).toBe(503);
    expect(terkumpul).toEqual([]);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
  });

  it("badan 503 menjelaskan bahwa fotonya MASIH ADA", async () => {
    // Pemilik membacanya di tab peramban karena unduhannya gagal. Kalimat yang
    // hanya berbunyi "gagal" akan dibaca sebagai "datanya tidak ada".
    padamkan();
    // Route dipanggil langsung: `jalankan` menghabiskan body-nya untuk
    // memaksa generator berjalan, dan body yang sudah terpakai tak bisa
    // dibaca ulang.
    const teks = await (await galeriZip(req(), p())).text();
    expect(teks).toContain("masih tersimpan");
    expect(teks).toContain("halo@merriva.id");
  });

  it("padam total dilaporkan ke Sentry dengan jumlah yang dicoba", async () => {
    padamkan();
    await jalankan(galeriZip);
    expect(reportHandledError).toHaveBeenCalledTimes(1);
    expect(reportHandledError.mock.calls[0][1]).toBe("zip.galeri");
    expect(reportHandledError.mock.calls[0][2]).toMatchObject({ dicoba: 2 });
  });

  it("respons 500 yang rapi pun dihitung padam, bukan hanya lemparan", async () => {
    // Token R2 read-only menjawab 403 dengan sopan — tak ada yang dilempar.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 403 })),
    );
    expect((await jalankan(galeriZip)).status).toBe(503);
  });

  it("momen: album berisi yang gagal total → 503", async () => {
    padamkan();
    const res = await jalankan(momenZip);
    expect(res.status).toBe(503);
    expect(reportHandledError.mock.calls[0][1]).toBe("zip.momen");
  });

  it("momen: album KOSONG tetap 200 — itu bukan padam, itu memang isinya", async () => {
    // Album yang seluruh fotonya dimoderasi keluar menghasilkan ZIP kosong yang
    // sah. Menjawabnya 503 akan menukar satu kebohongan dengan kebohongan lain.
    photoRows.data = [];
    padamkan();
    expect((await jalankan(momenZip)).status).toBe(200);
    expect(reportHandledError).not.toHaveBeenCalled();
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

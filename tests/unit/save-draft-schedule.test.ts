import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regresi DECISIONS #42 pada aksi ASLI `saveInvitationDraftAction`: sesi jadwal
 * yang jam mulainya belum lengkap dulu DIBUANG sebelum RPC sementara aksi
 * membalas "success" — setelah muat ulang sesi itu hilang beserta gedung,
 * alamat, dan peta. Yang diperiksa di sini adalah isi RPC yang benar-benar
 * dikirim ke database.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { refs } = vi.hoisted(() => ({
  refs: { server: null as unknown, rpc: [] as { fn: string; args: unknown }[] },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => Promise.resolve(refs.server),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({}),
}));

import { DEFAULT_SETTINGS, emptyContent } from "@/lib/validation/content";
import { saveInvitationDraftAction } from "@/server/actions/invitation";

const INV = "44444444-4444-4444-8444-444444444444";

function fakeServer() {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.update = () => chain;
  chain.maybeSingle = () =>
    Promise.resolve({
      data: { settings: {}, slug: "andi-sinta" },
      error: null,
    });
  return {
    auth: { getUser: async () => ({ data: { user: { id: "u-1" } } }) },
    from: () => chain,
    rpc: async (fn: string, args: unknown) => {
      refs.rpc.push({ fn, args });
      return { error: null };
    },
  };
}

beforeEach(() => {
  refs.rpc = [];
  refs.server = fakeServer();
});

const EMPTY = {
  name: "",
  startAt: "",
  endAt: "",
  venueName: "",
  address: "",
  mapsUrl: "",
};

async function simpan(
  events: Record<string, string>[],
  settings: Record<string, unknown> = DEFAULT_SETTINGS, // Asia/Jakarta (WIB)
) {
  const res = await saveInvitationDraftAction(INV, {
    content: emptyContent("wedding"),
    settings,
    eventDate: "",
    events: events.map((e) => ({ ...EMPTY, ...e })),
  });
  const call = refs.rpc.find((c) => c.fn === "replace_invitation_events");
  const rows =
    (call?.args as { events: Record<string, unknown>[] } | undefined)?.events ??
    [];
  return { res, rows };
}

describe("sesi jadwal tanpa jam mulai ikut tersimpan", () => {
  it("sesi berisi tanpa jam dikirim ke DB (start_at null) beserta isiannya, urutan terjaga", async () => {
    const { res, rows } = await simpan([
      {
        name: "Resepsi",
        venueName: "Gedung Mawar",
        address: "Jl. Melati 1",
        mapsUrl: "https://maps.app/x",
      },
      { name: "Akad", startAt: "2026-08-15T08:00" },
    ]);
    expect(res.status).toBe("success");
    expect(rows).toEqual([
      {
        id: null,
        name: "Resepsi",
        start_at: null,
        end_at: null,
        venue_name: "Gedung Mawar",
        address: "Jl. Melati 1",
        maps_url: "https://maps.app/x",
        sort_order: 0,
      },
      {
        id: null,
        name: "Akad",
        start_at: "2026-08-15T01:00:00.000Z",
        end_at: null,
        venue_name: "",
        address: "",
        maps_url: "",
        sort_order: 1,
      },
    ]);
  });

  it.each(["2026-02-30T10:00", "0001-01-01T05:00", "besok pagi", "2026-08-15"])(
    "jam tak sah %j → start_at null, simpanan TETAP sukses (tak digeser, tak menggagalkan autosave)",
    async (startAt) => {
      const { res, rows } = await simpan([
        { name: "Akad", startAt, venueName: "Masjid" },
      ]);
      expect(res.status).toBe("success");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        name: "Akad",
        start_at: null,
        venue_name: "Masjid",
      });
    },
  );

  it("jam selesai tak sah → end_at null, jam mulai tetap tersimpan", async () => {
    const { rows } = await simpan([
      { name: "Akad", startAt: "2026-08-15T08:00", endAt: "2026-02-30T10:00" },
    ]);
    expect(rows[0]).toMatchObject({
      start_at: "2026-08-15T01:00:00.000Z",
      end_at: null,
    });
  });

  it.each<Record<string, string>>([
    { name: "Resepsi" },
    { startAt: "2026-08-15T08:00" },
    { mapsUrl: "https://maps.app/x" },
  ])("kartu berisi satu isian saja (%j) TETAP disimpan", async (isi) => {
    const { rows } = await simpan([isi]);
    expect(rows).toHaveLength(1);
  });

  it("jam dikonversi memakai zona undangan (WIT), bukan WIB tetap", async () => {
    const { rows } = await simpan(
      [{ name: "Akad", startAt: "2026-08-15T08:00" }],
      {
        ...DEFAULT_SETTINGS,
        timezone: "Asia/Jayapura",
      },
    );
    expect(rows[0]).toMatchObject({ start_at: "2026-08-14T23:00:00.000Z" });
  });

  it("kartu kosong total TIDAK disimpan, dan sort_order tetap indeks form", async () => {
    const { rows } = await simpan([
      {},
      { name: "Akad", startAt: "2026-08-15T08:00" },
      {},
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Akad", sort_order: 1 });
  });
});

describe("id sesi stabil lintas simpan (DECISIONS #43)", () => {
  const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  it("id tiap sesi dikirim ke RPC apa adanya → baris yang sama diperbarui, bukan diganti", async () => {
    const { res, rows } = await simpan([
      { id: A, name: "Akad", startAt: "2026-08-15T08:00" },
      { id: B, name: "Resepsi" },
    ]);
    expect(res.status).toBe("success");
    expect(rows.map((r) => r.id)).toEqual([A, B]);
  });

  it("simpanan ULANG dengan isi sama mengirim id yang sama (idempoten)", async () => {
    const isi = [{ id: A, name: "Akad", startAt: "2026-08-15T08:00" }];
    const pertama = (await simpan(isi)).rows;
    refs.rpc = [];
    const kedua = (await simpan(isi)).rows;
    expect(kedua).toEqual(pertama);
  });

  it("id huruf besar dinormalkan ke huruf kecil", async () => {
    const { rows } = await simpan([{ id: A.toUpperCase(), name: "Akad" }]);
    expect(rows[0].id).toBe(A);
  });

  it.each(["bukan-uuid", "' or 1=1 --", "aaaaaaaa-aaaa-4aaa-8aaa"])(
    "id tak berbentuk UUID (%j) dibuang → sesi baru, simpanan TETAP sukses",
    async (id) => {
      const { res, rows } = await simpan([{ id, name: "Akad" }]);
      expect(res.status).toBe("success");
      expect(rows).toEqual([
        expect.objectContaining({ id: null, name: "Akad" }),
      ]);
    },
  );

  it("id GANDA: kemunculan pertama memegang id, berikutnya menjadi sesi baru (upsert tak macet)", async () => {
    const { res, rows } = await simpan([
      { id: A, name: "Akad" },
      { id: A.toUpperCase(), name: "Resepsi" },
      { id: A, name: "Ngunduh" },
    ]);
    expect(res.status).toBe("success");
    expect(rows.map((r) => [r.name, r.id])).toEqual([
      ["Akad", A],
      ["Resepsi", null],
      ["Ngunduh", null],
    ]);
  });

  it("kartu kosong ber-id tetap TIDAK disimpan, dan tak memakan id sesi lain", async () => {
    const { rows } = await simpan([{ id: A }, { id: A, name: "Akad" }]);
    expect(rows).toEqual([
      expect.objectContaining({ id: A, name: "Akad", sort_order: 1 }),
    ]);
  });
});

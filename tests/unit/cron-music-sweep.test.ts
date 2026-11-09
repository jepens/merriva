import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sapuMusikUsang } from "@/server/cron/music-sweep";
import type { Database } from "@/types/database";

/**
 * Penyapu musik unggahan usang (DECISIONS #121). Yang dijaga dua arah:
 * objek yang tak dirujuk siapa pun tak boleh tersaji publik selamanya, dan
 * lagu yang SEDANG dipakai undangan tak boleh pernah terhapus olehnya.
 *
 * Saringan "tak lagi dirujuk" hidup di RPC `music_uploads_usang` dan diuji
 * pgTAP (`supabase/tests/database/musik_unggahan.test.sql`) — termasuk
 * undangan purged, `customMusic` berbentuk aneh, dan batas baris. RPC tiruan
 * di sini mencerminkan kontraknya, dan argumen yang DIOPER (`p_sebelum`,
 * `p_batas`) benar-benar diterapkan — jadi "< 24 jam tak disentuh" dan "maks.
 * 200 per jalankan" diuji sebagai perilaku, bukan sebagai argumen yang
 * kebetulan cocok.
 */

const NOW = new Date("2026-11-09T12:00:00.000Z");
const JAM = 3_600_000;
const iso = (msLalu: number) => new Date(NOW.getTime() - msLalu).toISOString();

type Baris = {
  id: string;
  path: string;
  invitation_id: string;
  created_at: string;
  removed_at: string | null;
  removed_reason: string | null;
};

type ArgsRpc = { p_sebelum: string; p_batas: number };

const db = vi.hoisted(() => ({
  rows: [] as {
    id: string;
    path: string;
    invitation_id: string;
    created_at: string;
    removed_at: string | null;
    removed_reason: string | null;
  }[],
  /** invitation_id → content.customMusic.path (null = tak ada). */
  rujukan: new Map<string, string | null>(),
  /** Undangan yang sudah di-purge. */
  purged: new Set<string>(),
  rpcCalls: [] as [string, { p_sebelum: string; p_batas: number }][],
  /** Tabel yang dibuka lewat `from()` — penyapu hanya boleh MENANDAI. */
  froms: [] as string[],
  rpcError: null as { message: string } | null,
  updateError: null as { message: string } | null,
}));

function fakeAdmin() {
  return {
    rpc(fn: string, args: ArgsRpc) {
      db.rpcCalls.push([fn, args]);
      if (db.rpcError)
        return Promise.resolve({ data: null, error: db.rpcError });
      const data = db.rows
        .filter(
          (r) =>
            r.removed_at === null &&
            r.created_at < args.p_sebelum &&
            (db.purged.has(r.invitation_id) ||
              db.rujukan.get(r.invitation_id) !== r.path),
        )
        .sort(
          (a, b) =>
            a.created_at.localeCompare(b.created_at) ||
            a.id.localeCompare(b.id),
        )
        .slice(0, Math.max(args.p_batas, 0))
        .map((r) => ({ id: r.id, path: r.path }));
      return Promise.resolve({ data, error: null });
    },
    from(table: string) {
      db.froms.push(table);
      return {
        update(patch: Partial<Baris>) {
          // Thenable: patch diterapkan saat di-`await`, dengan SEMUA saringan
          // yang dirantai — pagar yang dibuang benar-benar berdampak.
          const saring: ((r: Baris) => boolean)[] = [];
          const q = {
            eq(col: keyof Baris, v: string) {
              saring.push((r) => r[col] === v);
              return q;
            },
            is(col: keyof Baris, v: null) {
              saring.push((r) => r[col] === v);
              return q;
            },
            then(
              res: (v: { error: unknown }) => unknown,
              rej?: (e: unknown) => unknown,
            ) {
              if (!db.updateError)
                for (const r of db.rows)
                  if (saring.every((f) => f(r))) Object.assign(r, patch);
              return Promise.resolve({ error: db.updateError }).then(res, rej);
            },
          };
          return q;
        },
      };
    },
  } as unknown as SupabaseClient<Database>;
}

const storage = {
  delete: vi.fn<(path: string) => Promise<void>>(),
};

const INV_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const INV_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const uuid = (n: number) =>
  `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const pathOf = (inv: string, n: number) => `audio/${inv}/${uuid(n)}.mp3`;

function baris(inv: string, n: number, umurMs: number): Baris {
  return {
    id: uuid(n),
    path: pathOf(inv, n),
    invitation_id: inv,
    created_at: iso(umurMs),
    removed_at: null,
    removed_reason: null,
  };
}

beforeEach(() => {
  db.rows = [];
  db.rujukan = new Map();
  db.purged = new Set();
  db.rpcCalls = [];
  db.froms = [];
  db.rpcError = null;
  db.updateError = null;
  storage.delete.mockReset();
  storage.delete.mockResolvedValue(undefined);
});

const sapu = () => sapuMusikUsang(fakeAdmin(), storage, NOW);

describe("sapuMusikUsang", () => {
  it("kandidat diambil SEKALI dari RPC: cutoff tepat 24 jam, batas 200 + 1", async () => {
    await sapu();

    expect(db.rpcCalls).toEqual([
      ["music_uploads_usang", { p_sebelum: iso(24 * JAM), p_batas: 201 }],
    ]);
    // Tanpa pemindaian tabel di aplikasi: tak ada kandidat → tak ada `from()`.
    expect(db.froms).toEqual([]);
  });

  it("path yang SEDANG dirujuk content tidak disentuh", async () => {
    db.rows = [baris(INV_A, 1, 72 * JAM)];
    db.rujukan.set(INV_A, pathOf(INV_A, 1));

    const hasil = await sapu();

    expect(storage.delete).not.toHaveBeenCalled();
    expect(db.rows[0]!.removed_at).toBeNull();
    expect(hasil).toEqual({
      scanned: 0,
      swept: 0,
      failed: 0,
      truncated: false,
    });
  });

  it("objek usang (> 24 jam, tak dirujuk) dihapus lalu ditandai `replaced`", async () => {
    db.rows = [
      baris(INV_A, 1, 72 * JAM), // diganti lagu 2
      baris(INV_A, 2, 48 * JAM), // dirujuk
      baris(INV_B, 3, 30 * JAM), // diunggah, tak pernah tersimpan
    ];
    db.rujukan.set(INV_A, pathOf(INV_A, 2));
    db.rujukan.set(INV_B, null);

    const hasil = await sapu();

    expect(storage.delete.mock.calls.map((c) => c[0])).toEqual([
      pathOf(INV_A, 1),
      pathOf(INV_B, 3),
    ]);
    const [satu, dua, tiga] = db.rows;
    expect(satu).toMatchObject({
      removed_at: NOW.toISOString(),
      removed_reason: "replaced",
    });
    expect(tiga).toMatchObject({ removed_reason: "replaced" });
    expect(dua).toMatchObject({ removed_at: null, removed_reason: null });
    expect(hasil).toEqual({
      scanned: 2,
      swept: 2,
      failed: 0,
      truncated: false,
    });
  });

  it("undangan purged: objeknya disapu walau content masih merujuknya", async () => {
    // Baris yang tercatat SESUDAH purge menandai baris hidup (TOCTOU unggah
    // vs purge) — tak ada jalur lain yang akan menemukannya lagi.
    db.rows = [baris(INV_A, 1, 30 * JAM)];
    db.rujukan.set(INV_A, pathOf(INV_A, 1));
    db.purged.add(INV_A);

    const hasil = await sapu();

    expect(storage.delete).toHaveBeenCalledWith(pathOf(INV_A, 1));
    expect(db.rows[0]!.removed_reason).toBe("replaced");
    expect(hasil).toMatchObject({ scanned: 1, swept: 1 });
  });

  it("unggahan < 24 jam tidak disentuh walau belum dirujuk", async () => {
    // Autosave editor menyimpan rujukannya SESUDAH route unggah menjawab.
    db.rows = [baris(INV_A, 1, 23 * JAM)];
    db.rujukan.set(INV_A, null);

    const hasil = await sapu();

    expect(storage.delete).not.toHaveBeenCalled();
    expect(db.rows[0]!.removed_at).toBeNull();
    expect(hasil.scanned).toBe(0);
  });

  it("hapus objek gagal → baris TIDAK ditandai (dicoba lagi nanti)", async () => {
    db.rows = [baris(INV_A, 1, 72 * JAM)];
    storage.delete.mockRejectedValue(new Error("403 AccessDenied"));

    const hasil = await sapu();

    expect(db.rows[0]!.removed_at).toBeNull();
    expect(db.froms).toEqual([]);
    expect(hasil).toMatchObject({ scanned: 1, swept: 0, failed: 1 });
  });

  it("penandaan gagal → dihitung gagal, bukan tersapu", async () => {
    db.rows = [baris(INV_A, 1, 72 * JAM)];
    db.updateError = { message: "kedip" };

    const hasil = await sapu();

    expect(storage.delete).toHaveBeenCalledTimes(1);
    expect(hasil).toMatchObject({ swept: 0, failed: 1 });
  });

  it("takedown yang menandai di sela RPC dan penandaan tak ditimpa `replaced`", async () => {
    db.rows = [baris(INV_A, 1, 72 * JAM)];
    // Admin men-takedown tepat saat objeknya sedang dihapus penyapu.
    storage.delete.mockImplementation(async () => {
      Object.assign(db.rows[0]!, {
        removed_at: iso(JAM),
        removed_reason: "takedown",
      });
    });

    await sapu();

    expect(db.rows[0]).toMatchObject({
      removed_at: iso(JAM),
      removed_reason: "takedown",
    });
  });

  it("baris yang sudah ditandai purge/takedown tak dibaca ulang", async () => {
    db.rows = [
      {
        ...baris(INV_A, 1, 72 * JAM),
        removed_at: iso(JAM),
        removed_reason: "takedown",
      },
    ];

    await sapu();

    expect(storage.delete).not.toHaveBeenCalled();
    expect(db.rows[0]!.removed_reason).toBe("takedown");
  });

  it("maks. 200 objek per jalankan; kandidat ke-201 menandai `truncated`", async () => {
    for (let n = 1; n <= 205; n++) db.rows.push(baris(INV_A, n, 48 * JAM + n));

    const hasil = await sapu();

    expect(storage.delete).toHaveBeenCalledTimes(200);
    expect(hasil).toEqual({
      scanned: 201,
      swept: 200,
      failed: 0,
      truncated: true,
    });
    // Yang TERTUA dulu (urutan RPC), sisanya untuk jalankan berikutnya.
    expect(db.rows.filter((r) => r.removed_at === null)).toHaveLength(5);
  });

  it("tepat 200 kandidat → semua tersapu, TIDAK `truncated`", async () => {
    for (let n = 1; n <= 200; n++) db.rows.push(baris(INV_A, n, 48 * JAM + n));

    const hasil = await sapu();

    expect(hasil).toEqual({
      scanned: 200,
      swept: 200,
      failed: 0,
      truncated: false,
    });
  });

  it("galat RPC DILEMPAR (pemanggil yang melapor)", async () => {
    db.rows = [baris(INV_A, 1, 72 * JAM)];
    db.rpcError = { message: "kedip" };
    await expect(sapu()).rejects.toThrow(/music_uploads_usang/);
    expect(storage.delete).not.toHaveBeenCalled();
  });
});

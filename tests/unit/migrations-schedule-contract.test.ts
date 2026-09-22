import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Kontrak migrasi jadwal (DECISIONS #42, #43), diperiksa statis: kode aplikasi
 * mengandalkan DB yang MENERIMA sesi tanpa jam. Bila definisi RPC terakhir
 * kembali menyaring `start_at` (atau kolomnya kembali NOT NULL), sesi draft
 * kembali dibuang diam-diam walau semua test aplikasi hijau.
 */

const DIR = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();
// Komentar SQL dibuang: yang dinilai kode yang dijalankan, bukan catatan
// (komentar migrasi sengaja menyebut perilaku lama & langkah rollback).
const sql = (f: string) =>
  readFileSync(join(DIR, f), "utf8").replace(/--.*$/gm, "");

const rpcFiles = files.filter((f) =>
  /function\s+public\.replace_invitation_events/i.test(sql(f)),
);
const latestRpc = sql(rpcFiles.at(-1)!).toLowerCase();

describe("migrasi jadwal", () => {
  it("kolom start_at dilonggarkan dan tak pernah dikembalikan NOT NULL sesudahnya", () => {
    const drop = files.findIndex((f) =>
      /alter\s+column\s+start_at\s+drop\s+not\s+null/i.test(sql(f)),
    );
    expect(drop).toBeGreaterThanOrEqual(0);
    const setAgain = files.findIndex(
      (f, i) =>
        i > drop &&
        /^\s*alter\s+table[^;]*invitation_events[^;]*alter\s+column\s+start_at\s+set\s+not\s+null/im.test(
          sql(f),
        ),
    );
    expect(setAgain).toBe(-1);
  });

  it("definisi RPC terakhir menyimpan sesi tanpa jam (tanpa saringan start_at)", () => {
    expect(latestRpc).not.toMatch(/where\s+nullif\(e->>'start_at'/);
    expect(latestRpc).toContain("nullif(e->>'start_at', '')::timestamptz");
    // Nama kosong tak lagi diganti diam-diam menjadi 'Acara'.
    expect(latestRpc).not.toContain("'acara'");
  });

  describe("id sesi stabil (DECISIONS #43)", () => {
    // Satu pernyataan SQL utuh (sampai `;`) yang diawali pola tertentu.
    const statement = (start: RegExp) => {
      const m = start.exec(latestRpc);
      return m ? latestRpc.slice(m.index, latestRpc.indexOf(";", m.index)) : "";
    };
    const del = statement(/delete\s+from\s+public\.invitation_events/);
    const ins = statement(/insert\s+into\s+public\.invitation_events/);
    const setClause = ins.slice(
      ins.search(/do\s+update\s+set/),
      ins.lastIndexOf(" where "),
    );

    const squash = (s: string) => s.replace(/\s+/g, " ").trim();

    it("DELETE hanya membuang sesi undangan ini yang TIDAK dikirim lagi (bukan hapus-semua)", () => {
      // Predikat dikunci UTUH, bukan potongan: `and`→`or` (admin menghapus
      // SELURUH tabel) atau saringan null yang dibuang (satu id null membuat
      // `<> all` bernilai NULL → tak ada yang terhapus) sama-sama lolos bila
      // yang dicek hanya kemunculan potongan. Perilakunya diuji di DB oleh
      // supabase/tests/database/replace_invitation_events.test.sql.
      expect(squash(del)).toBe(
        "delete from public.invitation_events as ev where ev.invitation_id = inv_id and ev.id <> all (array( select (e->>'id')::uuid from jsonb_array_elements(items) as e where nullif(e->>'id', '') is not null ))",
      );
    });

    it("simpanan per undangan diserialkan SEBELUM DELETE (dua tab bersilang tak deadlock)", () => {
      const lock = latestRpc.indexOf("pg_advisory_xact_lock(");
      expect(lock).toBeGreaterThan(-1);
      expect(lock).toBeLessThan(latestRpc.indexOf(del));
      expect(squash(latestRpc)).toContain(
        "perform pg_advisory_xact_lock(hashtextextended('replace_invitation_events:' || inv_id::text, 0));",
      );
    });

    it("sesi yang masih ada DIPERBARUI di tempat memakai id kiriman", () => {
      expect(ins).toMatch(/\(\s*id\s*,\s*invitation_id\s*,/);
      expect(ins).toContain(
        "coalesce(nullif(e->>'id', '')::uuid, gen_random_uuid())",
      );
      expect(ins).toMatch(/on\s+conflict\s*\(\s*id\s*\)\s+do\s+update\s+set/);
      for (const col of [
        "name",
        "start_at",
        "end_at",
        "venue_name",
        "address",
        "maps_url",
        "sort_order",
      ]) {
        expect(setClause).toMatch(
          new RegExp(String.raw`${col}\s*=\s*excluded\.${col}`),
        );
      }
    });

    it("id milik undangan LAIN tak pernah disentuh: invitation_id tak di-SET dan konflik dijaga WHERE", () => {
      expect(setClause).not.toMatch(/invitation_id\s*=/);
      expect(ins).toMatch(
        /where\s+ev\.invitation_id\s*=\s*excluded\.invitation_id\s*$/,
      );
    });
  });

  it("RPC tetap SECURITY INVOKER (RLS berlaku) dan tak bisa dieksekusi publik", () => {
    expect(latestRpc).toContain("security invoker");
    expect(latestRpc).not.toContain("security definer");
    expect(latestRpc).toMatch(
      /revoke\s+execute\s+on\s+function\s+public\.replace_invitation_events[^;]*from\s+public/,
    );
  });
});

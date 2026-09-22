import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Kontrak migrasi jadwal (DECISIONS #42), diperiksa statis: kode aplikasi
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

  it("RPC tetap SECURITY INVOKER (RLS berlaku) dan tak bisa dieksekusi publik", () => {
    expect(latestRpc).toContain("security invoker");
    expect(latestRpc).not.toContain("security definer");
    expect(latestRpc).toMatch(
      /revoke\s+execute\s+on\s+function\s+public\.replace_invitation_events[^;]*from\s+public/,
    );
  });
});

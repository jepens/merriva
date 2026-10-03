import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `plan(N)` di setiap berkas pgTAP harus sama dengan jumlah assertion-nya.
 *
 * KENAPA TEST INI ADA: pgTAP memperlakukan jumlah yang tak cocok sebagai
 * **kegagalan**, bukan peringatan — "Bad plan. You planned 20 tests but ran 21"
 * memerahkan seluruh job meskipun ke-21 assertion-nya LULUS. Dan job `db` adalah
 * satu-satunya bagian CI yang tak bisa dijalankan dari mesin ini (butuh
 * `supabase start`), jadi salah hitung baru terlihat setelah push — satu putaran
 * CI terbuang untuk satu angka. Itu persis yang terjadi pada `order_upgrade`.
 *
 * Yang dihitung hanyalah bentuk `select <assertion>(` di awal pernyataan, sesuai
 * gaya seluruh berkas di folder ini. Bila kelak ada helper pgTAP lain dipakai,
 * tambahkan namanya di `ASSERTIONS` — test ini akan memerah lebih dulu dan
 * memberi tahu, bukan diam.
 */

const DIR = join(process.cwd(), "supabase", "tests", "database");

/** Fungsi pgTAP yang MENGHASILKAN satu baris hasil uji. */
const ASSERTIONS = [
  "is",
  "isnt",
  "ok",
  "lives_ok",
  "throws_ok",
  "results_eq",
  "set_eq",
  "row_eq",
  "matches",
];

const files = readdirSync(DIR).filter((f) => f.endsWith(".test.sql"));

function hitungAssertion(sql: string): number {
  const pola = new RegExp(`select\\s+(${ASSERTIONS.join("|")})\\s*\\(`, "g");
  return [...sql.matchAll(pola)].length;
}

describe("berkas uji pgTAP", () => {
  it("ada dan ditemukan (folder yang salah = test yang tak menguji apa pun)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s — plan() cocok dengan jumlah assertion", (file) => {
    const sql = readFileSync(join(DIR, file), "utf8");
    const plan = /select\s+plan\((\d+)\)/.exec(sql);
    expect(plan, `${file} tidak memanggil plan()`).not.toBeNull();
    expect(Number(plan?.[1])).toBe(hitungAssertion(sql));
  });

  it.each(files)("%s — ditutup finish() + rollback", (file) => {
    const sql = readFileSync(join(DIR, file), "utf8");
    // Tanpa `rollback`, fixture uji tertinggal di DB lokal pengembang dan uji
    // berikutnya bentrok pada slug/kode order yang unik.
    expect(sql).toMatch(/select\s+\*\s+from\s+finish\(\)/);
    expect(sql.trimEnd().endsWith("rollback;")).toBe(true);
  });
});

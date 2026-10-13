import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Modul `.mjs` polos — sengaja JS, bukan TS, supaya `node scripts/check-env.mjs`
// bisa dijalankan langsung tanpa build step. Tipe entrinya dideklarasikan di
// bawah; `tsc` menyelesaikan impornya sendiri lewat `allowJs`.
import {
  BAWAAN_RUNTIME,
  MANIFEST,
  envDipakaiKode,
} from "@/../scripts/env-manifest.mjs";

/**
 * Manifest env (`scripts/env-manifest.mjs`) harus tetap sejalan dengan
 * `process.env.X` yang BENAR-BENAR dibaca kode.
 *
 * KENAPA TEST INI ADA: variabel yang tak terdaftar adalah variabel yang akan
 * TERLEWAT saat mengisi panel produksi — dan di produk ini kelewatan seperti itu
 * nyaris selalu SENYAP (`NEXT_PUBLIC_APP_URL` kosong tak menimbulkan galat apa
 * pun tetapi mematikan lima fitur). `pnpm env:check` hanya berguna selama
 * daftarnya lengkap, dan setiap daftar manual di repo ini sudah pernah
 * membusuk: `reminder_sent_at` hilang dua kali (DECISIONS #65),
 * `MOMEN_SESSION_SECRET` tak pernah masuk lampiran checklist (#69).
 *
 * Jadi yang dijaga di sini bukan kodenya, melainkan DAFTARNYA — dan CI yang
 * menjaganya, bukan ingatan siapa pun.
 */

interface Entri {
  key: string;
  kapan: string;
  buildArg?: boolean;
  rahasia?: boolean;
  gen?: string;
  rusak?: string;
}

const manifest = MANIFEST as Entri[];
const dipakai: Set<string> = envDipakaiKode({
  readFileSync,
  readdirSync,
  statSync,
  join,
});

describe("manifest env sejalan dengan kode", () => {
  it("tak ada variabel yang dibaca kode tetapi belum didaftarkan", () => {
    const didaftar = new Set(manifest.map((m) => m.key));
    const liar = [...dipakai].filter(
      (k) => !didaftar.has(k) && !(BAWAAN_RUNTIME as Set<string>).has(k),
    );
    expect(liar).toEqual([]);
  });

  it("tak ada entri yatim — didaftarkan tetapi tak dibaca kode mana pun", () => {
    // Entri yatim membuat pemilik mengisi variabel yang tak berguna, dan lebih
    // buruk: membuatnya percaya daftar ini akurat.
    const yatim = manifest.filter((m) => !dipakai.has(m.key)).map((m) => m.key);
    expect(yatim).toEqual([]);
  });
});

describe("bentuk entri", () => {
  it("setiap kunci unik", () => {
    const keys = manifest.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("`kapan` hanya memakai nilai yang dikenali validator", () => {
    const sah = new Set(["always", "prod", "opsional", "r2", "tooling"]);
    for (const m of manifest) expect(sah.has(m.kapan)).toBe(true);
  });

  it("setiap variabel WAJIB menjelaskan akibat kosongnya", () => {
    // Tanpa `rusak`, keluaran `pnpm env:check` hanya menyebut nama — dan nama
    // saja tak memberi tahu pemilik mana yang mematikan produk dan mana yang
    // kosmetik.
    for (const m of manifest) {
      if (m.kapan === "always" || m.kapan === "prod") {
        expect(m.rusak, `${m.key} tanpa penjelasan`).toBeTruthy();
      }
    }
  });

  it("semua yang ditandai buildArg memang NEXT_PUBLIC_*", () => {
    // Build-arg relevan HANYA karena Next meng-inline NEXT_PUBLIC_* saat build.
    // Menandai variabel server sebagai build-arg akan menyesatkan ke arah yang
    // berbahaya: rahasia server tak boleh masuk bundel klien.
    for (const m of manifest) {
      if (m.buildArg) expect(m.key.startsWith("NEXT_PUBLIC_")).toBe(true);
    }
  });

  it("tak ada variabel RAHASIA yang ber-prefix NEXT_PUBLIC_", () => {
    // Pengaman paling keras di berkas ini: NEXT_PUBLIC_* masuk ke bundel yang
    // diunduh setiap tamu.
    for (const m of manifest) {
      if (m.rahasia) expect(m.key.startsWith("NEXT_PUBLIC_")).toBe(false);
    }
  });

  it("keenam build-arg cocok dengan ARG di Dockerfile", () => {
    // Bila Dockerfile menambah/membuang ARG tanpa manifest ikut berubah,
    // pemilik akan diberi tahu daftar build-arg yang salah — dan gejalanya
    // adalah aplikasi tayang dengan nilai kosong ter-inline.
    const dockerfile = readFileSync("Dockerfile", "utf8");
    const argDocker = [
      ...dockerfile.matchAll(/^ARG\s+(NEXT_PUBLIC_[A-Z0-9_]+)/gm),
    ].map((m) => m[1]);
    const argManifest = manifest.filter((m) => m.buildArg).map((m) => m.key);
    expect([...argManifest].sort()).toEqual([...argDocker].sort());
  });
});

describe("daftar induk `.env.example` memuat semua variabel", () => {
  const contoh = readFileSync(".env.example", "utf8");

  it("setiap variabel runtime ada di .env.example", () => {
    // `.env.example` adalah berkas yang disalin pemilik. Variabel yang tak ada
    // di sana tak akan pernah terisi, berapa pun bagusnya validatornya.
    const hilang = manifest
      .filter((m) => m.kapan !== "tooling")
      .filter((m) => !new RegExp(`^#?\\s*${m.key}=`, "m").test(contoh))
      .map((m) => m.key);
    expect(hilang).toEqual([]);
  });

  it("menandai build-arg dengan penanda yang sama di seluruh dokumen", () => {
    // 🏗️ dipakai di .env.example, LAUNCH-CHECKLIST, dan DEPLOYMENT — satu
    // penanda, supaya pemilik tak perlu mengingat tiga konvensi.
    expect(contoh).toContain("🏗️");
  });
});

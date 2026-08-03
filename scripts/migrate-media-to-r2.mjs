// @ts-nocheck
/**
 * Migrasi media Supabase Storage → Cloudflare R2 (SPEC §6.4 / DECISIONS #6).
 * Skrip OPS author-time — BUKAN runtime app. Idempoten & bisa dilanjut (resume):
 * objek yang sudah ada di R2 dilewati via HEAD.
 *
 *   node scripts/migrate-media-to-r2.mjs [--dry-run] [--force] [--limit=N]
 *   pnpm migrate:media -- --dry-run
 *
 * Env (dari .env.local lalu .env):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY        (sumber)
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET  (tujuan)
 *
 * Kontrak path (lib/media.ts): storage_path = prefix `inv/{invId}/{mediaId}`;
 * dua varian di dalamnya (`1600.webp` display, `400.webp` thumb). DB menyimpan
 * path relatif (vendor-agnostik) → migrasi TIDAK menyentuh DB. Urutan cutover:
 *   1) jalankan migrasi (idempoten) sampai 0 gagal,
 *   2) set NEXT_PUBLIC_MEDIA_URL=https://cdn.merriva.id + STORAGE_DRIVER=r2,
 *   3) verifikasi beberapa URL publik, baru hapus objek Supabase (opsional).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Muat KEY=VALUE dari .env.local lalu .env (tanpa menimpa env yang sudah ada). */
function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = join(ROOT, file);
    if (!existsSync(path)) continue;
    for (const raw of readFileSync(path, "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = val;
    }
  }
}
loadEnv();

const DRY = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.split("=")[1]) : Infinity;

function reqEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`✖ ENV ${name} wajib di-set (.env.local/.env).`);
    process.exit(2);
  }
  return v;
}

const SUPA_URL = reqEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE = reqEnv("SUPABASE_SERVICE_ROLE_KEY");
const R2_BASE = `https://${reqEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com/${reqEnv("R2_BUCKET")}`;
const aws = new AwsClient({
  accessKeyId: reqEnv("R2_ACCESS_KEY_ID"),
  secretAccessKey: reqEnv("R2_SECRET_ACCESS_KEY"),
  service: "s3",
  region: "auto",
});
const supa = createClient(SUPA_URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BUCKET = "media";
const VARIANTS = ["1600.webp", "400.webp"];
const r2url = (key) => `${R2_BASE}/${key.replace(/^\/+/, "")}`;

async function existsInR2(key) {
  const res = await aws.fetch(r2url(key), { method: "HEAD" });
  return res.status === 200;
}

async function migrateObject(key) {
  if (!FORCE && (await existsInR2(key))) return "skip";
  if (DRY) return "would";
  const { data, error } = await supa.storage.from(BUCKET).download(key);
  if (error || !data)
    throw new Error(`unduh Supabase gagal: ${error?.message ?? "tanpa data"}`);
  const buf = await data.arrayBuffer();
  const put = await aws.fetch(r2url(key), {
    method: "PUT",
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body: buf,
  });
  if (!put.ok)
    throw new Error(
      `R2 PUT ${put.status}: ${(await put.text().catch(() => "")).slice(0, 150)}`,
    );
  return "migrated";
}

/** Jalankan `fn` atas `items` dengan paralelisme maksimum `n`. */
async function mapPool(items, n, fn) {
  let i = 0;
  const workers = Array.from(
    { length: Math.min(n, items.length) },
    async () => {
      while (i < items.length) {
        const idx = i++;
        await fn(items[idx], idx);
      }
    },
  );
  await Promise.all(workers);
}

async function main() {
  // Ambil seluruh baris media (paginasi 1000).
  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supa
      .from("media")
      .select("storage_path")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("✖ query tabel media:", error.message);
      process.exit(1);
    }
    rows.push(...data);
    if (data.length < PAGE || rows.length >= LIMIT) break;
  }

  const keys = rows
    .slice(0, LIMIT === Infinity ? rows.length : LIMIT)
    .flatMap((r) => VARIANTS.map((v) => `${r.storage_path}/${v}`));

  console.log(
    `${rows.length} baris media → ${keys.length} objek. dry-run=${DRY} force=${FORCE}`,
  );

  const stats = { migrated: 0, skip: 0, would: 0, failed: 0 };
  const fails = [];
  let done = 0;
  await mapPool(keys, 8, async (key) => {
    try {
      stats[await migrateObject(key)]++;
    } catch (e) {
      stats.failed++;
      fails.push(`${key}: ${e.message}`);
    }
    if (++done % 50 === 0) console.log(`  … ${done}/${keys.length}`);
  });

  console.log("Ringkasan:", stats);
  if (fails.length) {
    console.error(`✖ ${fails.length} gagal:\n${fails.slice(0, 50).join("\n")}`);
    process.exit(1);
  }
  console.log(
    DRY ? "✓ dry-run selesai (tak ada tulis)." : "✓ migrasi selesai.",
  );
}

main().catch((e) => {
  console.error("✖ fatal:", e);
  process.exit(1);
});

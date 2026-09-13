#!/usr/bin/env node
/**
 * Gerbang terjadwal: rentang IP Cloudflare di `src/lib/cloudflare-ips.json`
 * harus sama persis dengan API resmi Cloudflare (DECISIONS #37). Dijalankan
 * harian oleh `.github/workflows/cloudflare-ips.yml`, dan saat berkasnya berubah.
 *
 * Kenapa perlu: `cf-connecting-ip` hanya dipercaya bila peer ada di rentang
 * itu. Daftar BASI membuat request dari edge baru dianggap "bukan Cloudflare"
 * → pengunjung dikunci per IP edge (banyak orang berbagi satu bucket rate
 * limit). Membaca JSON yang SAMA dengan runtime (`cloudflare-ips.ts`), bukan
 * regex atas kode, sehingga entri yang dikomentari tak bisa lolos diam-diam.
 *
 * Keluar non-nol bila daftar berbeda, tidak valid, atau API tak terjangkau.
 */
import { readFileSync } from "node:fs";

const SOURCE = new URL("../src/lib/cloudflare-ips.json", import.meta.url);
const API = "https://api.cloudflare.com/client/v4/ips";
const ATTEMPTS = 3;

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

function isCidrList(list) {
  return (
    Array.isArray(list) &&
    list.length > 0 &&
    list.every((c) => typeof c === "string" && c.includes("/"))
  );
}

function readLocal() {
  const data = JSON.parse(readFileSync(SOURCE, "utf8"));
  for (const key of ["ipv4", "ipv6"]) {
    if (!isCidrList(data[key])) {
      fail(`cloudflare-ips.json: "${key}" harus berupa array CIDR tak kosong`);
    }
    if (new Set(data[key]).size !== data[key].length) {
      fail(`cloudflare-ips.json: "${key}" berisi entri ganda`);
    }
  }
  return data;
}

async function fetchOfficial() {
  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await fetch(API, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const result = body?.result;
      if (
        !body?.success ||
        !isCidrList(result?.ipv4_cidrs) ||
        !isCidrList(result?.ipv6_cidrs)
      ) {
        throw new Error("format respons tak dikenal");
      }
      return result;
    } catch (err) {
      lastError = err;
      if (attempt < ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 2000));
      }
    }
  }
  throw lastError;
}

function diff(label, local, official) {
  const added = official.filter((c) => !local.includes(c));
  const removed = local.filter((c) => !official.includes(c));
  for (const c of added) {
    console.error(`  + ${label} ${c} (ada di API, belum di repo)`);
  }
  for (const c of removed) {
    console.error(`  - ${label} ${c} (ada di repo, sudah tak ada di API)`);
  }
  return added.length + removed.length;
}

const local = readLocal();

let official;
try {
  official = await fetchOfficial();
} catch (err) {
  fail(`API rentang IP Cloudflare tak terjangkau (${API}): ${err.message}`);
}

const changes =
  diff("IPv4", local.ipv4, official.ipv4_cidrs) +
  diff("IPv6", local.ipv6, official.ipv6_cidrs);

if (changes > 0) {
  fail(
    `Rentang IP Cloudflare berubah (${changes} perbedaan, etag ${official.etag}). ` +
      "Perbarui src/lib/cloudflare-ips.json DAN allowlist firewall origin — lihat DECISIONS #37.",
  );
}

if (official.etag !== local.etag) {
  console.log(
    `Catatan: etag API (${official.etag}) berbeda dari cloudflare-ips.json (${local.etag}), namun isi rentangnya sama.`,
  );
}

console.log(
  `Rentang IP Cloudflare sesuai API resmi (${local.ipv4.length} IPv4, ${local.ipv6.length} IPv6).`,
);

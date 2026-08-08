/**
 * Pilih IP klien dari header proxy — MURNI & teruji (tanpa next/headers).
 *
 * PENTING (temuan review adversarial): entri **paling KIRI** `x-forwarded-for`
 * DAPAT DIPALSUKAN klien — Cloudflare & Traefik meng-APPEND IP asli (bukan
 * menimpa), jadi nilai kiri tetap milik klien. Memakainya sebagai kunci rate
 * limit membuat proteksi banjir bisa dilewati dengan merotasi header. Urutan
 * tepercaya:
 *   1) `cf-connecting-ip` — Cloudflare MENIMPA nilai apa pun dari klien → otoritatif;
 *   2) `x-real-ip` — diisi proxy tepercaya (Traefik/Easypanel);
 *   3) `x-forwarded-for` entri paling KANAN (hop yang ditambah proxy tepercaya);
 *   4) `"unknown"` (semua tak dikenal berbagi 1 bucket rate-limit).
 * JANGAN PERNAH memakai entri kiri XFF.
 */
export function resolveClientIp(h: {
  cfConnectingIp?: string | null;
  xRealIp?: string | null;
  xForwardedFor?: string | null;
}): string {
  const cf = h.cfConnectingIp?.trim();
  if (cf) return cf;

  const real = h.xRealIp?.trim();
  if (real) return real;

  if (h.xForwardedFor) {
    const parts = h.xForwardedFor
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }

  return "unknown";
}

/** Prefix /24 IPv4 (`v4:a.b.c`) dari string IP, atau null bila bukan IPv4. */
function ipv4Prefix(v: string): string | null {
  const o = v.split(".");
  if (o.length !== 4) return null;
  return `v4:${o[0]}.${o[1]}.${o[2]}`;
}

/**
 * Kunci JARINGAN dari IP untuk rate-limit: IPv4 → /24 (3 oktet pertama),
 * IPv6 → /64 (4 hextet pertama). Rotasi alamat DALAM satu blok (umum: satu VPS
 * memegang /64 IPv6, atau /24 IPv4) berbagi bucket → plafon per-"IP" tak bisa
 * dilewati dengan berganti-ganti alamat sumber. Bentuk tak dikenal / "unknown"
 * dikembalikan apa adanya (semua berbagi satu bucket). MURNI & teruji.
 */
export function ipNetworkKey(ip: string): string {
  const v = ip.trim().toLowerCase();
  if (!v || v === "unknown") return "unknown";

  // IPv4-mapped IPv6 (mis. ::ffff:1.2.3.4) → perlakukan sebagai IPv4.
  if (v.includes(":") && v.includes(".")) {
    const tail = v.slice(v.lastIndexOf(":") + 1);
    return ipv4Prefix(tail) ?? "unknown";
  }

  if (v.includes(":")) {
    // IPv6 → /64: ekspansi "::" menjadi 8 hextet, ambil 4 pertama.
    const zoneless = v.split("%")[0];
    const [head, tail] = zoneless.split("::");
    const headParts = head ? head.split(":").filter(Boolean) : [];
    const tailParts = tail !== undefined ? tail.split(":").filter(Boolean) : [];
    const fill = Math.max(0, 8 - headParts.length - tailParts.length);
    const full = [...headParts, ...Array(fill).fill("0"), ...tailParts];
    const prefix = full.slice(0, 4).map((h) => h || "0");
    return `v6:${prefix.join(":")}`;
  }

  return ipv4Prefix(v) ?? v;
}

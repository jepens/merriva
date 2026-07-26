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

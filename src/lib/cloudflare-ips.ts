import ranges from "@/lib/cloudflare-ips.json";
import { parseCidr, type Cidr } from "@/lib/ip-cidr";

/**
 * Rentang IP edge Cloudflare — satu-satunya asal koneksi yang membuat header
 * `cf-connecting-ip` boleh dipercaya (AUDIT-2026-09-04 KEA-1, DECISIONS #37).
 *
 * PERLU, TETAPI TIDAK CUKUP: pelanggan Cloudflare MANA PUN (Worker `connect()`
 * atau zona proxied milik mereka) juga tersambung dari rentang ini dan bisa
 * menulis `cf-connecting-ip` sendiri. Yang membuktikan request datang dari zona
 * merriva.id hanya Authenticated Origin Pulls per-zona (LAUNCH-CHECKLIST Fase 6).
 *
 * Datanya di `cloudflare-ips.json` (salinan https://api.cloudflare.com/client/v4/ips).
 * Berkas JSON yang SAMA dibaca `scripts/check-cloudflare-ips.mjs`, yang berjalan
 * harian lewat `.github/workflows/cloudflare-ips.yml` dan gagal bila daftar
 * berbeda dari API resmi — runtime dan gerbang tak mungkin membaca daftar yang
 * berlainan.
 *
 * Kenapa kesegaran penting: daftar BASI membuat request dari edge baru dianggap
 * "bukan Cloudflare" → pengunjung dikunci per IP edge (banyak orang berbagi
 * satu bucket rate limit).
 */
export const CLOUDFLARE_IPV4: readonly string[] = ranges.ipv4;
export const CLOUDFLARE_IPV6: readonly string[] = ranges.ipv6;

export const CLOUDFLARE_CIDRS: readonly Cidr[] = [
  ...CLOUDFLARE_IPV4,
  ...CLOUDFLARE_IPV6,
].map(parseCidr);

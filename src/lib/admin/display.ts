import { formatEventDateTime } from "@/lib/datetime";

/** Tanggal WIB ringkas untuk tabel admin (mis. "15 Agustus 2026"). */
export function wibDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatEventDateTime(iso, "Asia/Jakarta")?.date ?? "—";
}

/** Tanggal + waktu WIB (mis. "Sabtu, 15 Agustus 2026 · 10.00 WIB"). */
export function wibDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatEventDateTime(iso, "Asia/Jakarta")?.full ?? "—";
}

/**
 * Akun ter-ban (GoTrue `banned_until`) → true bila di masa depan. Akun tak
 * ter-ban punya `banned_until` null / kosong / masa lalu (zero-time). Helper
 * terpisah agar `Date.now()` tak dipanggil dalam render Server Component
 * (aturan kemurnian React compiler).
 */
export function isUserBanned(bannedUntil: string | null | undefined): boolean {
  if (!bannedUntil) return false;
  const t = new Date(bannedUntil).getTime();
  return Number.isFinite(t) && t > Date.now();
}

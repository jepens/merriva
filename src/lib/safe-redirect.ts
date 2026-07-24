/**
 * Sanitasi parameter `next`/`redirect` sebelum dipakai untuk navigasi.
 *
 * Mencegah open redirect: hanya izinkan path relatif di dalam aplikasi
 * (mulai `/`, bukan `//` yang protocol-relative, dan bukan URL absolut).
 *
 * PENTING: parser URL (WHATWG/`new URL`) MEMBUANG karakter kontrol ASCII
 * (TAB 0x09, LF 0x0A, CR 0x0D, dsb.) dan MENORMALKAN `\` menjadi `/` SEBELUM
 * mem-parse. Jadi `/\t/evil.com` → `//evil.com` → `https://evil.com/`. Karena
 * itu kita tolak SEMUA karakter kontrol dan backslash, bukan hanya prefix
 * literal `//`/`/\`. (Temuan review keamanan M1.1.)
 */
export function safeNextPath(
  next: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  // Tolak karakter kontrol C0 (0x00–0x1f), DEL (0x7f), dan backslash (0x5c):
  // parser URL membuang/menormalkannya sehingga membuka bypass protocol-relative.
  for (let i = 0; i < next.length; i += 1) {
    const code = next.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f || code === 0x5c) {
      return fallback;
    }
  }
  if (next.startsWith("//")) return fallback;
  return next;
}

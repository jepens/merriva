/**
 * URL gambar pratinjau tautan (og:image) — SATU sumber untuk metadata halaman
 * undangan, route `/api/og/[slug]`, dan pemanasan cache di halaman Sebar
 * (DECISIONS #122).
 *
 * KENAPA `.jpg`: Cloudflare meng-cache ekstensi gambar secara bawaan, jadi
 * `s-maxage` route berlaku di edge tanpa Cache Rule apa pun. Path lama tanpa
 * ekstensi tak pernah ter-cache (`cf-cache-status: DYNAMIC`): tiap pengambilan
 * merender ulang 1–3 detik, memakan jatah ±7 detik WhatsApp Desktop/Web
 * menunggu kartu — lewat dari itu, kartu sementara "merriva.id" tanpa gambar
 * yang ikut terkirim.
 *
 * KENAPA `?v=updated_at` (milidetik): kunci cache bawaan Cloudflare memuat
 * query, jadi simpanan baru = URL baru = gambar segar. Pemanasan dari Sebar
 * hanya berguna bila URL-nya sama dengan og:image halaman — karena itu keduanya
 * dirakit di sini dari kolom yang sama, dan simpanan pemilik (editor maupun
 * template Sebar) me-revalidate `/{slug}` agar halaman memancarkan `?v` yang
 * sama. Pembaruan lain pada baris ini yang tak me-revalidate `/{slug}`
 * (penanda pengingat cron, ganti pemilik oleh admin) bisa membuat halaman ISR
 * tertinggal satu versi (≤ 1 jam): kiriman pertama lalu kena satu render di
 * origin — sama seperti sebelum #122.
 */

const EXT = ".jpg";

export function ogImageUrl(slug: string, updatedAt: string): string {
  return `/api/og/${slug}${EXT}?v=${new Date(updatedAt).getTime()}`;
}

/**
 * Segmen `[slug]` route OG → slug. `<slug>.jpg` (og:image sejak #122) dan
 * `<slug>` polos (pratinjau yang tersebar sebelumnya) sama-sama dilayani.
 * Slug sah tak pernah memuat titik, jadi pemotongan ini tak ambigu.
 */
export function ogSlugFromSegment(segment: string): string {
  return segment.endsWith(EXT) ? segment.slice(0, -EXT.length) : segment;
}

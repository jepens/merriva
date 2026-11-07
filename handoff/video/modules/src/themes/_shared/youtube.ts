/**
 * Ekstraksi id video YouTube dari tautan resmi (FASE J — section Video).
 *
 * Menerima bentuk yang lazim dibagikan pemilik: `watch?v=`, `youtu.be/`,
 * `shorts/`, `live/`, dan `embed/`. Validasi HOST (bukan substring) mengikuti
 * `youtubeUrlSchema` di `lib/validation/content/shared` — fungsi ini berjalan
 * SETELAH skema itu, tetapi tetap memverifikasi host sendiri karena dipakai
 * juga untuk data lama yang tersimpan sebelum skema diperketat.
 *
 * Mengembalikan `null` bila bukan tautan video YouTube yang bisa di-embed —
 * pemanggil menyembunyikan section video (fitur opsional, bukan galat).
 */
const YT_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "www.youtube-nocookie.com",
  "youtu.be",
]);

/** Id video YouTube: 11 karakter [A-Za-z0-9_-]. */
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

export function youtubeVideoId(url: string | undefined | null): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  if (!YT_HOSTS.has(host)) return null;

  const candidate = (() => {
    if (host === "youtu.be") return u.pathname.split("/")[1] ?? "";
    const seg = u.pathname.split("/").filter(Boolean);
    if (seg[0] === "watch") return u.searchParams.get("v") ?? "";
    if (seg[0] === "shorts" || seg[0] === "embed" || seg[0] === "live")
      return seg[1] ?? "";
    if (u.pathname === "/" || seg.length === 0)
      return u.searchParams.get("v") ?? "";
    return u.searchParams.get("v") ?? "";
  })();

  return YT_ID.test(candidate) ? candidate : null;
}

/** URL embed (youtube-nocookie, autoplay setelah klik facade). */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;
}

/** Poster facade — kualitas hq (480×360) selalu tersedia untuk semua video. */
export function youtubePosterUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

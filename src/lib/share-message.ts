/**
 * Helper "Sebar Undangan" (SPEC §4.7) — MURNI/teruji. Template pesan memakai
 * variabel `{nama}`, `{link}`, `{acara}`. Nomor WA di-render jadi tautan `wa.me`
 * (hanya digit; nomor tersimpan E.164 `+62…` → `62…`).
 */

export interface ShareVars {
  nama: string;
  link: string;
  acara: string;
}

/** Isi template dengan variabel; placeholder yang tak dikenal dibiarkan apa adanya. */
export function fillTemplate(template: string, vars: ShareVars): string {
  return template
    .split("{nama}")
    .join(vars.nama)
    .split("{link}")
    .join(vars.link)
    .split("{acara}")
    .join(vars.acara);
}

/** Link personal tamu (`{origin}/{slug}?g={token}`). */
export function personalLink(
  origin: string,
  slug: string,
  token: string,
): string {
  return `${origin}/${slug}?g=${token}`;
}

/** Digit nomor WA internasional (buang `+`/spasi); null bila tak memadai. */
export function waDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

/** Tautan `wa.me` dengan pesan terisi; null bila nomor tak valid. */
export function waMeUrl(
  phone: string | null | undefined,
  text: string,
): string | null {
  const digits = waDigits(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

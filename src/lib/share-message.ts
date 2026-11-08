/**
 * Helper "Sebar Undangan" (SPEC §4.7) — MURNI/teruji. Template pesan memakai
 * variabel `{nama}`, `{link}`, `{acara}`, `{tanggal}`. Tautan kirim memakai
 * tautan resmi WhatsApp `wa.me` (DECISIONS #120).
 */

/**
 * Batas panjang template tersimpan — sama dengan CHECK kolom
 * `invitations.share_template*` (migrasi 20261108100000). Editor membatasi
 * `maxLength` dengan angka yang sama (satu sumber angka, SPEC §4.4).
 */
export const SHARE_TEMPLATE_MAX = 2000;

export interface ShareVars {
  nama: string;
  link: string;
  acara: string;
  tanggal: string;
}

/** Isi template dengan variabel; placeholder yang tak dikenal dibiarkan apa adanya. */
export function fillTemplate(template: string, vars: ShareVars): string {
  return template
    .split("{nama}")
    .join(vars.nama)
    .split("{link}")
    .join(vars.link)
    .split("{acara}")
    .join(vars.acara)
    .split("{tanggal}")
    .join(vars.tanggal);
}

/** Link personal tamu (`{origin}/{slug}?g={token}`). */
export function personalLink(
  origin: string,
  slug: string,
  token: string,
): string {
  return `${origin}/${slug}?g=${token}`;
}

/** Batas nama `?to=` — sama dengan sanitasi di halaman publik (60 karakter). */
const TO_MAX = 60;

/**
 * Link UMUM tanpa token (`{origin}/{slug}`) untuk tamu yang tak ada di daftar.
 * Nama opsional → `?to=Nama` agar sampul menyapa namanya (halaman publik sudah
 * menyanitasi `?to=`); tetap TIDAK terlacak per tamu dan RSVP-nya tak tertaut.
 */
export function generalLink(
  origin: string,
  slug: string,
  name?: string | null,
): string {
  const nama = (name ?? "").replace(/[<>]/g, "").trim().slice(0, TO_MAX);
  const base = `${origin}/${slug}`;
  return nama ? `${base}?${new URLSearchParams({ to: nama })}` : base;
}

/** Digit nomor WA internasional (buang `+`/spasi); null bila tak memadai. */
export function waDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

/**
 * Tautan kirim WhatsApp dengan pesan terisi — SELALU ada.
 *
 * - Bernomor: `https://wa.me/{nomor}?text=…` → langsung ke chat tamu itu.
 * - Tanpa nomor / nomor tak valid: `https://wa.me/?text=…` → WhatsApp membuka
 *   DAFTAR KONTAK dengan pesan terisi, pemilik memilih penerimanya (FAQ resmi
 *   WhatsApp https://faq.whatsapp.com/5913398998672934). Dulu fungsi ini
 *   mengembalikan null untuk tamu tanpa nomor, sehingga undangan dengan 222
 *   tamu tanpa nomor tak punya satu pun tombol kirim (DECISIONS #120).
 */
export function waShareUrl(
  phone: string | null | undefined,
  text: string,
): string {
  const digits = waDigits(phone);
  const q = `text=${encodeURIComponent(text)}`;
  return digits ? `https://wa.me/${digits}?${q}` : `https://wa.me/?${q}`;
}

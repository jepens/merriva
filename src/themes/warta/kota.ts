/**
 * Segmen alamat yang jelas BUKAN nama kota: jalan, gang, lantai, blok, nomor,
 * kaveling, RT/RW, wilayah administratif kecil, dan jenis bangunan/tempat.
 */
const BUKAN_KOTA =
  /^(jl|jln|jalan|gg|gang|lt|lantai|blok|no|nomor|kav|kavling|rt|rw|kel|kelurahan|kec|kecamatan|desa|ds|dusun|gedung|gd|komp|kompleks|komplek|perum|perumahan|ruko|apartemen|tower|menara|ballroom|hotel|masjid|gereja|aula|wisma|graha|kantor|kampus|pendopo)\b/i;

/** Kode pos 5 angka di AKHIR segmen ("Jakarta Selatan 12190"). */
const KODE_POS = /\s*\d{5}\s*$/;

/**
 * Kota dari baris alamat untuk dateline koran ("Reported from …", "Printed in
 * …"): "Jl. Sudirman Kav. 52-53, Jakarta Selatan 12190" → "Jakarta Selatan".
 *
 * Sengaja konservatif — lebih baik tak menyebut kota daripada mencetak "Lt."
 * atau sepotong nama jalan. `null` bila: alamat tanpa koma (satu segmen tak
 * bisa dibedakan dari nama tempat, mis. "Masjid Agung"), segmen terakhir masih
 * berangka sesudah kode pos dibuang, berawalan jalan/gedung/wilayah kecil, atau
 * bukan 2–24 huruf. "…, Indonesia" memakai segmen sebelumnya.
 */
export function kotaDari(address: string | null | undefined): string | null {
  if (!address) return null;
  const segs = address
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segs.length < 2) return null;
  if (/^indonesia$/i.test(segs[segs.length - 1])) segs.pop();
  const seg = (segs[segs.length - 1] ?? "").replace(KODE_POS, "").trim();
  if (!seg || /\d/.test(seg) || BUKAN_KOTA.test(seg)) return null;
  return /^[\p{L} .'-]{2,24}$/u.test(seg) ? seg : null;
}

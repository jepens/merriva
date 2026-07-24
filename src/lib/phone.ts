/**
 * Utilitas nomor WhatsApp Indonesia. Disimpan dalam format E.164 (mis. `+6281234567890`).
 * Menerima input umum: `08xxx`, `62xxx`, `+62 8xx-xxxx`, dsb.
 */

/** Hanya sisakan digit dan tanda `+` di awal. */
function stripFormatting(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Normalisasi ke E.164 Indonesia (`+62...`). Mengembalikan `null` bila tidak valid.
 * Aturan: nomor seluler Indonesia diawali `8`, panjang bagian nasional 9–13 digit.
 */
export function normalizeIndonesianPhone(raw: string): string | null {
  if (!raw) return null;
  const cleaned = stripFormatting(raw);

  let national: string;
  if (cleaned.startsWith("+62")) {
    national = cleaned.slice(3);
  } else if (cleaned.startsWith("62")) {
    national = cleaned.slice(2);
  } else if (cleaned.startsWith("0")) {
    national = cleaned.slice(1);
  } else {
    national = cleaned.replace(/^\+/, "");
  }

  if (!/^8\d{8,12}$/.test(national)) return null;
  return `+62${national}`;
}

/** True bila `raw` bisa dinormalisasi ke nomor WA Indonesia yang valid. */
export function isValidIndonesianPhone(raw: string): boolean {
  return normalizeIndonesianPhone(raw) !== null;
}

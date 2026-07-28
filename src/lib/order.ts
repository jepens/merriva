/**
 * Kode order publik (SPEC §4.8 / DATA-MODEL: `orders.order_code`, mis. `MRV-8F3K2`).
 * Dikirim sebagai `order_id` ke Pakasir. MURNI/teruji. Acak via Web Crypto
 * (Node 22 & browser). Alfabet tanpa karakter ambigu (O/0, I/1) agar mudah
 * dibaca/diketik manual saat rekonsiliasi. Keunikan dijamin constraint UNIQUE
 * kolom `order_code` (tabrakan sangat kecil → pemanggil retry pada 23505).
 */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa O,0,I,1
const CODE_LEN = 6;

/** `MRV-XXXXXX` (6 char alfanumerik non-ambigu). */
export function generateOrderCode(): string {
  const bytes = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < CODE_LEN; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `MRV-${out}`;
}

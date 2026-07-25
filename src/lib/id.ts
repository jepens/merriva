/**
 * Generator ID acak. Memakai Web Crypto (`crypto.randomUUID`) yang tersedia di
 * Node 22 & browser. `draftSlug` dipakai saat membuat draft undangan (kolom
 * `invitations.slug` NOT NULL unique) sebelum pemilik menetapkan slug asli.
 */

const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomChars(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  }
  return out;
}

/** Slug sementara untuk draft (mis. `draft-a1b2c3d4e5`), valid `[a-z0-9-]{3,60}`. */
export function draftSlug(): string {
  return `draft-${randomChars(10)}`;
}

/** Token acak alfanumerik (untuk guests.token dsb. — dipakai Fase 2/M2). */
export function randomToken(len = 14): string {
  return randomChars(len);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True bila string berbentuk UUID (guard sebelum query `.eq('id', …)`). */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

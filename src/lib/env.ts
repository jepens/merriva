/**
 * Akses environment variable terpusat.
 *
 * Getter untuk nilai wajib melempar error hanya saat DIPANGGIL (lazy) — bukan saat
 * modul di-import — supaya build/CI tanpa env tidak gagal. Referensi `process.env.NEXT_PUBLIC_*`
 * ditulis langsung agar di-inline Next.js untuk bundle browser.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Environment variable ${name} belum di-set.`);
  }
  return value;
}

export function getSupabaseUrl(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

export function getSupabaseAnonKey(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** RAHASIA — hanya boleh dipanggil di server. */
export function getSupabaseServiceRoleKey(): string {
  return required(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const storageDriver = (process.env.STORAGE_DRIVER ?? "supabase") as
  "supabase" | "r2";

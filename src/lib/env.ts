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

/**
 * Basis URL publik media (foto/musik) — WAJIB domain sendiri (SPEC §6.4), bukan
 * URL vendor. Di **production** wajib di-set ke host yang menyajikan bucket
 * (mis. `https://cdn.merriva.id` untuk R2, atau reverse-proxy domain sendiri ke
 * Supabase Storage). Bila KOSONG, `getPublicUrl` menghasilkan URL RELATIF yang
 * 404 di produksi (tak ada rewrite) → SELURUH foto/cover/musik undangan rusak
 * senyap. Karena itu kita GAGAL-KERAS di production agar salah-konfig ketahuan
 * saat uji staging (Fase 7), bukan diam-diam di depan tamu. Dev: boleh kosong.
 */
export function getMediaBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_MEDIA_URL ?? "").replace(/\/+$/, "");
  // Gagal-keras HANYA di RUNTIME production — bukan saat `next build` (build
  // tanpa MEDIA_URL sah: media tak disajikan saat build; menjaga CI tetap hijau).
  if (
    !raw &&
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    throw new Error(
      "NEXT_PUBLIC_MEDIA_URL belum di-set — media (foto/musik) akan 404 di " +
        "produksi. Isi dengan host penyaji bucket dari domain sendiri " +
        "(mis. https://cdn.merriva.id).",
    );
  }
  return raw;
}

/** Kredensial R2 (RAHASIA — hanya server; wajib saat STORAGE_DRIVER=r2). */
export function getR2AccountId(): string {
  return required("R2_ACCOUNT_ID", process.env.R2_ACCOUNT_ID);
}
export function getR2AccessKeyId(): string {
  return required("R2_ACCESS_KEY_ID", process.env.R2_ACCESS_KEY_ID);
}
export function getR2SecretAccessKey(): string {
  return required("R2_SECRET_ACCESS_KEY", process.env.R2_SECRET_ACCESS_KEY);
}
export function getR2Bucket(): string {
  return required("R2_BUCKET", process.env.R2_BUCKET);
}

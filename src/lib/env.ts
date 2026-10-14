/**
 * Akses environment variable terpusat.
 *
 * Getter untuk nilai wajib melempar error hanya saat DIPANGGIL (lazy) — bukan saat
 * modul di-import — sehingga modul yang tak membutuhkan nilai itu tetap bisa
 * di-import tanpa env. Referensi `process.env.NEXT_PUBLIC_*` ditulis langsung agar
 * di-inline Next.js untuk bundle browser.
 *
 * PENTING: pra-render statis halaman marketing (`/`, `/harga`, `/tema`) MEMANGGIL
 * getter Supabase saat build, jadi `next build` WAJIB punya
 * `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY` — di Docker lewat
 * build-arg, di CI lewat GitHub Actions secret (DECISIONS #36). Anggapan lama
 * bahwa build CI tanpa env tak akan gagal sudah tidak berlaku sejak M4.3.
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

/**
 * `NEXT_PUBLIC_APP_URL` tak pernah diisi, sehingga `appUrl` jatuh ke default
 * localhost.
 *
 * Di produksi itu bukan kekurangan kecil. Nilai ini menjadi `redirect_to` OAuth,
 * hostname yang diperiksa Turnstile, tautan di setiap email, `metadataBase`, dan
 * URL di sitemap. Karena punya default, TIDAK ADA yang gagal: aplikasinya
 * menyala normal dan baru terlihat rusak jauh dari sebabnya — login Google
 * berakhir di halaman depan tanpa sesi, dan tak ada satu pun galat yang tercatat.
 *
 * Variabel ini WAJIB build-arg, bukan env runtime: Next menyisipkan
 * `NEXT_PUBLIC_*` saat build, jadi mengisinya di panel tanpa build ulang tidak
 * mengubah apa pun — jebakan kedua di atas jebakan pertama. Dibaca sebagai
 * fungsi (bukan konstanta) agar bisa diuji kedua cabangnya.
 */
export function appUrlMasihDefault(): boolean {
  return !process.env.NEXT_PUBLIC_APP_URL;
}

/**
 * Driver storage aktif. Dibaca SAAT DIPANGGIL (bukan konstanta modul) supaya
 * pabrik driver dan route penyaji `/media` selalu melihat nilai yang sama.
 *
 * Ejaan yang tak dikenali GAGAL-KERAS. Sebelumnya nilai asing jatuh diam-diam
 * ke `supabase`, dan itu jebakan yang lebih buruk daripada lupa mengisi: unggah
 * tetap berhasil — ke tempat yang salah — sementara URL media menunjuk tempat
 * yang benar, jadi yang terlihat hanyalah foto yang 404 tanpa sebab.
 */
export function getStorageDriver(): "supabase" | "r2" | "local" {
  const raw = (process.env.STORAGE_DRIVER ?? "").trim();
  if (!raw) return "supabase";
  if (raw === "supabase" || raw === "r2" || raw === "local") return raw;
  throw new Error(
    `STORAGE_DRIVER="${raw}" tidak dikenali — isi dengan \`supabase\`, \`r2\`, atau \`local\` (kosong = supabase).`,
  );
}

/**
 * Akar penyimpanan media untuk driver `local` — RELATIF terhadap cwd proses
 * (`/app` di dalam container), jadi default `data/media` berarti
 * `/app/data/media`: titik mount volume Easypanel.
 *
 * Nilainya tak pernah berasal dari permintaan; yang menentukan berkas mana yang
 * boleh terbaca adalah `lib/storage/local-path.ts`.
 */
export function getMediaRoot(): string {
  return (process.env.MEDIA_ROOT ?? "").trim() || "data/media";
}

/**
 * Basis URL publik media (foto/musik) — WAJIB domain sendiri (SPEC §6.4), bukan
 * URL vendor. Di **production** wajib di-set ke host yang menyajikan bucket:
 * `https://merriva.id/media` untuk driver `local` (route penyaji di app ini),
 * `https://cdn.merriva.id` untuk R2, atau reverse-proxy domain sendiri ke
 * Supabase Storage. Bila KOSONG, `getPublicUrl` menghasilkan URL RELATIF yang
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
        "produksi. Isi dengan host penyaji media dari domain sendiri " +
        "(https://merriva.id/media untuk STORAGE_DRIVER=local, " +
        "https://cdn.merriva.id untuk r2).",
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

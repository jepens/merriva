import { z } from "zod";

import { isValidIndonesianPhone } from "@/lib/phone";

/**
 * Skema Zod autentikasi & profil (SPEC §4.2). Dipakai di form (client) dan
 * divalidasi ULANG di server action (SPEC §9). Pesan error berbahasa Indonesia.
 *
 * Batas kata sandi 72 karakter mengikuti batas bcrypt Supabase Auth.
 */

/**
 * Istilah yang terlalu mudah ditebak UNTUK PRODUK INI (AUDIT-2026-10-01 B5).
 *
 * SENGAJA BUKAN daftar kata sandi bocoran: itu tugas Leaked Password Protection
 * Supabase (berbasis HIBP, jutaan entri) dan menirunya setengah jalan lebih
 * buruk daripada tidak sama sekali. Yang ada di sini justru yang TIDAK bisa
 * ditangkap HIBP — `merriva2026` boleh jadi tak pernah bocor ke mana pun, tetapi
 * ia tetap tebakan pertama siapa pun yang menyerang akun di domain ini.
 */
const ISTILAH_TERLARANG = ["merriva", "undangan"];

function mudahDitebak(nilai: string): boolean {
  const n = nilai.toLowerCase();
  return ISTILAH_TERLARANG.some((kata) => n.includes(kata));
}

const passwordField = z
  .string()
  .min(8, "Kata sandi minimal 8 karakter")
  .max(72, "Kata sandi maksimal 72 karakter")
  .refine(
    (v) => !mudahDitebak(v),
    'Kata sandi tidak boleh memuat kata "merriva" atau "undangan" — terlalu mudah ditebak.',
  );

const phoneField = z
  .string()
  .optional()
  .transform((v) => v?.trim() ?? "")
  .refine(
    (v) => v === "" || isValidIndonesianPhone(v),
    "Nomor WhatsApp tidak valid (contoh: 08123456789)",
  );

export const registerSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(2, "Nama minimal 2 karakter")
      .max(80, "Nama maksimal 80 karakter"),
    email: z.email("Format email tidak valid"),
    password: passwordField,
    phone: phoneField,
  })
  // Kata sandi = bagian lokal alamat emailnya sendiri. HIBP tak bisa menangkap
  // ini (kombinasinya unik per orang), padahal justru itu tebakan paling awal.
  // HANYA bisa diperiksa di sini: form reset & ganti kata sandi tak memegang
  // alamat email — keterbatasan yang diterima, bukan yang terlupa.
  .refine(
    (d) => {
      const lokal = d.email.split("@")[0]?.toLowerCase() ?? "";
      return lokal.length < 3 || !d.password.toLowerCase().includes(lokal);
    },
    {
      message: "Kata sandi tidak boleh memuat bagian alamat email Anda.",
      path: ["password"],
    },
  );

export const loginSchema = z.object({
  email: z.email("Format email tidak valid"),
  password: z.string().min(1, "Kata sandi wajib diisi"),
});

export const resetRequestSchema = z.object({
  email: z.email("Format email tidak valid"),
});

export const updatePasswordSchema = z
  .object({
    password: passwordField,
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Konfirmasi kata sandi tidak cocok",
    path: ["confirm"],
  });

/**
 * Ganti kata sandi DARI DALAM AKUN (bukan jalur "lupa kata sandi").
 * `current` sengaja hanya `min(1)`: ia diverifikasi ke Supabase, bukan ke aturan
 * panjang — akun lama bisa punya kata sandi yang lebih pendek dari aturan baru,
 * dan menolaknya di sini akan mengunci justru orang yang ingin memperbaikinya.
 */
export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Kata sandi saat ini wajib diisi"),
    password: passwordField,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Konfirmasi kata sandi tidak cocok",
    path: ["confirm"],
  })
  .refine((d) => d.password !== d.current, {
    message: "Kata sandi baru harus berbeda dari yang sekarang",
    path: ["password"],
  });

export const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter")
    .max(80, "Nama maksimal 80 karakter"),
  phone: phoneField,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetRequestInput = z.infer<typeof resetRequestSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;

import { z } from "zod";

import { isValidIndonesianPhone } from "@/lib/phone";

/**
 * Skema Zod autentikasi & profil (SPEC §4.2). Dipakai di form (client) dan
 * divalidasi ULANG di server action (SPEC §9). Pesan error berbahasa Indonesia.
 *
 * Batas kata sandi 72 karakter mengikuti batas bcrypt Supabase Auth.
 */

const passwordField = z
  .string()
  .min(8, "Kata sandi minimal 8 karakter")
  .max(72, "Kata sandi maksimal 72 karakter");

const phoneField = z
  .string()
  .optional()
  .transform((v) => v?.trim() ?? "")
  .refine(
    (v) => v === "" || isValidIndonesianPhone(v),
    "Nomor WhatsApp tidak valid (contoh: 08123456789)",
  );

export const registerSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter")
    .max(80, "Nama maksimal 80 karakter"),
  email: z.email("Format email tidak valid"),
  password: passwordField,
  phone: phoneField,
});

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
export type ProfileInput = z.infer<typeof profileSchema>;

import { z } from "zod";

import { packageCodeSchema } from "@/lib/validation/checkout";

/**
 * Validasi aksi panel admin (SPEC §4.9). Input tetap divalidasi ulang di server
 * meski UI membatasi — Server Action = endpoint yang bisa dipanggil langsung.
 */

export const adminActivateSchema = z.object({
  packageCode: packageCodeSchema,
});

export const adminExtendSchema = z.object({
  months: z.coerce.number().int().min(1).max(24),
});

export const adminSuspendSchema = z.object({
  reason: z.string().trim().min(1, "Alasan wajib diisi").max(500),
});

export const adminChangeOwnerSchema = z.object({
  newUserId: z.string().uuid(),
});

/** Ubah peran pengguna (SPEC §4.9 "kelola user"). Enum selaras `profile_role`. */
export const adminUserRoleSchema = z.object({
  role: z.enum(["client", "admin"]),
});

const CATEGORY_VALUES = ["wedding", "corporate", "family"] as const;

/**
 * Edit paket (SPEC §4.9 "CRUD paket & harga"). `code` TIDAK diedit (identitas
 * stabil, terikat enum checkout). Boolean checkbox di-parse per-kehadiran di
 * action (bukan `z.coerce.boolean` — "false"/"on" ambigu). `maxGuests` diabaikan
 * bila `guestsUnlimited` (→ null = tanpa batas).
 */
export const adminPackageSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(100),
  priceIdr: z.coerce.number().int().min(0).max(100_000_000),
  durationMonths: z.coerce.number().int().min(1).max(60),
  maxPhotos: z.coerce.number().int().min(1).max(1000),
  maxGuests: z.coerce.number().int().min(1).max(1_000_000),
  guestsUnlimited: z.boolean(),
  isActive: z.boolean(),
  youtube: z.boolean(),
  allThemes: z.boolean(),
  watermark: z.boolean(),
});

/**
 * Tambah lagu pustaka musik (SPEC §4.9). Berkas audio divalidasi terpisah di
 * action (tipe/ukuran via `lib/audio`); di sini hanya metadata. `artist` kosong
 * ("" dari form) dinormalkan → undefined agar tersimpan null, bukan string kosong.
 */
export const adminSongSchema = z.object({
  title: z.string().trim().min(1, "Judul wajib diisi").max(120),
  artist: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(120).optional(),
  ),
});

/**
 * Edit metadata tema (SPEC §4.9): admin mengatur nama/kategori/tier/status/urutan.
 * `slug`/`demo_slug` terikat kode di repo → tidak diedit di sini.
 */
export const adminThemeSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(100),
  categories: z
    .array(z.enum(CATEGORY_VALUES))
    .min(1, "Pilih minimal 1 kategori"),
  tier: z.enum(["standard", "premium"]),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  isActive: z.boolean(),
});

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

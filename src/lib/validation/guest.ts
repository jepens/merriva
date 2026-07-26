import { z } from "zod";

import { normalizeIndonesianPhone } from "@/lib/phone";

/**
 * Skema tamu (SPEC §4.7). CRUD lewat server action (auth → kepemilikan → Zod →
 * RPC/UPDATE → revalidate). Nomor WA disimpan E.164 (`+62…`) via
 * `normalizeIndonesianPhone` (dipakai ulang untuk tombol wa.me M2.4). `token`
 * dibuat server-side (bukan di skema ini) dan tak pernah bisa diubah pemilik.
 */

const emptyToUndef = (v: unknown) =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;

export const guestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama tidak boleh kosong")
    .max(80, "Nama terlalu panjang"),
  phone: z.preprocess(
    emptyToUndef,
    z
      .string()
      .refine(
        (v) => normalizeIndonesianPhone(v) !== null,
        "Nomor WhatsApp tidak valid (contoh: 08123456789)",
      )
      // Simpan E.164 (`+62…`). refine di atas menjamin hasil non-null.
      .transform((v) => normalizeIndonesianPhone(v) as string)
      .optional(),
  ),
  groupLabel: z.preprocess(
    emptyToUndef,
    z.string().max(40, "Label maksimal 40 karakter").optional(),
  ),
  paxAllocated: z.coerce
    .number()
    .int()
    .min(1, "Minimal 1 tamu")
    .max(20, "Maksimal 20 tamu")
    .default(2),
  notes: z.preprocess(
    emptyToUndef,
    z.string().max(300, "Catatan maksimal 300 karakter").optional(),
  ),
});

export type GuestInput = z.input<typeof guestSchema>;
export type GuestParsed = z.infer<typeof guestSchema>;

/** Bentuk tamu yang aman dipakai di UI dashboard (pemilik). */
export interface GuestView {
  id: string;
  name: string;
  phone: string | null;
  groupLabel: string | null;
  paxAllocated: number;
  notes: string | null;
  token: string;
  waClickedAt: string | null;
  firstViewedAt: string | null;
}

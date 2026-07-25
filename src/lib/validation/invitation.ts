import { z } from "zod";

import {
  draftContentSchema,
  eventDraftListSchema,
  settingsSchema,
} from "@/lib/validation/content";

/** Input pembuatan draft undangan (SPEC Flow A: pilih kategori → pilih tema). */
export const createInvitationSchema = z.object({
  category: z.enum(["wedding", "corporate", "family"]),
  themeSlug: z.string().trim().min(1, "Pilih tema terlebih dahulu").max(60),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

/**
 * Payload autosave draft (SPEC §4.4). Konten divalidasi longgar (`draftContentSchema`)
 * agar draft belum lengkap tetap tersimpan; `eventDate` string tanggal atau kosong.
 * Jadwal (`invitation_events`) & slug punya jalur simpan tersendiri (M1.3c/d).
 */
export const saveDraftSchema = z.object({
  content: draftContentSchema,
  settings: settingsSchema,
  eventDate: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || !Number.isNaN(Date.parse(v)),
      "Tanggal tidak valid",
    )
    .optional(),
  events: eventDraftListSchema,
});

export type SaveDraftInput = z.infer<typeof saveDraftSchema>;

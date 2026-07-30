import { z } from "zod";

import {
  corporateContentSchema,
  familyContentSchema,
  weddingContentSchema,
} from "./categories";
import { personSchema, storyEntrySchema } from "./shared";

/**
 * Skema DRAFT (longgar) — dipakai saat autosave. Field wajib direlaksasi menjadi
 * opsional agar draft yang belum lengkap tetap bisa disimpan, TAPI batas panjang,
 * bentuk `storage_path` (tolak URL vendor), format YouTube, dan batas jumlah array
 * TETAP ditegakkan (mencegah JSONB liar). Validasi LENGKAP dijalankan saat
 * preview/aktivasi memakai skema strict (`invitationContentSchema`).
 */

const personDraftSchema = personSchema.extend({
  name: z.string().trim().max(120).optional(),
});

const storyDraftSchema = storyEntrySchema.extend({
  title: z.string().trim().max(120).optional(),
  narrative: z.string().trim().max(2000).optional(),
});

/**
 * PIC draft: email direlaksasi jadi string biasa agar autosave tak gagal saat
 * pengguna masih mengetik (mis. "budi@"). Format email penuh divalidasi saat
 * aktivasi (skema strict `corporateContentSchema.pic.email`). Selaras dgn cara
 * `draftCommonFields` merelaksasi youtube/livestream.
 */
const picDraftSchema = z
  .object({
    name: z.string().trim().max(120).optional(),
    phone: z.string().trim().max(40).optional(),
    email: z.string().trim().max(160).optional(),
  })
  .optional();

/**
 * Field format-ketat direlaksasi saat draft agar autosave tidak gagal saat
 * pengguna masih mengetik (URL/quote belum lengkap). Batas panjang tetap ada;
 * format URL/YouTube divalidasi penuh saat preview/aktivasi.
 */
const draftCommonFields = {
  quote: z
    .object({
      text: z.string().trim().max(500).optional(),
      source: z.string().trim().max(120).optional(),
    })
    .optional(),
  youtubeUrl: z.string().trim().max(200).optional(),
  livestreamUrl: z.string().trim().max(500).optional(),
};

export const weddingDraftSchema = weddingContentSchema.extend({
  groom: personDraftSchema,
  bride: personDraftSchema,
  story: z.array(storyDraftSchema).max(20).default([]),
  ...draftCommonFields,
});

export const corporateDraftSchema = corporateContentSchema.extend({
  eventName: z.string().trim().max(160).optional(),
  pic: picDraftSchema,
  agenda: z.array(storyDraftSchema).max(30).default([]),
  ...draftCommonFields,
});

export const familyDraftSchema = familyContentSchema.extend({
  eventName: z.string().trim().max(160).optional(),
  wishes: z.array(storyDraftSchema).max(20).default([]),
  ...draftCommonFields,
});

export const draftContentSchema = z.discriminatedUnion("category", [
  weddingDraftSchema,
  corporateDraftSchema,
  familyDraftSchema,
]);

export type WeddingDraft = z.infer<typeof weddingDraftSchema>;
export type CorporateDraft = z.infer<typeof corporateDraftSchema>;
export type FamilyDraft = z.infer<typeof familyDraftSchema>;
export type DraftContent = z.infer<typeof draftContentSchema>;

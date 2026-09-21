import { z } from "zod";

import {
  corporateContentSchema,
  familyContentSchema,
  weddingContentSchema,
} from "./categories";
import { FIELD_LIMITS as L } from "./field-limits";
import {
  envelopeSchema,
  noDangerousUrlScheme,
  personSchema,
  storyEntrySchema,
} from "./shared";

/**
 * Skema DRAFT (longgar) — dipakai saat autosave. Field wajib direlaksasi menjadi
 * opsional agar draft yang belum lengkap tetap bisa disimpan, TAPI batas panjang,
 * bentuk `storage_path` (tolak URL vendor), format YouTube, dan batas jumlah array
 * TETAP ditegakkan (mencegah JSONB liar). Validasi LENGKAP dijalankan saat
 * preview/aktivasi memakai skema strict (`invitationContentSchema`).
 */

const personDraftSchema = personSchema.extend({
  name: z.string().trim().max(L.person.name).optional(),
});

const storyDraftSchema = storyEntrySchema.extend({
  title: z.string().trim().max(L.storyEntry.title).optional(),
  narrative: z.string().trim().max(L.storyEntry.narrative).optional(),
});

/**
 * PIC draft: email direlaksasi jadi string biasa agar autosave tak gagal saat
 * pengguna masih mengetik (mis. "budi@"). Format email penuh divalidasi saat
 * aktivasi (skema strict `corporateContentSchema.pic.email`). Selaras dgn cara
 * `draftCommonFields` merelaksasi youtube/livestream.
 */
const picDraftSchema = z
  .object({
    name: z.string().trim().max(L.pic.name).optional(),
    phone: z.string().trim().max(L.pic.phone).optional(),
    email: z.string().trim().max(L.pic.email).optional(),
  })
  .optional();

/**
 * Amplop draft: baris rekening/e-wallet boleh SETENGAH JADI. Tombol "Tambah
 * rekening" menambah baris kosong, dan skema strict (`bankAccountSchema`
 * min(1)) menolaknya — dulu itu membuat SELURUH autosave ditolak sampai ketiga
 * kolomnya terisi, sehingga perubahan di langkah lain ikut tak tersimpan
 * (DECISIONS #41). Aman untuk tamu: render (`coerceEnvelope`) membuang baris
 * yang belum lengkap. Batas panjang & jumlah baris tetap ditegakkan.
 */
const bankDraftSchema = z.object({
  bank: z.string().trim().max(L.bank.bank).optional(),
  number: z.string().trim().max(L.bank.number).optional(),
  holder: z.string().trim().max(L.bank.holder).optional(),
});

const ewalletDraftSchema = z.object({
  provider: z.string().trim().max(L.ewallet.provider).optional(),
  number: z.string().trim().max(L.ewallet.number).optional(),
  holder: z.string().trim().max(L.ewallet.holder).optional(),
});

const envelopeDraftSchema = envelopeSchema.extend({
  banks: z.array(bankDraftSchema).max(L.envelope.banks).default([]),
  ewallets: z.array(ewalletDraftSchema).max(L.envelope.ewallets).default([]),
});

/**
 * Field format-ketat direlaksasi saat draft agar autosave tidak gagal saat
 * pengguna masih mengetik (URL/quote belum lengkap). Batas panjang tetap ada;
 * format URL/YouTube divalidasi penuh saat preview/aktivasi.
 */
const draftCommonFields = {
  quote: z
    .object({
      text: z.string().trim().max(L.quote.text).optional(),
      source: z.string().trim().max(L.quote.source).optional(),
    })
    .optional(),
  // Draft longgar (autosave saat mengetik) TAPI skema berbahaya tetap ditolak
  // agar tak pernah tersimpan; format https/host penuh divalidasi saat aktivasi.
  youtubeUrl: z
    .string()
    .trim()
    .max(L.common.youtubeUrl)
    .refine(noDangerousUrlScheme, "Tautan tidak valid")
    .optional(),
  livestreamUrl: z
    .string()
    .trim()
    .max(L.common.livestreamUrl)
    .refine(noDangerousUrlScheme, "Tautan tidak valid")
    .optional(),
  // Factory default: tiap parse mendapat array SEGAR (lihat `commonContentFields`).
  envelope: envelopeDraftSchema.default(() => ({
    enabled: false,
    banks: [],
    ewallets: [],
  })),
};

export const weddingDraftSchema = weddingContentSchema.extend({
  groom: personDraftSchema,
  bride: personDraftSchema,
  story: z.array(storyDraftSchema).max(L.wedding.story).default([]),
  ...draftCommonFields,
});

export const corporateDraftSchema = corporateContentSchema.extend({
  eventName: z.string().trim().max(L.corporate.eventName).optional(),
  pic: picDraftSchema,
  agenda: z.array(storyDraftSchema).max(L.corporate.agenda).default([]),
  ...draftCommonFields,
});

export const familyDraftSchema = familyContentSchema.extend({
  eventName: z.string().trim().max(L.family.eventName).optional(),
  wishes: z.array(storyDraftSchema).max(L.family.wishes).default([]),
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

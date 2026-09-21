import { z } from "zod";

import { FIELD_LIMITS as L } from "./field-limits";

import {
  commonContentFields,
  optionalFormat,
  personSchema,
  storagePathSchema,
  storyEntrySchema,
} from "./shared";

/**
 * Skema `content` per kategori acara (SPEC §4.4). Disatukan sebagai
 * discriminated union pada field `category` (selaras kolom `invitations.category`).
 * Theme menerima hasil parse ini sebagai bagian dari `InvitationData`.
 */

// --- Pernikahan --------------------------------------------------------------
export const weddingContentSchema = z.object({
  category: z.literal("wedding"),
  title: z.string().trim().max(L.wedding.title).optional(),
  groom: personSchema,
  bride: personSchema,
  story: z.array(storyEntrySchema).max(L.wedding.story).default([]),
  ...commonContentFields,
});

// --- Corporate ---------------------------------------------------------------
export const corporateContentSchema = z.object({
  category: z.literal("corporate"),
  eventName: z
    .string()
    .trim()
    .min(1, "Nama acara wajib diisi")
    .max(L.corporate.eventName),
  organizer: z.string().trim().max(L.corporate.organizer).optional(),
  description: z.string().trim().max(L.corporate.description).optional(),
  logo: storagePathSchema.optional(),
  pic: z
    .object({
      name: z.string().trim().max(L.pic.name).optional(),
      phone: z.string().trim().max(L.pic.phone).optional(),
      // "" (input kosong RHF) → undefined agar autosave tak gagal saat email
      // dibiarkan kosong; format tetap divalidasi bila diisi.
      email: optionalFormat(z.email("Email PIC tidak valid").max(L.pic.email)),
    })
    .optional(),
  agenda: z.array(storyEntrySchema).max(L.corporate.agenda).default([]),
  ...commonContentFields,
});

// --- Keluarga ----------------------------------------------------------------
export const familyContentSchema = z.object({
  category: z.literal("family"),
  eventName: z
    .string()
    .trim()
    .min(1, "Nama acara wajib diisi")
    .max(L.family.eventName),
  celebrant: z.string().trim().max(L.family.celebrant).optional(),
  parents: z.string().trim().max(L.family.parents).optional(),
  wishes: z.array(storyEntrySchema).max(L.family.wishes).default([]),
  ...commonContentFields,
});

/** Union tervalidasi berdasarkan `category`. */
export const invitationContentSchema = z.discriminatedUnion("category", [
  weddingContentSchema,
  corporateContentSchema,
  familyContentSchema,
]);

export type WeddingContent = z.infer<typeof weddingContentSchema>;
export type CorporateContent = z.infer<typeof corporateContentSchema>;
export type FamilyContent = z.infer<typeof familyContentSchema>;
export type InvitationContent = z.infer<typeof invitationContentSchema>;

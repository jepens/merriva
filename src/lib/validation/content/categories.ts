import { z } from "zod";

import {
  commonContentFields,
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
  title: z.string().trim().max(160).optional(),
  groom: personSchema,
  bride: personSchema,
  story: z.array(storyEntrySchema).max(20).default([]),
  ...commonContentFields,
});

// --- Corporate ---------------------------------------------------------------
export const corporateContentSchema = z.object({
  category: z.literal("corporate"),
  eventName: z.string().trim().min(1, "Nama acara wajib diisi").max(160),
  organizer: z.string().trim().max(160).optional(),
  description: z.string().trim().max(2000).optional(),
  logo: storagePathSchema.optional(),
  pic: z
    .object({
      name: z.string().trim().max(120).optional(),
      phone: z.string().trim().max(40).optional(),
      email: z.email("Email PIC tidak valid").max(160).optional(),
    })
    .optional(),
  agenda: z.array(storyEntrySchema).max(30).default([]),
  ...commonContentFields,
});

// --- Keluarga ----------------------------------------------------------------
export const familyContentSchema = z.object({
  category: z.literal("family"),
  eventName: z.string().trim().min(1, "Nama acara wajib diisi").max(160),
  celebrant: z.string().trim().max(120).optional(),
  parents: z.string().trim().max(200).optional(),
  wishes: z.array(storyEntrySchema).max(20).default([]),
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

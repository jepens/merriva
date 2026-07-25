import { z } from "zod";

/** Input pembuatan draft undangan (SPEC Flow A: pilih kategori → pilih tema). */
export const createInvitationSchema = z.object({
  category: z.enum(["wedding", "corporate", "family"]),
  themeSlug: z.string().trim().min(1, "Pilih tema terlebih dahulu").max(60),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

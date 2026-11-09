"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { copy } from "@/lib/copy";
import { isUuid } from "@/lib/id";
import { SHARE_TEMPLATE_MAX } from "@/lib/share-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const templateField = z
  .string()
  .max(SHARE_TEMPLATE_MAX, copy.dashboard.sebar.templateTooLong)
  .refine((v) => v.includes("{link}"), copy.dashboard.sebar.templateNeedsLink)
  .nullable();

const schema = z.object({
  personal: templateField,
  general: templateField,
});

export type SaveShareTemplatesResult =
  { status: "success" } | { status: "error"; message: string };

/**
 * Simpan template pesan Sebar personal & umum (DECISIONS #120). Pola wajib:
 * auth → validasi id & Zod → operasi (kepemilikan ditegakkan RLS
 * `invitations_update` + GRANT kolom) → revalidate.
 *
 * Teks yang SAMA dengan bawaan disimpan sebagai NULL, supaya perbaikan teks
 * bawaan di masa depan tetap sampai ke undangan yang tak pernah menyuntingnya.
 * Template wajib memuat `{link}` — pesan tanpa tautan tak mengundang apa pun.
 */
export async function saveShareTemplatesAction(
  invitationId: string,
  input: { personal: string | null; general: string | null },
): Promise<SaveShareTemplatesResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: copy.common.error };
  if (!isUuid(invitationId))
    return { status: "error", message: copy.common.error };

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? copy.common.error,
    };
  }

  const t = copy.dashboard.sebar;
  const normal = (v: string | null, bawaan: string) =>
    v === null || v.trim() === bawaan.trim() ? null : v;

  const { data, error } = await supabase
    .from("invitations")
    .update({
      share_template: normal(parsed.data.personal, t.defaultTemplate),
      share_template_general: normal(
        parsed.data.general,
        t.defaultTemplateGeneral,
      ),
    })
    .eq("id", invitationId)
    // Undangan yang sudah di-purge (retensi UU PDP) tak menerima data pribadi
    // baru — purge tak akan berjalan kedua kalinya untuk mengosongkannya.
    .is("purged_at", null)
    .select("id, slug");

  // 0 baris = bukan milik pemilik (RLS) atau tak ada — jangan lapor sukses.
  if (error || !data || data.length === 0) {
    return { status: "error", message: copy.common.error };
  }

  revalidatePath(`/dashboard/undangan/${invitationId}/sebar`);
  // Simpanan ini menaikkan `updated_at` (trigger) = versi `?v` og:image. Tanpa
  // revalidate, halaman undangan (ISR) terus memancarkan `?v` lama sementara
  // halaman Sebar memanaskan yang baru — pemanasan meleset (DECISIONS #122).
  const slug = data[0]?.slug;
  if (slug) revalidatePath(`/${slug}`);
  return { status: "success" };
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isUuid } from "@/lib/id";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adminPackageSchema, adminThemeSchema } from "@/lib/validation/admin";
import { logAdminAction } from "@/server/admin/log";
import { requireAdmin } from "@/server/guards/auth";
import type { InvitationCategory } from "@/types";

/**
 * CRUD katalog admin (SPEC §4.9): paket (harga & limit) + metadata tema. Pola:
 * **auth(admin) → validasi Zod → update (service_role) → audit → revalidate**.
 * Perubahan paket me-revalidate landing (`/`) → "harga langsung tercermin di
 * landing & checkout tanpa deploy" (checkout membaca harga live saat runtime).
 * Update non-lifecycle satu-baris → audit best-effort (bukan RPC atomik).
 */

/** Checkbox HTML: terkirim "on" saat dicentang, absen bila tidak. */
function checked(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

/** Edit paket (identitas `code` tetap — terikat enum checkout). */
export async function adminUpdatePackageAction(
  code: string,
  formData: FormData,
): Promise<never> {
  const adminUser = await requireAdmin();

  // Bila "tanpa batas" dicentang, `maxGuests` DIABAIKAN (→ null). Isi placeholder
  // valid agar field yang diabaikan tak menggagalkan validasi (mis. admin
  // mengosongkannya saat mencentang tanpa-batas).
  const guestsUnlimited = checked(formData, "guestsUnlimited");
  const parsed = adminPackageSchema.safeParse({
    name: formData.get("name"),
    priceIdr: formData.get("priceIdr"),
    durationMonths: formData.get("durationMonths"),
    maxPhotos: formData.get("maxPhotos"),
    maxGuests: guestsUnlimited ? 1 : formData.get("maxGuests"),
    guestsUnlimited,
    isActive: checked(formData, "isActive"),
    youtube: checked(formData, "youtube"),
    allThemes: checked(formData, "allThemes"),
    watermark: checked(formData, "watermark"),
  });
  if (!parsed.success) redirect("/admin/paket?msg=pkg_invalid");
  const v = parsed.data;

  const limits = {
    max_photos: v.maxPhotos,
    max_guests: v.guestsUnlimited ? null : v.maxGuests,
    youtube: v.youtube,
    all_themes: v.allThemes,
    watermark: v.watermark,
  };

  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from("packages")
    .update({
      name: v.name,
      price_idr: v.priceIdr,
      duration_months: v.durationMonths,
      is_active: v.isActive,
      limits,
    })
    .eq("code", code)
    .select("id")
    .maybeSingle();
  if (error || !row) redirect("/admin/paket?msg=pkg_failed");

  await logAdminAction(admin, adminUser.id, {
    action: "package.update",
    targetType: "package",
    targetId: row.id,
    detail: { code, price_idr: v.priceIdr, is_active: v.isActive, limits },
  });

  revalidatePath("/"); // landing membaca harga paket
  revalidatePath("/admin/paket");
  revalidatePath("/admin");
  redirect("/admin/paket?msg=pkg_ok");
}

/** Edit metadata tema (kode tema tetap di repo → hanya metadata). */
export async function adminUpdateThemeAction(
  themeId: string,
  formData: FormData,
): Promise<never> {
  const adminUser = await requireAdmin();
  if (!isUuid(themeId)) redirect("/admin/tema");

  const parsed = adminThemeSchema.safeParse({
    name: formData.get("name"),
    categories: formData.getAll("categories").map(String),
    tier: formData.get("tier"),
    sortOrder: formData.get("sortOrder"),
    isActive: checked(formData, "isActive"),
  });
  if (!parsed.success) redirect("/admin/tema?msg=theme_invalid");
  const v = parsed.data;

  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from("themes")
    .update({
      name: v.name,
      categories: v.categories as InvitationCategory[],
      tier: v.tier,
      sort_order: v.sortOrder,
      is_active: v.isActive,
    })
    .eq("id", themeId)
    .select("id")
    .maybeSingle();
  if (error || !row) redirect("/admin/tema?msg=theme_failed");

  await logAdminAction(admin, adminUser.id, {
    action: "theme.update",
    targetType: "theme",
    targetId: themeId,
    detail: { tier: v.tier, is_active: v.isActive, sort_order: v.sortOrder },
  });

  revalidatePath("/"); // katalog tema di landing
  revalidatePath("/admin/tema");
  revalidatePath("/admin");
  redirect("/admin/tema?msg=theme_ok");
}

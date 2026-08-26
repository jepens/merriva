import { resolveLimits, type PackageLimits } from "@/lib/limits";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import {
  getThemeCatalogMeta,
  type ThemeCatalogMeta,
} from "@/themes/catalog-meta";
import { getThemeDemoLoader } from "@/themes/demo-data-registry";
import type { InvitationCategory, ThemeTier } from "@/types";

/**
 * Sumber data katalog publik (landing, `/tema`, `/harga`). Dibaca via client anon
 * TANPA cookie → halaman tetap dirender STATIS (ISR) dan disinkron on-demand saat
 * admin mengubah `packages`/`themes` (`revalidatePath` di admin-catalog). Harga di
 * halaman SELALU cerminan tabel `packages` (SPEC §4.1 kriteria terima).
 */

export interface MarketingPackage {
  code: string;
  name: string;
  priceIdr: number;
  durationMonths: number;
  limits: PackageLimits;
}

export interface MarketingTheme {
  slug: string;
  name: string;
  categories: InvitationCategory[];
  tier: ThemeTier;
  /** true bila tema punya data contoh → tombol "Lihat demo" ke `/preview/tema/{slug}`. */
  hasDemo: boolean;
  /** Palet & ornamen untuk poster katalog (identitas visual, dari kode tema). */
  meta: ThemeCatalogMeta;
}

/** Paket aktif urut harga menaik (Basic → Premium). */
export async function getActivePackages(): Promise<MarketingPackage[]> {
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("packages")
    .select("code, name, price_idr, duration_months, limits")
    .eq("is_active", true)
    .eq("kind", "invitation") // add-on Momen tak muncul di harga undangan
    .order("price_idr", { ascending: true });

  // Lempar bila query gagal (DB tak terjangkau saat build/revalidate) — jangan
  // menelan error jadi katalog kosong yang ter-cache statis. Next mempertahankan
  // render statis terakhir yang baik (atau build gagal keras) alih-alih menyajikan
  // harga kosong yang melanggar kontrak "harga SELALU dari packages" (SPEC §4.1).
  if (error) throw error;

  return (data ?? []).map((p) => ({
    code: p.code,
    name: p.name,
    priceIdr: p.price_idr,
    durationMonths: p.duration_months,
    limits: resolveLimits(p.limits),
  }));
}

/** Tema aktif urut `sort_order` — hanya yang komponennya punya demo di repo. */
export async function getActiveThemes(): Promise<MarketingTheme[]> {
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("themes")
    .select("slug, name, categories, tier, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error; // sama seperti getActivePackages — jangan cache katalog kosong

  return (data ?? []).map((t) => ({
    slug: t.slug,
    name: t.name,
    categories: t.categories,
    tier: t.tier,
    hasDemo: getThemeDemoLoader(t.slug) !== null,
    meta: getThemeCatalogMeta(t.slug),
  }));
}

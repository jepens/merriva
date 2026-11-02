import { hexToRgb, relativeLuminance } from "@/lib/customizer/contrast-guard";
import {
  defaultCustomSettings,
  type CustomSettings,
  type ThemeVariant,
} from "@/lib/customizer/theme-options";
import { resolveLimits, type PackageLimits } from "@/lib/limits";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import {
  getThemeCatalogMeta,
  type ThemeCatalogMeta,
} from "@/themes/catalog-meta";
import { getThemeDemoLoader } from "@/themes/demo-data-registry";
import { getThemeOptions } from "@/themes/theme-options-registry";
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
  /**
   * Varian yang diwakili kartu — hanya di katalog `/tema` (`expandThemeVariants`).
   * Absen = satu kartu per tema (landing, tema tanpa `options.ts`).
   */
  variant?: MarketingThemeVariant;
}

/** Varian warna yang diwakili satu kartu katalog (THEME-WAVE3 §4). */
export interface MarketingThemeVariant {
  id: string;
  name: string;
  /** Varian bawaan (index 0 `options.ts`) — rupa yang dipotret thumbnail tema. */
  isDefault: boolean;
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

/**
 * Palet poster kartu varian NON-bawaan: kertas/tinta/aksen varian itu sendiri +
 * ornamen tema induk. `dark` diturunkan dari luminans kertas: < 0,18 ≈ titik
 * tengah persepsi (kontras ke putih & ke hitam seimbang) — kertas noir, marawa,
 * meihua jatuh di bawahnya. Garis mengikuti pola meta tema: tema gelap dari
 * aksen (emas) 30%, tema terang dari tinta 16%.
 */
function variantPosterMeta(
  base: ThemeCatalogMeta,
  v: ThemeVariant,
): ThemeCatalogMeta {
  const dark = relativeLuminance(v.paper) < 0.18;
  const { r, g, b } = hexToRgb(dark ? v.acc : v.ink);
  return {
    bg: v.paper,
    ink: v.ink,
    accent: v.acc,
    line: `rgba(${r},${g},${b},${dark ? 0.3 : 0.16})`,
    ornament: base.ornament,
    dark,
  };
}

/**
 * Katalog `/tema` = satu kartu per (tema × varian terkurasi) — THEME-WAVE3 §4.
 * Varian dibaca dari `options.ts` (satu sumber dgn customizer, tanpa tabel
 * baru); kategori & tier diwarisi tema induk sehingga saringan tetap bekerja;
 * urutan = tema (`sort_order`) lalu varian (urutan options). Kartu bawaan tetap
 * memakai meta kurasi tema. Tema tanpa options — atau tanpa demo, karena kartu
 * varian ada untuk dibuka pratinjaunya — tetap satu kartu. Landing TIDAK memakai
 * ini: tetap 6 kartu per tema (anggaran Lighthouse landing).
 */
export function expandThemeVariants(
  themes: readonly MarketingTheme[],
): MarketingTheme[] {
  return themes.flatMap((theme) => {
    const variants = theme.hasDemo
      ? getThemeOptions(theme.slug)?.variants
      : undefined;
    if (!variants?.length) return [theme];
    return variants.map((v, i) => ({
      ...theme,
      variant: { id: v.id, name: v.name, isDefault: i === 0 },
      meta: i === 0 ? theme.meta : variantPosterMeta(theme.meta, v),
    }));
  });
}

/** Nama parameter query varian — penaut (kartu, iframe) & pembaca memakai ini. */
export const VARIANT_PARAM = "variant";

/**
 * Tautan pratinjau `/preview/tema/{slug}`. `variant` WAJIB id yang sudah lolos
 * whitelist (`options.ts` / `pickPreviewVariant`) — fungsi ini tidak menyaring.
 */
export function themePreviewHref(
  slug: string,
  opts: { variant?: string | null; embed?: boolean } = {},
): string {
  const q = new URLSearchParams();
  if (opts.embed) q.set("embed", "1");
  if (opts.variant) q.set(VARIANT_PARAM, opts.variant);
  const qs = q.toString();
  return `/preview/tema/${slug}${qs ? `?${qs}` : ""}`;
}

/** Varian `?variant=` yang lolos whitelist pratinjau tema. */
export interface PreviewVariant {
  id: string;
  name: string;
  /**
   * `settings.custom` untuk data demo. null pada varian bawaan: demo tetap lewat
   * cabang legacy — persis rupa thumbnail & pratinjau tanpa `?variant=`.
   */
  custom: CustomSettings | null;
}

/**
 * Whitelist `?variant=` pratinjau `/preview/tema/{slug}`: hanya id yang ADA di
 * `options.ts` tema itu. Absen, array, id milik tema lain, atau isian liar →
 * null (varian bawaan). Yang dikembalikan selalu nilai milik options, tak pernah
 * input mentah — tak ada yang terpantul ke HTML/URL. `custom` dibentuk LENGKAP:
 * objek parsial `{ variant }` gagal parse `settings` di jalur lain dan tema
 * diam-diam jatuh ke bawaan.
 */
export function pickPreviewVariant(
  slug: string,
  raw: unknown,
): PreviewVariant | null {
  if (typeof raw !== "string") return null;
  const options = getThemeOptions(slug);
  if (!options) return null;
  const index = options.variants.findIndex((v) => v.id === raw);
  const variant = options.variants[index];
  if (!variant) return null;
  return {
    id: variant.id,
    name: variant.name,
    custom:
      index === 0
        ? null
        : { ...defaultCustomSettings(options), variant: variant.id },
  };
}

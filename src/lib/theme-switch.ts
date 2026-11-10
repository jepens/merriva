import type { PackageLimits } from "@/lib/limits";

/**
 * Aturan ganti tema (SPEC §4.4 "Ganti tema", DECISIONS #124) — MURNI, dipakai
 * halaman pilih tema, pratinjau `?tema=`, dan aksi server. DB menegakkan aturan
 * tema sekali lagi (trigger `enforce_theme_change`); fungsi ini cerminnya untuk
 * TAMPILAN (kartu terkunci) dan pesan yang ramah.
 */

/** Pola slug tema yang sah (sama dengan `themeFromParam`). */
export const THEME_SLUG_RE = /^[a-z0-9-]{1,64}$/;

/** Undangan yang boleh berganti tema: bukan `suspended`, belum di-purge. */
export function bolehGantiTema(inv: {
  status: string;
  purged_at: string | null;
}): boolean {
  return inv.purged_at === null && inv.status !== "suspended";
}

/**
 * Belum pernah dibayar: tanpa paket dan masih `draft`/`pending_payment`. Hanya
 * undangan seperti ini yang boleh mencoba tema premium tanpa paket Premium —
 * cermin cabang #124 di trigger. Order `pending` berpaket non-Premium tetap
 * ditolak DB (pesan kembali lewat aksi).
 */
export function belumPernahDibayar(inv: {
  package_id: string | null;
  status: string;
}): boolean {
  return (
    inv.package_id === null &&
    (inv.status === "draft" || inv.status === "pending_payment")
  );
}

/** Kartu tema premium terkunci untuk undangan ini? */
export function temaPremiumTerkunci(
  tier: string,
  inv: { package_id: string | null; status: string },
  limits: Pick<PackageLimits, "allThemes">,
): boolean {
  return tier === "premium" && !belumPernahDibayar(inv) && !limits.allThemes;
}

/**
 * `settings` sesudah ganti tema: `custom` (Kustomisasi Tampilan milik tema LAMA)
 * dibuang — tema baru tampil dengan bawaannya (keputusan pemilik). Isian lain
 * (lagu, zona waktu, toggle section, moderasi) disalin APA ADANYA tanpa
 * di-parse: menulis ulang hasil parse yang gagal akan menghapusnya.
 */
export function settingsTanpaKustom(
  settings: unknown,
): Record<string, unknown> {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return {};
  }
  const salinan: Record<string, unknown> = {
    ...(settings as Record<string, unknown>),
  };
  delete salinan.custom;
  return salinan;
}

/**
 * Resolver `settings.custom` → token render (CUSTOMIZER-SPEC §8). MURNI &
 * deterministik: dipakai di render publik (server) DAN pratinjau editor agar
 * "editor ≡ halaman publik" untuk settings yang sama. Penjaga kontras dihitung
 * DI SINI (server) juga — bukan hanya di editor — sehingga data apa pun yang
 * tersimpan tetap aman dirender (defense-in-depth; SPEC §4).
 *
 * Aturan section = permutasi lengkap; posisi terkunci (`reorder:false`) dan
 * "wajib tampil" (`toggle:false`) ditegakkan ulang di sini. Bila `custom`
 * cacat/absen → jatuh ke bawaan tema (order asli, semua tampil) → tak pernah
 * merender tata letak rusak. Urutan yang dikembalikan = DOM ORDER (bukan CSS
 * order): tema menyusun array section sesuai ini.
 */
import { safeTextColor, textOnAccent } from "./contrast-guard";
import type { CustomSettings, ThemeOptions } from "./theme-options";

export interface ResolvedSection {
  id: string;
  visible: boolean;
}

export interface ResolvedAppearance {
  variantId: string;
  /** Warna aksen dekoratif (mentah dari varian atau custom). */
  accent: string;
  /** Aksen aman untuk TEKS di atas kertas (WCAG AA ≥ 4.5). */
  accentText: string;
  /** Warna teks di ATAS elemen beraksen (putih/ink). */
  onAccent: string;
  paper: string;
  ink: string;
  /** true bila `accentText` digelapkan dari `accent` demi lolos AA. */
  accentSnapped: boolean;
  /** CSS var pasangan font terpilih, mis. "var(--er-disp-b)". */
  dispVar: string;
  bodyVar: string;
  /** Gaya per-section terpilih (key → nilai valid). */
  styles: Record<string, string>;
  /** Urutan render + visibilitas (DOM order). */
  sections: ResolvedSection[];
  motion: "full" | "calm";
  grain: boolean;
}

/**
 * Lengkapi urutan TERSIMPAN dengan section yang ditambahkan ke tema SESUDAH
 * pemilik menyimpannya (mis. `video`, FASE J). Tiap id yang hilang disisipkan
 * tepat sesudah tetangga bawaannya yang terdekat di urutan pemilik, dan tampil.
 *
 * Tanpa ini, menambah satu section ke `options.ts` membuat SETIAP
 * `settings.custom.sections` yang sudah tersimpan bukan lagi permutasi lengkap:
 * render jatuh ke urutan bawaan (urutan & section yang disembunyikan pemilik
 * hilang tanpa jejak) dan editor Tampilan mengirim daftar yang ditolak server,
 * sehingga pemilik tak bisa menyimpan apa pun lagi. Dipakai render DAN editor.
 *
 * Hanya MENAMBAH. Id yang tak dikenal tema (section yang dibuang) tetap ada,
 * dan permutasinya tetap gagal di bawah — perilaku lama, sengaja tak diubah.
 */
export function lengkapiUrutanSection(
  options: ThemeOptions,
  saved: ResolvedSection[],
): ResolvedSection[] {
  const hasil = saved.slice();
  options.sections.forEach((opt, i) => {
    if (hasil.some((s) => s.id === opt.id)) return;
    let pos = 0;
    for (let j = i - 1; j >= 0; j--) {
      const idx = hasil.findIndex((s) => s.id === options.sections[j]?.id);
      if (idx >= 0) {
        pos = idx + 1;
        break;
      }
    }
    hasil.splice(pos, 0, { id: opt.id, visible: true });
  });
  return hasil;
}

/**
 * Kustomisasi yang BOLEH tampil untuk paket yang berlaku SEKARANG (DECISIONS
 * #116, SPEC §2 "Penegakan paket"). Cermin gerbang simpan
 * `buildCustomSettingsSchema`: bukan Premium → pasangan font bawaan, gaya
 * bawaan, tanpa aksen kustom. Aksen kustom juga gugur bila tema tak
 * mendukungnya — gerbang simpan menolaknya, tetapi render dulu memakainya apa
 * adanya. Varian, urutan section, motion & grain terbuka untuk semua paket dan
 * tak disentuh.
 *
 * Kenapa di render, bukan hanya saat simpan: undangan bisa turun paket lewat
 * jalur SAH (refund upgrade, perpanjangan dengan paket lebih rendah, alih
 * kepemilikan, peran Pro dicabut) dan `settings` bisa ditulis di luar aksi
 * Tampilan. MURNI — data tersimpan tak berubah, jadi naik paket mengembalikan
 * semuanya.
 */
export function sesuaikanKePaket(
  options: ThemeOptions,
  custom: CustomSettings,
  premium: boolean,
): CustomSettings {
  const accent =
    premium && options.supports.customAccent ? custom.accent : null;
  if (premium) return accent === custom.accent ? custom : { ...custom, accent };
  const styles: Record<string, string> = {};
  for (const [key, values] of Object.entries(options.styles)) {
    styles[key] = values[0] ?? "";
  }
  return {
    ...custom,
    accent: null,
    fontPair: options.fontPairs[0]?.id ?? custom.fontPair,
    styles,
  };
}

/**
 * Pasangan `sesuaikanKePaket` di jalur SIMPAN Tampilan: tanpa Premium, gerbang
 * simpan hanya menerima nilai BAWAAN untuk font, gaya, dan aksen (editor pun
 * memuatnya sudah disesuaikan), jadi tiga isian itu tak membawa pilihan apa pun
 * dari pemilik. Nilai yang TERSIMPAN dipertahankan — tetap tersembunyi saat
 * render, dan kembali bila naik paket (SPEC §2 "Penegakan paket": tidak
 * dihapus). Tanpa ini, satu simpanan varian/urutan oleh pemilik Basic (alih
 * kepemilikan, peran Pro dicabut) menimpa pilihan Premium selamanya.
 */
export function pertahankanPilihanPremium(
  next: CustomSettings,
  stored: CustomSettings | null | undefined,
  premium: boolean,
): CustomSettings {
  if (premium || !stored) return next;
  return {
    ...next,
    fontPair: stored.fontPair,
    // Aksen kustom melekat pada variannya: editor Premium pun mengosongkannya
    // saat varian diganti, jadi ganti varian di sini juga melepasnya.
    accent: next.variant === stored.variant ? stored.accent : null,
    styles: stored.styles,
  };
}

function resolveSections(
  options: ThemeOptions,
  custom: CustomSettings | null | undefined,
): ResolvedSection[] {
  const defaultOrder = options.sections.map((s) => ({
    id: s.id,
    visible: true,
  }));
  if (!custom?.sections || custom.sections.length === 0) return defaultOrder;
  const wanted = lengkapiUrutanSection(options, custom.sections);

  const optById = new Map(options.sections.map((s) => [s.id, s]));
  const ids = wanted.map((s) => s.id);
  const isPermutation =
    ids.length === optById.size &&
    new Set(ids).size === optById.size &&
    ids.every((id) => optById.has(id));
  if (!isPermutation) return defaultOrder;

  // Posisi terkunci (`reorder:false`) wajib di index bawaannya; jika digeser →
  // anggap data cacat, kembali ke bawaan (aman).
  for (let i = 0; i < options.sections.length; i++) {
    const opt = options.sections[i];
    if (opt && !opt.reorder && ids[i] !== opt.id) return defaultOrder;
  }

  return wanted.map((s) => {
    const opt = optById.get(s.id);
    // `toggle:false` (wajib tampil) tak boleh disembunyikan.
    return { id: s.id, visible: opt && !opt.toggle ? true : s.visible };
  });
}

export function resolveAppearance(
  options: ThemeOptions,
  custom: CustomSettings | null | undefined,
): ResolvedAppearance {
  const variant =
    (custom && options.variants.find((v) => v.id === custom.variant)) ||
    options.variants[0];
  if (!variant) throw new Error("ThemeOptions minimal punya 1 variant");

  const fontPair =
    (custom && options.fontPairs.find((f) => f.id === custom.fontPair)) ||
    options.fontPairs[0];
  if (!fontPair) throw new Error("ThemeOptions minimal punya 1 fontPair");

  const accent = custom?.accent ?? variant.acc;
  const guard = safeTextColor(accent, variant.paper);
  const onAccent = textOnAccent(accent, variant.ink);

  const styles: Record<string, string> = {};
  for (const [key, values] of Object.entries(options.styles)) {
    const chosen = custom?.styles?.[key];
    styles[key] =
      chosen && values.includes(chosen) ? chosen : (values[0] ?? "");
  }

  return {
    variantId: variant.id,
    accent,
    accentText: guard.color,
    onAccent,
    paper: variant.paper,
    ink: variant.ink,
    accentSnapped: guard.snapped,
    dispVar: fontPair.dispVar,
    bodyVar: fontPair.bodyVar,
    styles,
    sections: resolveSections(options, custom),
    motion: custom?.motion === "calm" ? "calm" : "full",
    grain: custom ? custom.grain !== false : true,
  };
}

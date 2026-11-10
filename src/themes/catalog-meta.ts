/**
 * Identitas VISUAL tiap tema untuk poster katalog marketing (`/tema`, landing).
 *
 * Pembagian sumber kebenaran (cermin dari pemisahan yang sudah ada di proyek):
 *  - `themes` di DB = metadata yang DIEDIT admin (nama, kategori, tier, urutan,
 *    aktif) — otoritatif untuk "tema mana yang tampil".
 *  - file ini = palet & ornamen khas tiap tema (identitas desain, hidup bersama
 *    kode tema di `src/themes/{slug}/`) — otoritatif untuk "seperti apa rupanya".
 *
 * Poster katalog = spesimen tipografi ringan (nama tema pada paletnya sendiri +
 * ornamen) — TANPA gambar/iframe/font per-tema, agar landing tetap ringan
 * (Lighthouse ≥ 90). Pratinjau hidup sesungguhnya satu ketuk jauhnya via
 * `/preview/tema/{slug}`. Warna dipilih agar teks `ink` di atas `bg` lolos
 * kontras AA. `dark: true` menandai poster berlatar gelap (mis. Noir).
 */
export interface ThemeCatalogMeta {
  /** Latar poster. */
  bg: string;
  /** Warna teks utama (nama tema) — kontras AA di atas `bg`. */
  ink: string;
  /** Aksen khas (eyebrow, ornamen, garis). */
  accent: string;
  /** Garis tipis divider/bingkai. */
  line: string;
  /** Glyph ornamen penanda tema pada divider poster. */
  ornament: string;
  /** true bila latar gelap (poster dark, mis. Noir dark-luxe). */
  dark?: boolean;
  /**
   * Latar PANEL mockup kartu tema (`ThemeMockup`) bila harus beda dari `bg` —
   * tema gelap butuh panel terang agar bezel/ponsel gelap tetap kontras (tak
   * melebur ke latar). Tak memengaruhi poster spesimen (tetap pakai `bg`).
   * Default: `bg`.
   */
  panel?: string;
}

/** Poster netral (paper + marigold brand) untuk slug tanpa meta khusus. */
export const FALLBACK_CATALOG_META: ThemeCatalogMeta = {
  bg: "#fbf9f6",
  ink: "#241f2b",
  accent: "#c68a3c",
  line: "rgba(36,31,43,0.14)",
  ornament: "◆",
};

export const themeCatalogMeta: Record<string, ThemeCatalogMeta> = {
  "eternal-rose": {
    bg: "#fbf6f3",
    ink: "#4a3a39",
    accent: "#b76e79",
    line: "rgba(140,75,86,0.18)",
    ornament: "❀",
  },
  meridian: {
    bg: "#f7f4ec",
    ink: "#0f1826",
    accent: "#a97e35",
    line: "rgba(15,24,38,0.14)",
    ornament: "❖",
  },
  barakah: {
    bg: "#f4efe2",
    ink: "#0e3b30",
    accent: "#b78d3f",
    line: "rgba(14,59,48,0.18)",
    ornament: "۞",
  },
  aria: {
    bg: "#f6f5f1",
    ink: "#1b1a17",
    accent: "#7c766b",
    line: "rgba(27,26,23,0.16)",
    ornament: "·",
  },
  verdant: {
    bg: "#f2efe4",
    ink: "#46583a",
    accent: "#9c6b62",
    line: "rgba(70,88,58,0.20)",
    ornament: "❧",
  },
  noir: {
    bg: "#14110f",
    ink: "#f1e7d6",
    accent: "#c9a86a",
    line: "rgba(201,168,106,0.30)",
    ornament: "✦",
    dark: true,
    // Champagne hangat → ponsel gelap + tinta emas Noir "pop" mewah.
    panel: "#e9e1d3",
  },
  festa: {
    bg: "#fff6ec",
    ink: "#5c3a2e",
    accent: "#c96f4a",
    line: "rgba(92,58,46,0.18)",
    ornament: "✽",
  },
  lumina: {
    bg: "#faf8f4",
    ink: "#2a2723",
    accent: "#9a7b58",
    line: "rgba(42,39,35,0.16)",
    ornament: "◇",
  },
  prisma: {
    bg: "#0a0a16",
    ink: "#f2f2f7",
    accent: "#d8ff5f",
    line: "rgba(242,242,247,0.14)",
    ornament: "✦",
    dark: true,
    // Lavender-abu sejuk → ponsel gelap + aksen hijau-elektrik Prisma kontras.
    panel: "#e7e7f0",
  },
  kirana: {
    bg: "#f5eddc",
    ink: "#3b2f22",
    accent: "#c09a4a",
    line: "rgba(59,47,34,0.16)",
    ornament: "✽",
  },
  priangan: {
    bg: "#f6f1e3",
    ink: "#23311f",
    accent: "#2e5b41",
    line: "rgba(35,49,31,0.16)",
    ornament: "✿",
  },
  marawa: {
    bg: "#1a1412",
    ink: "#f2e7d4",
    accent: "#d4a848",
    line: "rgba(212,168,72,0.28)",
    ornament: "✦",
    dark: true,
  },
  sakinah: {
    bg: "#f7f3ea",
    ink: "#2a3328",
    accent: "#3e5340",
    line: "rgba(42,51,40,0.14)",
    ornament: "✸",
  },
  meihua: {
    bg: "#7c1e1a",
    ink: "#fbefd9",
    accent: "#e2b13c",
    line: "rgba(226,177,60,0.35)",
    ornament: "❀",
    dark: true,
  },
  warta: {
    bg: "#efece4",
    ink: "#191715",
    accent: "#191715",
    line: "rgba(25,23,21,0.2)",
    ornament: "\u2605",
  },
};

export function getThemeCatalogMeta(slug: string): ThemeCatalogMeta {
  return themeCatalogMeta[slug] ?? FALLBACK_CATALOG_META;
}

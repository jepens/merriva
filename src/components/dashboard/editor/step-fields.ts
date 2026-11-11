/**
 * Peta langkah editor → awalan path isian yang dirender langkah itu. Dipakai
 * untuk menunjuk LANGKAH mana yang berisi isian yang ditolak server (penanda
 * di navigasi langkah + pesan "perbaiki di langkah X"), karena pemilik sering
 * sudah berpindah langkah saat autosave menolak.
 *
 * Kunci langkah sama di ketiga kategori. Awalan boleh tumpang tindih —
 * `content.groom.nickname` (Info) di dalam `content.groom` (Mempelai) — dan
 * yang PALING SPESIFIK (terpanjang) menang. `tests/unit/editor-limits-sweep`
 * memastikan setiap isian yang dirender sebuah langkah memang terpetakan ke
 * langkah itu.
 */
export const STEP_FIELDS: Readonly<Record<string, readonly string[]>> = {
  info: [
    "content.title",
    "content.groom.nickname",
    "content.bride.nickname",
    "content.eventName",
    "content.organizer",
    "content.celebrant",
    "content.parents",
    "eventDate",
  ],
  couple: ["content.groom", "content.bride"],
  detail: ["content.description", "content.pic", "content.logo"],
  gallery: ["content.coverPhoto", "content.themePhotos"],
  schedule: ["events"],
  story: ["content.story"],
  agenda: ["content.agenda"],
  wishes: ["content.wishes"],
  envelope: ["content.envelope"],
  settings: [
    "settings",
    "content.greetingOpen",
    "content.greetingClose",
    "content.youtubeUrl",
    "content.livestreamUrl",
    "content.quote",
  ],
};

function matches(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}.`);
}

/**
 * Kunci langkah (di antara `stepKeys` milik editor ini) yang merender `path`;
 * `null` bila tak ada yang cocok (mis. path tanpa isian di UI).
 */
export function stepForPath(
  path: string,
  stepKeys: readonly string[],
): string | null {
  let best: string | null = null;
  let bestLen = -1;
  for (const key of stepKeys) {
    for (const prefix of STEP_FIELDS[key] ?? []) {
      if (matches(path, prefix) && prefix.length > bestLen) {
        best = key;
        bestLen = prefix.length;
      }
    }
  }
  return best;
}

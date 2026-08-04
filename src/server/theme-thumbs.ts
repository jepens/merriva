import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Apakah tema punya thumbnail hasil `pnpm thumbs` (public/theme-thumbs/{slug}-*).
 * Dipakai server untuk memutuskan kartu memakai MOCKUP foto atau fallback poster
 * spesimen (tema baru yang belum difoto tetap tampil rapi). Cek `-cover` cukup
 * (skrip selalu menulis cover + inner berpasangan).
 */
export function hasThemeThumb(slug: string): boolean {
  return existsSync(
    join(process.cwd(), "public", "theme-thumbs", `${slug}-cover.jpg`),
  );
}

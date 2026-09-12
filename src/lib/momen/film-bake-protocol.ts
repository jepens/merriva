/**
 * Protokol pesan bake filter antara halaman kamera dan Web Worker
 * (AUDIT-2026-09-04 PER-6).
 *
 * `runBakeRequest` adalah SATU-SATUNYA tempat piksel diproses — dipakai worker
 * DAN jalur fallback main thread — sehingga kedua jalur mustahil menghasilkan
 * foto yang berbeda (dikunci golden hash di `film-render.golden.test.ts`).
 * Murni & bebas DOM: tak menyentuh kanvas maupun lingkup worker.
 */

import { getFilmPreset } from "./film-presets";
import { applyFilmToPixels } from "./film-render";

export interface BakeRequest {
  id: number;
  /** Piksel RGBA sumber; DI-TRANSFER ke worker (bukan disalin) lalu dikembalikan. */
  buffer: ArrayBuffer;
  width: number;
  height: number;
  filterId: string;
  seed: number;
}

export type BakeResponse =
  | { id: number; ok: true; buffer: ArrayBuffer }
  | { id: number; ok: false; error: string };

/** Terapkan preset film ke buffer (in-place) dan kembalikan buffer yang sama. */
export function runBakeRequest(req: BakeRequest): BakeResponse {
  try {
    const data = new Uint8ClampedArray(req.buffer);
    applyFilmToPixels(
      data,
      req.width,
      req.height,
      getFilmPreset(req.filterId).params,
      { seed: req.seed },
    );
    return { id: req.id, ok: true, buffer: req.buffer };
  } catch (err) {
    return {
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

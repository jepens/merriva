/**
 * Web Worker bake filter Album Momen (AUDIT-2026-09-04 PER-6).
 *
 * Di main thread, bake 1600×1200 = 1,9 juta piksel × ±40–50 operasi float
 * (60–95 juta operasi) berjalan dalam SATU task sinkron: tombol rana tampak
 * beku tanpa umpan balik, tepat saat tamu memotret. Di sini ia berjalan di luar
 * main thread; halaman hanya memindahkan buffer masuk-keluar.
 *
 * Sengaja TANPA `OffscreenCanvas` (baru didukung Safari 16.4): worker hanya
 * menerima `ArrayBuffer` piksel, jadi berjalan juga di WebView WhatsApp iOS
 * lama. Dibundel Next/Turbopack lewat pola
 * `new Worker(new URL("./film.worker.ts", import.meta.url))` di `film-bake.ts`.
 */

import { runBakeRequest, type BakeRequest } from "./film-bake-protocol";

/**
 * Lingkup worker minimal. tsconfig proyek memakai lib "dom" (bukan
 * "webworker"), di mana `self.postMessage` bertanda tangan milik Window (butuh
 * targetOrigin) — tipe yang salah untuk konteks ini.
 */
interface WorkerScope {
  onmessage: ((event: MessageEvent<BakeRequest>) => void) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
  const res = runBakeRequest(event.data);
  // Kembalikan buffer dengan TRANSFER (nol salinan). Saat gagal, buffer sengaja
  // tak dikembalikan: pemanggil membaca ulang piksel dari kanvas.
  scope.postMessage(res, res.ok ? [res.buffer] : []);
};

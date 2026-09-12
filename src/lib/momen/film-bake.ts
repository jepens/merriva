import {
  runBakeRequest,
  type BakeRequest,
  type BakeResponse,
} from "./film-bake-protocol";

/**
 * Pengelola bake filter di Web Worker dengan fallback main thread
 * (AUDIT-2026-09-04 PER-6).
 *
 * Kontrak terpenting: foto tamu TIDAK BOLEH gagal hanya karena worker gagal.
 * Setiap kegagalan — `Worker` tak tersedia, konstruksi melempar, worker error,
 * worker diam melewati batas waktu, `postMessage` melempar, atau respons gagal —
 * jatuh ke main thread memakai `runBakeRequest` yang SAMA, sehingga hasilnya
 * byte-identik. Worker yang pernah error/timeout ditandai rusak dan tak dibuat
 * ulang selama sesi (menghindari biaya berulang pada perangkat yang bermasalah).
 */

/** Batas tunggu respons worker sebelum jatuh ke main thread. */
export const BAKE_TIMEOUT_MS = 20_000;

/** Kontrak minimal Worker — dapat diinjeksi di test. */
export interface BakeWorker {
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
  terminate(): void;
}

export interface BakeInput {
  /**
   * Baca SALINAN segar piksel sumber (mis. `ctx.getImageData(...).data`).
   * Bisa dipanggil DUA kali: sekali untuk worker, sekali lagi bila harus jatuh
   * ke main thread — buffer pertama sudah di-transfer dan tak lagi terbaca.
   * Kanvas sumber karena itu tak boleh diubah sebelum bake selesai.
   */
  read: () => Uint8ClampedArray;
  width: number;
  height: number;
  filterId: string;
  seed: number;
}

export interface BakeResult {
  data: Uint8ClampedArray;
  via: "worker" | "main";
}

export interface FilmBaker {
  bake(input: BakeInput): Promise<BakeResult>;
}

/**
 * Buffer yang boleh di-transfer utuh. `getImageData` memberi buffer tepat
 * seukuran piksel; bila tidak (view parsial / SharedArrayBuffer), salin dulu
 * agar transfer tak memindahkan memori milik pihak lain.
 */
function ownedBuffer(px: Uint8ClampedArray): ArrayBuffer {
  if (
    px.buffer instanceof ArrayBuffer &&
    px.byteOffset === 0 &&
    px.byteLength === px.buffer.byteLength
  ) {
    return px.buffer;
  }
  const copy = new Uint8ClampedArray(px.length);
  copy.set(px);
  return copy.buffer as ArrayBuffer;
}

export function createFilmBaker(
  createWorker: (() => BakeWorker) | null,
): FilmBaker {
  let worker: BakeWorker | null = null;
  let broken = createWorker === null;
  let nextId = 1;
  const pending = new Map<
    number,
    {
      resolve: (res: BakeResponse) => void;
      reject: (err: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  /** Tandai worker rusak & gagalkan seluruh permintaan yang menunggu. */
  function failAll(reason: string): void {
    broken = true;
    for (const [id, p] of pending) {
      clearTimeout(p.timer);
      pending.delete(id);
      p.reject(new Error(reason));
    }
    worker?.terminate();
    worker = null;
  }

  function ensureWorker(): BakeWorker | null {
    if (broken || !createWorker) return null;
    if (worker) return worker;
    try {
      const w = createWorker();
      w.onmessage = (event) => {
        const res = event.data as BakeResponse;
        const p = pending.get(res.id);
        if (!p) return;
        clearTimeout(p.timer);
        pending.delete(res.id);
        p.resolve(res);
      };
      w.onerror = () => failAll("worker error");
      worker = w;
      return w;
    } catch {
      broken = true;
      return null;
    }
  }

  function onMainThread(input: BakeInput): BakeResult {
    const buffer = ownedBuffer(input.read());
    const res = runBakeRequest({
      id: 0,
      buffer,
      width: input.width,
      height: input.height,
      filterId: input.filterId,
      seed: input.seed,
    });
    if (!res.ok) throw new Error(res.error);
    return { data: new Uint8ClampedArray(res.buffer), via: "main" };
  }

  async function bake(input: BakeInput): Promise<BakeResult> {
    const w = ensureWorker();
    if (!w) return onMainThread(input);

    const id = nextId++;
    const buffer = ownedBuffer(input.read());
    const req: BakeRequest = {
      id,
      buffer,
      width: input.width,
      height: input.height,
      filterId: input.filterId,
      seed: input.seed,
    };

    try {
      const res = await new Promise<BakeResponse>((resolve, reject) => {
        const timer = setTimeout(
          () => failAll("worker timeout"),
          BAKE_TIMEOUT_MS,
        );
        pending.set(id, { resolve, reject, timer });
        try {
          w.postMessage(req, [buffer]);
        } catch (err) {
          clearTimeout(timer);
          pending.delete(id);
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
      if (res.ok) {
        return { data: new Uint8ClampedArray(res.buffer), via: "worker" };
      }
    } catch {
      // Jatuh ke main thread di bawah.
    }
    return onMainThread(input);
  }

  return { bake };
}

let defaultBaker: FilmBaker | null = null;

/** Baker bersama untuk halaman kamera; worker dibuat malas saat bake pertama. */
export function getDefaultFilmBaker(): FilmBaker {
  if (defaultBaker) return defaultBaker;
  defaultBaker = createFilmBaker(
    typeof Worker === "undefined"
      ? null
      : () =>
          // Pola yang dikenali Turbopack/webpack: worker dibundel sebagai chunk
          // terpisah. `type: "module"` diabaikan runtime Turbopack (entry worker
          // klasik via importScripts) tetapi dibutuhkan webpack.
          new Worker(new URL("./film.worker.ts", import.meta.url), {
            type: "module",
          }) as unknown as BakeWorker,
  );
  return defaultBaker;
}

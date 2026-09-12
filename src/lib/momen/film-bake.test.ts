import { afterEach, describe, expect, it, vi } from "vitest";

import { BAKE_TIMEOUT_MS, createFilmBaker, type BakeWorker } from "./film-bake";
import { runBakeRequest, type BakeRequest } from "./film-bake-protocol";
import { getFilmPreset } from "./film-presets";
import { applyFilmToPixels } from "./film-render";

/**
 * Pengelola bake Web Worker (AUDIT-2026-09-04 PER-6).
 *
 * Kontrak yang dikunci: foto tamu TIDAK BOLEH gagal hanya karena worker gagal,
 * dan hasil jalur worker maupun fallback main thread BYTE-IDENTIK. Memakai
 * preset `senja` — satu-satunya dengan halation, jalur paling berat.
 */

const W = 40;
const H = 30;
const FILTER = "senja";

function source(): Uint8ClampedArray {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const j = i * 4;
    d[j] = (i * 7) % 256;
    d[j + 1] = (i * 3) % 256;
    d[j + 2] = (i * 11) % 256;
    d[j + 3] = 255;
  }
  // Petak sangat terang agar halation benar-benar berjalan.
  for (let y = 12; y < 18; y++) {
    for (let x = 17; x < 23; x++) {
      const j = (y * W + x) * 4;
      d[j] = 255;
      d[j + 1] = 252;
      d[j + 2] = 248;
    }
  }
  return d;
}

function expected(seed: number): Uint8ClampedArray {
  const d = source();
  applyFilmToPixels(d, W, H, getFilmPreset(FILTER).params, { seed });
  return d;
}

const same = (a: Uint8ClampedArray, b: Uint8ClampedArray) =>
  Buffer.from(a).equals(Buffer.from(b));

function input(seed = 7) {
  const read = vi.fn(() => source());
  return { read, width: W, height: H, filterId: FILTER, seed };
}

type Mode = "ok" | "error" | "fail-response" | "silent" | "hold" | "throw";

/** Worker palsu: menjalankan handler protokol yang SAMA dengan worker asli. */
class FakeWorker implements BakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly transfers: Transferable[][] = [];
  terminated = false;
  private held: BakeRequest[] = [];

  constructor(private readonly mode: Mode) {}

  postMessage(message: unknown, transfer: Transferable[]): void {
    if (this.mode === "throw") throw new Error("DataCloneError");
    this.transfers.push(transfer);
    const req = message as BakeRequest;
    if (this.mode === "silent") return;
    if (this.mode === "hold") {
      this.held.push(req);
      return;
    }
    queueMicrotask(() => {
      if (this.mode === "error") {
        this.onerror?.({ message: "boom" } as ErrorEvent);
      } else if (this.mode === "fail-response") {
        this.onmessage?.({
          data: { id: req.id, ok: false, error: "x" },
        } as MessageEvent);
      } else {
        this.onmessage?.({ data: runBakeRequest(req) } as MessageEvent);
      }
    });
  }

  /** Jawab permintaan yang ditahan dalam urutan TERBALIK. */
  flushReversed(): void {
    for (const req of this.held.reverse()) {
      this.onmessage?.({ data: runBakeRequest(req) } as MessageEvent);
    }
    this.held = [];
  }

  terminate(): void {
    this.terminated = true;
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createFilmBaker — jalur worker", () => {
  it("worker sehat → via worker, byte-identik, buffer DI-TRANSFER (bukan disalin)", async () => {
    const fake = new FakeWorker("ok");
    const baker = createFilmBaker(() => fake);
    const inp = input();

    const res = await baker.bake(inp);

    expect(res.via).toBe("worker");
    expect(same(res.data, expected(7))).toBe(true);
    expect(inp.read).toHaveBeenCalledTimes(1);
    const sent = fake.transfers[0]?.[0];
    expect(sent).toBeInstanceOf(ArrayBuffer);
    expect((sent as ArrayBuffer).byteLength).toBe(W * H * 4);
  });

  it("permintaan serentak dipasangkan dengan id yang benar walau dijawab terbalik", async () => {
    const fake = new FakeWorker("hold");
    const baker = createFilmBaker(() => fake);

    const a = baker.bake(input(7));
    const b = baker.bake(input(8));
    // Biarkan kedua postMessage terkirim sebelum menjawab.
    await Promise.resolve();
    fake.flushReversed();

    const [ra, rb] = await Promise.all([a, b]);
    expect(same(ra.data, expected(7))).toBe(true);
    expect(same(rb.data, expected(8))).toBe(true);
    expect(same(ra.data, rb.data)).toBe(false);
  });
});

describe("createFilmBaker — fallback main thread (foto tak boleh gagal)", () => {
  it("Worker tak tersedia → main thread, byte-identik", async () => {
    const res = await createFilmBaker(null).bake(input());

    expect(res.via).toBe("main");
    expect(same(res.data, expected(7))).toBe(true);
  });

  it("worker error → main thread; piksel DIBACA ULANG; worker dihentikan & tak dibuat lagi", async () => {
    const fake = new FakeWorker("error");
    const create = vi.fn(() => fake);
    const baker = createFilmBaker(create);
    const inp = input();

    const res = await baker.bake(inp);

    expect(res.via).toBe("main");
    expect(same(res.data, expected(7))).toBe(true);
    // Buffer pertama sudah di-transfer → wajib membaca ulang dari kanvas.
    expect(inp.read).toHaveBeenCalledTimes(2);
    expect(fake.terminated).toBe(true);

    const again = await baker.bake(input());
    expect(again.via).toBe("main");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("konstruksi Worker melempar → main thread", async () => {
    const baker = createFilmBaker(() => {
      throw new Error("worker diblokir");
    });

    const res = await baker.bake(input());

    expect(res.via).toBe("main");
    expect(same(res.data, expected(7))).toBe(true);
  });

  it("respons gagal dari worker → main thread", async () => {
    const res = await createFilmBaker(
      () => new FakeWorker("fail-response"),
    ).bake(input());

    expect(res.via).toBe("main");
    expect(same(res.data, expected(7))).toBe(true);
  });

  it("postMessage melempar (mis. DataCloneError) → main thread", async () => {
    const res = await createFilmBaker(() => new FakeWorker("throw")).bake(
      input(),
    );

    expect(res.via).toBe("main");
    expect(same(res.data, expected(7))).toBe(true);
  });

  it("worker diam melewati batas waktu → main thread & worker dihentikan", async () => {
    vi.useFakeTimers();
    const fake = new FakeWorker("silent");
    const promise = createFilmBaker(() => fake).bake(input());

    await vi.advanceTimersByTimeAsync(BAKE_TIMEOUT_MS + 1);
    const res = await promise;

    expect(res.via).toBe("main");
    expect(same(res.data, expected(7))).toBe(true);
    expect(fake.terminated).toBe(true);
  });
});

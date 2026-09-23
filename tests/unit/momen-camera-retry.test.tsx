import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kirim ulang jepretan (DECISIONS #46). Momen di acara TAK BISA diulang: bila
 * unggahan ditolak karena gangguan sesaat, blob fotonya harus dipertahankan dan
 * tamu diberi tombol "Kirim ulang foto" yang mengirim foto yang SAMA. Penolakan
 * PERMANEN (jatah habis, album nonaktif, format ditolak) tetap membuang blob —
 * tombol di sana cuma harapan palsu.
 *
 * Pipeline gambar (kanvas + worker bake + encode) dipalsukan: yang diuji di sini
 * adalah mesin keadaan `pending`, bukan matematika filter.
 */

const {
  startMomenSessionAction,
  uploadMomenPhotoAction,
  loadMomenPhotosAction,
} = vi.hoisted(() => ({
  startMomenSessionAction: vi.fn(),
  uploadMomenPhotoAction: vi.fn(),
  loadMomenPhotosAction: vi.fn(),
}));
vi.mock("@/server/actions/momen-guest", () => ({
  startMomenSessionAction,
  uploadMomenPhotoAction,
  loadMomenPhotosAction,
}));

vi.mock("@/lib/image/encode", () => ({
  encodeCanvas: vi.fn(async () => ({
    blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/webp" }),
    format: "webp" as const,
  })),
}));
vi.mock("@/lib/momen/film-bake", () => ({
  getDefaultFilmBaker: () => ({
    bake: async ({ read }: { read: () => Uint8ClampedArray }) => ({
      data: read(),
    }),
  }),
}));

import { copy } from "@/lib/copy";
import { MomenCamera } from "@/components/public/momen/momen-camera";

const c = copy.momen;
const SLUG = "andi-sinta";

const props = {
  slug: SLUG,
  quotaPerGuest: 5,
  defaultFilter: "hangat",
  allowLibraryUpload: true,
  revealAtIso: null,
  heroTitle: "Andi & Sinta",
  dateLabel: null,
  turnstileSiteKey: null,
  initialPhotos: [],
  initialCursor: null,
  totalPhotos: 0,
  photographers: 0,
};

let revoked: string[] = [];

beforeEach(() => {
  revoked = [];
  startMomenSessionAction.mockResolvedValue({
    status: "ok",
    remaining: 5,
    deviceCount: 0,
  });
  uploadMomenPhotoAction.mockReset();

  // Kanvas jsdom tak punya konteks 2d; cukup sediakan API yang dipakai.
  const ctx = {
    drawImage: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    createImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  vi.stubGlobal("createImageBitmap", async () => ({
    width: 120,
    height: 90,
    close: vi.fn(),
  }));
  const cr = globalThis.crypto as Crypto & { randomUUID?: () => string };
  if (typeof cr?.randomUUID !== "function") {
    vi.stubGlobal("crypto", {
      getRandomValues: (a: Uint8Array) => cr.getRandomValues(a),
      randomUUID: () => "11111111-1111-4111-8111-111111111111",
    });
  }
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: () => "blob:uji",
    revokeObjectURL: (u: string) => revoked.push(u),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Masuk sesi lalu unggah satu foto dari galeri. */
async function unggahDariGaleri(container: HTMLElement) {
  // Efek init (deviceId + nama tersimpan) berjalan di setTimeout(0) dan MENIMPA
  // field nama; ketik sesudahnya, persis seperti tamu sungguhan.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  fireEvent.change(screen.getByLabelText(c.masuk.nameLabel), {
    target: { value: "Sasa" },
  });
  const mulai = screen.getByRole("button", { name: /Mulai Memotret/ });
  await waitFor(() => expect(mulai).not.toBeDisabled());
  fireEvent.click(mulai);
  await waitFor(() => expect(startMomenSessionAction).toHaveBeenCalled());

  const input = container.querySelector<HTMLInputElement>(
    'input[accept="image/jpeg,image/png,image/webp"]',
  );
  expect(input).not.toBeNull();
  const file = new File([new Uint8Array([1, 2, 3])], "foto.png", {
    type: "image/png",
  });
  fireEvent.change(input!, { target: { files: [file] } });
  await waitFor(() => expect(uploadMomenPhotoAction).toHaveBeenCalled());
}

describe("MomenCamera — kirim ulang jepretan", () => {
  it("penolakan SESAAT → foto disimpan, tombol kirim ulang mengirim foto yang sama", async () => {
    uploadMomenPhotoAction
      .mockResolvedValueOnce({
        status: "error",
        message: c.error.temporary,
        retryable: true,
      })
      .mockResolvedValueOnce({ status: "ok", remaining: 4 });

    const { container } = render(<MomenCamera {...props} />);
    await unggahDariGaleri(container);

    const retry = await screen.findByRole("button", {
      name: c.camera.retryPhoto,
    });
    // Blob TIDAK dilepas — itulah yang membuat kiriman ulang mungkin.
    expect(revoked).not.toContain("blob:uji");

    fireEvent.click(retry);

    await waitFor(() =>
      expect(uploadMomenPhotoAction).toHaveBeenCalledTimes(2),
    );
    // Foto yang SAMA: bukan jepretan baru, jadi tak ada bake/encode ulang.
    const [, fd1] = uploadMomenPhotoAction.mock.calls[0];
    const [, fd2] = uploadMomenPhotoAction.mock.calls[1];
    const b1 = fd1.get("display") as File;
    const b2 = fd2.get("display") as File;
    expect(b2.size).toBe(b1.size);
    // Sesudah berhasil, ajakan kirim ulang hilang.
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: c.camera.retryPhoto }),
      ).toBeNull(),
    );
  });

  it("penolakan PERMANEN → tanpa tombol kirim ulang, blob dilepas", async () => {
    uploadMomenPhotoAction.mockResolvedValue({
      status: "error",
      message: c.error.guestQuota,
    });

    const { container } = render(<MomenCamera {...props} />);
    await unggahDariGaleri(container);

    await screen.findAllByText(c.error.guestQuota);
    expect(
      screen.queryByRole("button", { name: c.camera.retryPhoto }),
    ).toBeNull();
    expect(revoked).toContain("blob:uji");
  });
});

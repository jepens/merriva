import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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

/** Query di dalam SATU layar: tombol kirim ulang kini hidup di tiga layar. */
const di = (container: HTMLElement, kelas: string) =>
  within(container.querySelector(kelas) as HTMLElement);
const kamera = (container: HTMLElement) => di(container, ".mn-kamera");

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
  // Kamera: getUserMedia + dimensi video dipalsukan agar jalur SHUTTER
  // (bukan hanya unggah galeri) benar-benar terjalankan di jsdom.
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [] })) },
  });
  for (const [prop, val] of [
    ["videoWidth", 640],
    ["videoHeight", 480],
  ] as const) {
    Object.defineProperty(HTMLVideoElement.prototype, prop, {
      configurable: true,
      get: () => val,
    });
  }
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

/** Masuk sesi → layar kamera. */
async function masukKamera() {
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
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** Masuk sesi lalu unggah satu foto dari galeri. */
async function unggahDariGaleri(container: HTMLElement) {
  await masukKamera();

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

    const retry = await kamera(container).findByRole("button", {
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
        kamera(container).queryByRole("button", { name: c.camera.retryPhoto }),
      ).toBeNull(),
    );
  });

  it("filter yang DIPANGGANG ikut terkirim, meski tamu mengganti chip filter", async () => {
    uploadMomenPhotoAction
      .mockResolvedValueOnce({
        status: "error",
        message: c.error.temporary,
        retryable: true,
      })
      .mockResolvedValueOnce({ status: "ok", remaining: 4 });

    const { container } = render(<MomenCamera {...props} />);
    await unggahDariGaleri(container);
    const retry = await kamera(container).findByRole("button", {
      name: c.camera.retryPhoto,
    });

    // Strip filter tetap hidup di balik panel galat; tamu menyentuh "Mono".
    fireEvent.click(screen.getByRole("button", { name: "filter Mono" }));
    fireEvent.click(retry);

    await waitFor(() =>
      expect(uploadMomenPhotoAction).toHaveBeenCalledTimes(2),
    );
    const [, fd1] = uploadMomenPhotoAction.mock.calls[0];
    const [, fd2] = uploadMomenPhotoAction.mock.calls[1];
    // Piksel sudah dipanggang dengan filter lama → nama film yang dicatat harus
    // filter itu, bukan chip yang sedang aktif (kapsi galeri ikut salah).
    expect(fd2.get("filterId")).toBe(fd1.get("filterId"));
    expect(fd2.get("filterId")).toBe(props.defaultFilter);
    expect(fd2.get("source")).toBe(fd1.get("source"));
  });

  it("kirim ulang ditolak PERMANEN → tombolnya hilang, blob dilepas sekali", async () => {
    uploadMomenPhotoAction
      .mockResolvedValueOnce({
        status: "error",
        message: c.error.temporary,
        retryable: true,
      })
      // Sementara menunggu, jatahnya habis lewat gerbang kuota atomik.
      .mockResolvedValueOnce({ status: "error", message: c.error.guestQuota });

    const { container } = render(<MomenCamera {...props} />);
    await unggahDariGaleri(container);
    fireEvent.click(
      await kamera(container).findByRole("button", {
        name: c.camera.retryPhoto,
      }),
    );

    await screen.findAllByText(c.error.guestQuota);
    await waitFor(() =>
      expect(
        kamera(container).queryByRole("button", { name: c.camera.retryPhoto }),
      ).toBeNull(),
    );
    expect(revoked.filter((u) => u === "blob:uji")).toHaveLength(1);
  });

  it("galat LAIN (format tak didukung) tak mencuri tombol jepretan tertunda", async () => {
    uploadMomenPhotoAction.mockResolvedValue({
      status: "error",
      message: c.error.temporary,
      retryable: true,
    });

    const { container } = render(<MomenCamera {...props} />);
    await unggahDariGaleri(container);
    await kamera(container).findByRole("button", { name: c.camera.retryPhoto });

    // Tamu iPhone memilih HEIC dari galeri → ditolak sebelum diproses.
    const input = container.querySelector<HTMLInputElement>(
      'input[accept="image/jpeg,image/png,image/webp"]',
    )!;
    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array([1])], "IMG.HEIC", { type: "image/heic" }),
        ],
      },
    });

    await screen.findAllByText(c.error.formatUnsupported);
    // Jepretan lama TETAP bisa dikirim ulang, dengan keterangan miliknya.
    expect(
      kamera(container).getByRole("button", { name: c.camera.retryPhoto }),
    ).toBeTruthy();
    expect(kamera(container).getByText(c.camera.pendingShot)).toBeTruthy();
    expect(revoked).not.toContain("blob:uji");
  });

  it("unggah MELEMPAR (transport putus) → jepretan tetap disimpan", async () => {
    // WiFi venue mati di tengah unggah ~1,5 MB: aksi MELEMPAR, bukan menolak.
    // Dulu jepretan yang sudah dipanggang langsung hilang dan pesannya menyuruh
    // "Coba lagi" tanpa satu pun cara mematuhinya.
    uploadMomenPhotoAction.mockRejectedValueOnce(new Error("Failed to fetch"));

    const { container } = render(<MomenCamera {...props} />);
    await unggahDariGaleri(container);

    await kamera(container).findByRole("button", { name: c.camera.retryPhoto });
    expect(revoked).not.toContain("blob:uji");

    uploadMomenPhotoAction.mockResolvedValueOnce({
      status: "ok",
      remaining: 4,
    });
    fireEvent.click(
      kamera(container).getByRole("button", { name: c.camera.retryPhoto }),
    );

    await waitFor(() =>
      expect(uploadMomenPhotoAction).toHaveBeenCalledTimes(2),
    );
    const [, fd1] = uploadMomenPhotoAction.mock.calls[0];
    const [, fd2] = uploadMomenPhotoAction.mock.calls[1];
    expect((fd2.get("display") as File).size).toBe(
      (fd1.get("display") as File).size,
    );
  });

  it("tamu menutup kamera → jepretan tertunda tetap terjangkau di layar lain", async () => {
    uploadMomenPhotoAction.mockResolvedValue({
      status: "error",
      message: c.error.temporary,
      retryable: true,
    });

    const { container } = render(<MomenCamera {...props} />);
    await unggahDariGaleri(container);
    await kamera(container).findByRole("button", { name: c.camera.retryPhoto });

    fireEvent.click(screen.getByRole("button", { name: c.camera.close }));

    // Belum sempat menjepret apa pun → kembali ke layar masuk; tombol kirim
    // ulang dulu hanya hidup di layar kamera, jadi fotonya ikut terkubur.
    const masuk = within(container.querySelector(".mn-masuk") as HTMLElement);
    expect(masuk.getByText(c.camera.pendingShot)).toBeTruthy();
    expect(
      masuk.getByRole("button", { name: c.camera.retryPhoto }),
    ).toBeTruthy();

    uploadMomenPhotoAction.mockResolvedValueOnce({
      status: "ok",
      remaining: 4,
    });
    fireEvent.click(masuk.getByRole("button", { name: c.camera.retryPhoto }));

    await waitFor(() =>
      expect(uploadMomenPhotoAction).toHaveBeenCalledTimes(2),
    );
  });

  it("jepretan KAMERA yang gagal terkirim juga diselamatkan", async () => {
    // Jalur utama tamu adalah tombol rana, bukan unggah galeri; tanpa test ini
    // penyelamatan jepretan hanya terbukti untuk jalur galeri.
    uploadMomenPhotoAction.mockRejectedValueOnce(new Error("Failed to fetch"));

    const { container } = render(<MomenCamera {...props} />);
    await masukKamera();
    fireEvent.click(screen.getByRole("button", { name: c.camera.shutter }));

    await kamera(container).findByRole("button", {
      name: c.camera.retryPhoto,
    });
    expect(revoked).not.toContain("blob:uji");
    const [, fd] = uploadMomenPhotoAction.mock.calls[0];
    expect(fd.get("source")).toBe("camera");
  });

  it("meninggalkan halaman melepas object URL jepretan tertunda", async () => {
    uploadMomenPhotoAction.mockResolvedValue({
      status: "error",
      message: c.error.temporary,
      retryable: true,
    });

    const { container, unmount } = render(<MomenCamera {...props} />);
    await unggahDariGaleri(container);
    await kamera(container).findByRole("button", {
      name: c.camera.retryPhoto,
    });
    expect(revoked).not.toContain("blob:uji");

    unmount();

    // Blob 1600px tak boleh tetap terpaku di memori dokumen.
    expect(revoked).toContain("blob:uji");
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
      kamera(container).queryByRole("button", { name: c.camera.retryPhoto }),
    ).toBeNull();
    expect(revoked).toContain("blob:uji");
  });
});

describe("MomenCamera — galeri 'muat lebih' gagal", () => {
  const galleryProps = {
    ...props,
    // Sudah lewat → fase "revealed", galeri terbuka.
    revealAtIso: "2020-01-01T00:00:00Z",
    initialCursor: "2026-12-20T02:00:00Z",
    initialPhotos: [
      {
        id: "p1",
        guestName: "Sasa",
        filterId: "hangat",
        url: "blob:a",
        thumbUrl: "blob:a",
      },
    ],
    totalPhotos: 1,
    photographers: 1,
  };

  async function bukaGaleri() {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    fireEvent.change(screen.getByLabelText(c.masuk.nameLabel), {
      target: { value: "Sasa" },
    });
    // Tombol "Lihat Album" ada di layar masuk DAN layar habis; yang pertama
    // (urutan DOM) milik layar masuk.
    fireEvent.click(
      screen.getAllByRole("button", { name: c.habis.toGallery })[0]!,
    );
    await waitFor(() => expect(startMomenSessionAction).toHaveBeenCalled());
  }

  it("gagal → pesan di LAYAR GALERI + tombol 'Muat lebih' tetap ada", async () => {
    loadMomenPhotosAction.mockResolvedValue({ status: "error" });
    render(<MomenCamera {...galleryProps} />);
    await bukaGaleri();

    const more = await screen.findByRole("button", {
      name: c.gallery.loadMore,
    });
    fireEvent.click(more);

    // Panel galat & toast hanya hidup di layar kamera — pesannya harus muncul
    // di sini, tepat di atas tombolnya.
    await screen.findByText(c.error.temporary);
    expect(
      screen.getByRole("button", { name: c.gallery.loadMore }),
    ).toBeTruthy();
  });

  it("aksi MELEMPAR → pesan yang sama, tombol tetap hidup", async () => {
    loadMomenPhotosAction.mockRejectedValue(new Error("Failed to fetch"));
    render(<MomenCamera {...galleryProps} />);
    await bukaGaleri();

    fireEvent.click(
      await screen.findByRole("button", { name: c.gallery.loadMore }),
    );

    await screen.findByText(c.error.temporary);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: c.gallery.loadMore }),
      ).not.toBeDisabled(),
    );
  });
});

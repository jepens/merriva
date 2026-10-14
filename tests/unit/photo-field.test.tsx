import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `PhotoField` — tombol unggah foto bernama yang selama ini TIDAK ADA di
 * editor, padahal SPEC §4.4 langkah 2 menuntutnya dan tema sudah merendernya.
 *
 * Yang dijaga di sini adalah dua perilaku yang mudah hilang saat komponen ini
 * dirapikan kelak:
 *  - yang masuk ke form hanyalah PATH (bukan URL): URL dirakit di server, dan
 *    menyimpan URL vendor ke `content` adalah boundary yang dilarang SPEC §6.4;
 *  - mengganti/membuang foto MENGHAPUS objek lamanya. Tanpa itu, setiap
 *    pergantian menumpuk objek yatim yang tak satu pun baris database
 *    menunjuknya — jadi retensi pun tak akan pernah menemukannya.
 */

const { uploadNamedPhotoAction, deleteNamedPhotoAction } = vi.hoisted(() => ({
  uploadNamedPhotoAction: vi.fn(),
  deleteNamedPhotoAction: vi.fn(() => Promise.resolve({ status: "success" })),
}));
vi.mock("@/server/actions/named-photo", () => ({
  uploadNamedPhotoAction,
  deleteNamedPhotoAction,
}));

const { cropToVariants, loadBitmap } = vi.hoisted(() => {
  const hasil = () => ({
    display: new File([new Uint8Array(10)], "d", { type: "image/webp" }),
    thumb: new File([new Uint8Array(5)], "t", { type: "image/webp" }),
    width: 1280,
    height: 1600,
  });
  return {
    // Parameter DIDEKLARASIKAN supaya `mock.calls[0][1]` lolos typecheck.
    cropToVariants: vi.fn(
      (_bitmap: unknown, _crop: { sw: number; sh: number }) =>
        Promise.resolve(hasil()),
    ),
    loadBitmap: vi.fn(() =>
      Promise.resolve({ width: 1200, height: 1600, close: vi.fn() }),
    ),
  };
});

vi.mock("@/lib/image/compress", () => ({
  isSupportedImage: (f: File) => f.type.startsWith("image/"),
  compressToWebpVariants: vi.fn(() =>
    Promise.resolve({
      display: new File([new Uint8Array(10)], "d", { type: "image/webp" }),
      thumb: new File([new Uint8Array(5)], "t", { type: "image/webp" }),
      width: 1600,
      height: 1200,
    }),
  ),
  cropToVariants,
  loadBitmap,
}));

import { PhotoField } from "@/components/dashboard/editor/photo-field";

const INV = "44444444-4444-4444-8444-444444444444";
const PATH_BARU = `inv/${INV}/foto/11111111-1111-4111-8111-111111111111`;
const PATH_LAMA = `inv/${INV}/foto/22222222-2222-4222-8222-222222222222`;

/**
 * `PhotoField` TERKONTROL: `value` datang dari form, dan pratinjau baru muncul
 * setelah form mengembalikannya. Induk tiruan di sini meniru itu — di editor
 * nyata, `setValue` memicu `watch` di langkah yang bersangkutan sehingga
 * `value` baru mengalir turun.
 */
function Induk({
  awal,
  initialUrl,
  onChange,
  aspect,
}: {
  awal?: string;
  initialUrl: string | null;
  onChange: (p: string | undefined) => void;
  aspect?: number;
}) {
  const [value, setValue] = useState<string | undefined>(awal);
  return (
    <PhotoField
      invitationId={INV}
      label="Foto mempelai pria"
      aspect={aspect}
      value={value}
      initialUrl={initialUrl}
      onChange={(p) => {
        setValue(p);
        onChange(p);
      }}
    />
  );
}

function pasang(
  over: { value?: string; initialUrl?: string | null; aspect?: number } = {},
) {
  const onChange = vi.fn();
  const utils = render(
    <Induk
      awal={over.value}
      initialUrl={over.initialUrl ?? null}
      onChange={onChange}
      aspect={over.aspect}
    />,
  );
  const input = utils.container.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  return { ...utils, onChange, input };
}

function berkas() {
  return new File([new Uint8Array(20)], "foto.jpg", { type: "image/jpeg" });
}

beforeEach(() => {
  vi.clearAllMocks();
  uploadNamedPhotoAction.mockResolvedValue({
    status: "success",
    path: PATH_BARU,
    url: `https://cdn.test/${PATH_BARU}/400.webp`,
  });
});

describe("unggah", () => {
  it("menaruh PATH ke form, bukan URL", async () => {
    const { onChange, input } = pasang();

    fireEvent.change(input, { target: { files: [berkas()] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(PATH_BARU));
    expect(onChange).not.toHaveBeenCalledWith(
      expect.stringContaining("https://"),
    );
  });

  it("menampilkan pratinjau setelah unggah", async () => {
    const { input } = pasang();

    fireEvent.change(input, { target: { files: [berkas()] } });

    const img = await screen.findByRole("img");
    expect(img).toHaveAttribute(
      "src",
      `https://cdn.test/${PATH_BARU}/400.webp`,
    );
  });

  it("berkas bukan gambar → pesan galat, aksi tak dipanggil", async () => {
    const { onChange, input } = pasang();

    fireEvent.change(input, {
      target: {
        files: [new File(["x"], "a.pdf", { type: "application/pdf" })],
      },
    });

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(uploadNamedPhotoAction).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("aksi gagal → pesan galat, form TIDAK diubah", async () => {
    // Menulis path yang gagal diunggah ke form akan membuat undangan menunjuk
    // objek yang tak pernah ada — 404 di depan tamu.
    uploadNamedPhotoAction.mockResolvedValue({
      status: "error",
      message: "Gagal mengunggah foto. Coba lagi.",
    });
    const { onChange, input } = pasang();

    fireEvent.change(input, { target: { files: [berkas()] } });

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("mengganti & membuang", () => {
  it("mengganti foto MENGHAPUS objek lama", async () => {
    const { input } = pasang({
      value: PATH_LAMA,
      initialUrl: `https://cdn.test/${PATH_LAMA}/400.webp`,
    });

    fireEvent.change(input, { target: { files: [berkas()] } });

    await waitFor(() =>
      expect(deleteNamedPhotoAction).toHaveBeenCalledWith(INV, PATH_LAMA),
    );
  });

  it("tombol Hapus mengosongkan form DAN menghapus objeknya", async () => {
    const { onChange } = pasang({
      value: PATH_LAMA,
      initialUrl: `https://cdn.test/${PATH_LAMA}/400.webp`,
    });

    fireEvent.click(screen.getByRole("button", { name: "Hapus" }));

    expect(onChange).toHaveBeenCalledWith(undefined);
    await waitFor(() =>
      expect(deleteNamedPhotoAction).toHaveBeenCalledWith(INV, PATH_LAMA),
    );
  });

  it("tanpa foto tersimpan, tombol Hapus tidak ada", () => {
    pasang();
    expect(screen.queryByRole("button", { name: "Hapus" })).toBeNull();
  });

  it("unggah PERTAMA tidak memanggil hapus apa pun", async () => {
    const { input } = pasang();

    fireEvent.change(input, { target: { files: [berkas()] } });

    await waitFor(() => expect(uploadNamedPhotoAction).toHaveBeenCalled());
    expect(deleteNamedPhotoAction).not.toHaveBeenCalled();
  });
});

describe("pemangkas (aspect diberikan)", () => {
  const ASPEK = 4 / 5;

  it("memilih berkas MEMBUKA pemangkas dan belum mengunggah apa pun", async () => {
    // Unggah sebelum pemilik menekan "Simpan" berarti objek yatim untuk setiap
    // foto yang batal dipakai.
    const { input } = pasang({ aspect: ASPEK });

    fireEvent.change(input, { target: { files: [berkas()] } });

    expect(
      await screen.findByRole("button", { name: "Simpan foto" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /pratinjau pemangkasan/i }),
    ).toBeInTheDocument();
    expect(uploadNamedPhotoAction).not.toHaveBeenCalled();
  });

  it('"Simpan foto" memangkas lalu mengunggah hasil pangkasannya', async () => {
    const { onChange, input } = pasang({ aspect: ASPEK });

    fireEvent.change(input, { target: { files: [berkas()] } });
    fireEvent.click(await screen.findByRole("button", { name: "Simpan foto" }));

    await waitFor(() => expect(cropToVariants).toHaveBeenCalled());
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(PATH_BARU));
    // Yang diunggah HASIL PANGKASAN, bukan gambar utuh.
    expect(uploadNamedPhotoAction).toHaveBeenCalledTimes(1);
  });

  it('"Batal" menutup pemangkas tanpa mengunggah', async () => {
    const { onChange, input } = pasang({ aspect: ASPEK });

    fireEvent.change(input, { target: { files: [berkas()] } });
    fireEvent.click(await screen.findByRole("button", { name: "Batal" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Simpan foto" })).toBeNull(),
    );
    expect(uploadNamedPhotoAction).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Unggah foto" }),
    ).toBeInTheDocument();
  });

  it("menyediakan kendali perbesaran", async () => {
    const { input } = pasang({ aspect: ASPEK });
    fireEvent.change(input, { target: { files: [berkas()] } });
    // `findBy`: bitmap dimuat asinkron, jadi menunggu dulu agar tak ada
    // pembaruan state yang lolos di luar `act`.
    expect(await screen.findByLabelText("Perbesaran")).toHaveAttribute(
      "type",
      "range",
    );
  });

  it("TANPA aspect, berkas langsung diunggah tanpa pemangkas", async () => {
    // Foto sampul & logo belum punya wadah tema, jadi rasio pangkasnya akan
    // jadi tebakan — lebih jujur tidak memangkas sama sekali.
    const { input } = pasang();

    fireEvent.change(input, { target: { files: [berkas()] } });

    await waitFor(() => expect(uploadNamedPhotoAction).toHaveBeenCalled());
    expect(cropToVariants).not.toHaveBeenCalled();
  });

  it("perbesaran yang dipilih IKUT ke hasil pangkasan", async () => {
    // Inti seluruh fiturnya. Tanpa assert ini, pemangkas yang mengabaikan
    // slider tetap lolos semua test lain: ia tetap memanggil pemangkasan,
    // tetap mengunggah, dan tetap terlihat benar di UI.
    const { input } = pasang({ aspect: ASPEK });
    fireEvent.change(input, { target: { files: [berkas()] } });

    const slider = await screen.findByLabelText("Perbesaran");
    fireEvent.change(slider, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan foto" }));

    await waitFor(() => expect(cropToVariants).toHaveBeenCalled());
    const crop = cropToVariants.mock.calls[0][1];
    // bitmap tiruan 1200x1600, aspect 0,8 -> di zoom 1 lebar pangkas 1200.
    expect(crop.sw).toBeCloseTo(1200 / 3, 5);
    expect(crop.sw / crop.sh).toBeCloseTo(ASPEK, 5);
  });
});

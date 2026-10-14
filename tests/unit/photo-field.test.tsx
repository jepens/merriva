import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Photo } from "@/lib/validation/content";

/**
 * `PhotoField` — unggah + penyesuaian foto bernama (THEME-CONTRACT §3).
 *
 * Tiga janji yang mudah hilang saat komponen ini dirapikan kelak:
 *  - yang masuk ke form hanyalah `{ path, x, y, zoom }` — URL dirakit di
 *    server, dan menyimpan URL vendor ke `content` dilarang SPEC §6.4;
 *  - penyesuaian TIDAK dipanggang ke berkas, jadi mengubah zoom/geser tak
 *    mengunggah apa pun dan tak pernah menurunkan mutu;
 *  - mengganti/membuang foto MENGHAPUS objek lamanya. Tanpa itu tiap
 *    pergantian menumpuk objek yatim yang tak satu pun baris DB menunjuknya.
 */

const { uploadNamedPhotoAction, deleteNamedPhotoAction } = vi.hoisted(() => ({
  uploadNamedPhotoAction: vi.fn(),
  deleteNamedPhotoAction: vi.fn((_inv: string, _path: string) =>
    Promise.resolve({ status: "success" }),
  ),
}));
vi.mock("@/server/actions/named-photo", () => ({
  uploadNamedPhotoAction,
  deleteNamedPhotoAction,
}));

vi.mock("@/lib/image/compress", () => ({
  isSupportedImage: (f: File) => f.type.startsWith("image/"),
  compressToWebpVariants: vi.fn(() =>
    Promise.resolve({
      display: new File([new Uint8Array(10)], "d", { type: "image/webp" }),
      thumb: new File([new Uint8Array(5)], "t", { type: "image/webp" }),
      width: 1280,
      height: 1600,
    }),
  ),
}));

import { PhotoField } from "@/components/dashboard/editor/photo-field";

const INV = "44444444-4444-4444-8444-444444444444";
const PATH_BARU = `inv/${INV}/foto/11111111-1111-4111-8111-111111111111`;
const PATH_LAMA = `inv/${INV}/foto/22222222-2222-4222-8222-222222222222`;
const FOTO_LAMA: Photo = { path: PATH_LAMA, x: 0.3, y: 0.7, zoom: 2 };
const URL_LAMA = `https://cdn.test/${PATH_LAMA}/1600.webp`;

/** `PhotoField` TERKONTROL: `value` datang dari form, seperti di editor nyata. */
function Induk({
  awal,
  initialUrl,
  onChange,
}: {
  awal?: Photo;
  initialUrl: string | null;
  onChange: (p: Photo | undefined) => void;
}) {
  const [value, setValue] = useState<Photo | undefined>(awal);
  return (
    <PhotoField
      invitationId={INV}
      label="Foto mempelai pria"
      aspect={4 / 5}
      value={value}
      initialUrl={initialUrl}
      onChange={(p) => {
        setValue(p);
        onChange(p);
      }}
    />
  );
}

function pasang(over: { value?: Photo; initialUrl?: string | null } = {}) {
  const onChange = vi.fn();
  const utils = render(
    <Induk
      awal={over.value}
      initialUrl={over.initialUrl ?? null}
      onChange={onChange}
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
    url: `https://cdn.test/${PATH_BARU}/1600.webp`,
  });
});

describe("unggah", () => {
  it("menaruh `{ path, x, y, zoom }` ke form — bukan URL", async () => {
    const { onChange, input } = pasang();

    fireEvent.change(input, { target: { files: [berkas()] } });

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        path: PATH_BARU,
        x: 0.5,
        y: 0.5,
        zoom: 1,
      }),
    );
  });

  it("foto BARU mulai dari titik tengah, tak mewarisi penyesuaian foto lama", async () => {
    // Kalau diwarisi, foto yang sama sekali berbeda tiba-tiba tampil terpotong
    // aneh dan pemilik tak punya petunjuk kenapa.
    const { onChange, input } = pasang({
      value: FOTO_LAMA,
      initialUrl: URL_LAMA,
    });

    fireEvent.change(input, { target: { files: [berkas()] } });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls[0]?.[0]).toMatchObject({
      x: 0.5,
      y: 0.5,
      zoom: 1,
    });
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

describe("penyesuaian", () => {
  it("pratinjau memakai titik fokus & perbesaran, sama seperti tema", () => {
    pasang({ value: FOTO_LAMA, initialUrl: URL_LAMA });

    const img = screen.getByRole("img");
    expect(img).toHaveStyle({ objectPosition: "30% 70%" });
    expect(img).toHaveStyle({ transform: "scale(2)" });
    expect(img).toHaveStyle({ transformOrigin: "30% 70%" });
  });

  it("menggeser slider mengubah zoom TANPA mengunggah apa pun", async () => {
    // Inti model non-destruktif: penyesuaian hanyalah angka.
    const { onChange } = pasang({ value: FOTO_LAMA, initialUrl: URL_LAMA });

    fireEvent.change(screen.getByLabelText("Perbesaran"), {
      target: { value: "3" },
    });

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ ...FOTO_LAMA, zoom: 3 }),
    );
    expect(uploadNamedPhotoAction).not.toHaveBeenCalled();
    expect(deleteNamedPhotoAction).not.toHaveBeenCalled();
  });

  it("tanpa foto, tak ada kendali penyesuaian", () => {
    pasang();
    expect(screen.queryByLabelText("Perbesaran")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("mengganti & membuang", () => {
  it("mengganti foto MENGHAPUS objek lama", async () => {
    const { input } = pasang({ value: FOTO_LAMA, initialUrl: URL_LAMA });

    fireEvent.change(input, { target: { files: [berkas()] } });

    await waitFor(() =>
      expect(deleteNamedPhotoAction).toHaveBeenCalledWith(INV, PATH_LAMA),
    );
  });

  it("tombol Hapus mengosongkan form DAN menghapus objeknya", async () => {
    const { onChange } = pasang({ value: FOTO_LAMA, initialUrl: URL_LAMA });

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

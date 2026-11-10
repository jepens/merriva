import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Langkah Galeri mengikuti TEMA AKTIF (DECISIONS #103), pada editor ASLI:
 * - tema tanpa section galeri (sakinah) tak ditawari unggah galeri — fotonya
 *   memakan kuota paket dan tak pernah tampil — dan centangnya tak menuntut
 *   foto galeri;
 * - foto pratinjau tautan TETAP ada: ia dirender `/api/og`, bukan tema;
 * - tanpa `showGallery` (tema bergaleri, editor keluarga & corporate)
 *   perilakunya tak berubah.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/server/actions/invitation", () => ({
  saveInvitationDraftAction: vi.fn(async () => ({ status: "success" })),
  checkSlugAvailabilityAction: vi.fn(),
  updateInvitationSlugAction: vi.fn(),
}));
vi.mock("@/server/actions/media", () => ({
  deleteGalleryPhotoAction: vi.fn(),
  uploadGalleryPhotoAction: vi.fn(),
}));

import { CorporateEditor } from "@/components/dashboard/editor/corporate-editor";
import { FamilyEditor } from "@/components/dashboard/editor/family-editor";
import { WeddingEditor } from "@/components/dashboard/editor/wedding-editor";
import { copy } from "@/lib/copy";
import { OG_ASPECT } from "@/lib/media";
import {
  DEFAULT_SETTINGS,
  draftContentSchema,
  emptyContent,
} from "@/lib/validation/content";
import type { InvitationMediaView } from "@/types/invitation";

const EDITORS = {
  wedding: WeddingEditor,
  corporate: CorporateEditor,
  family: FamilyEditor,
} as const;

/** Foto galeri yang SUDAH tersimpan sebelum editor dibuka. */
const FOTO: InvitationMediaView = {
  id: "11111111-1111-4111-8111-111111111111",
  url: "/media/inv/x/galeri/1/1600.webp",
  thumbUrl: "/media/inv/x/galeri/1/400.webp",
  width: 1600,
  height: 1200,
};

function props(
  category: keyof typeof EDITORS,
  media: InvitationMediaView[] = [],
): ComponentProps<typeof FamilyEditor> {
  return {
    invitationId: "9a500f03-f12d-4d66-85fc-af8ebcedd350",
    slug: "draft-abc",
    defaultValues: {
      eventDate: "",
      content: draftContentSchema.parse(emptyContent(category)),
      settings: DEFAULT_SETTINGS,
      events: [],
    },
    initialMedia: media,
    maxPhotos: 8,
    songs: [],
    // Seperti halaman edit: slot sampul SELALU ada (rasio kanvas OG), apa pun
    // temanya.
    photoSlots: { cover: { aspect: OG_ASPECT, url: null } },
    music: { allowed: false, lockedAt: null, path: null, url: null },
    video: { allowed: false, url: null, posterUrl: null },
    initialStep: "gallery",
  };
}

const tombolGaleri = () =>
  document.querySelector<HTMLButtonElement>('[data-step-key="gallery"]')!;
const pengunggahGaleri = () =>
  screen.queryByRole("button", { name: copy.editor.gallery.add });
const fotoGaleri = () => document.querySelector(`img[src="${FOTO.thumbUrl}"]`);

afterEach(cleanup);

describe("tema tanpa section galeri (showGallery=false)", () => {
  it("unggah & daftar galeri tak ditawarkan, diganti penjelasan", () => {
    render(<WeddingEditor {...props("wedding", [FOTO])} showGallery={false} />);

    expect(pengunggahGaleri()).toBeNull();
    expect(document.querySelector('input[type="file"][multiple]')).toBeNull();
    expect(fotoGaleri()).toBeNull();
    expect(
      screen.getByText(copy.editor.gallery.notInTheme),
    ).toBeInTheDocument();
  });

  it("foto pratinjau tautan TETAP bisa diunggah", () => {
    render(<WeddingEditor {...props("wedding")} showGallery={false} />);

    expect(screen.getByLabelText(copy.editor.photo.coverLabel)).toHaveAttribute(
      "type",
      "file",
    );
    expect(
      screen.getByRole("button", { name: copy.editor.photo.add }),
    ).toBeEnabled();
  });

  it("centang langkah tak menuntut foto galeri", () => {
    render(<WeddingEditor {...props("wedding")} showGallery={false} />);
    expect(tombolGaleri()).toHaveTextContent("✓");
  });
});

describe("tanpa showGallery: perilaku lama", () => {
  it.each(["wedding", "corporate", "family"] as const)(
    "%s: pengunggah ditawarkan dan centang menunggu foto galeri",
    (category) => {
      const Editor = EDITORS[category];
      render(<Editor {...props(category)} />);

      expect(pengunggahGaleri()).toBeEnabled();
      expect(
        screen.getByText(copy.editor.photo.coverLabel),
      ).toBeInTheDocument();
      expect(screen.queryByText(copy.editor.gallery.notInTheme)).toBeNull();
      expect(tombolGaleri()).not.toHaveTextContent("✓");
    },
  );

  it("foto galeri tersimpan tampil di daftar (kontrol bagi test tema tanpa galeri)", () => {
    render(<WeddingEditor {...props("wedding", [FOTO])} />);
    expect(fotoGaleri()).not.toBeNull();
    expect(tombolGaleri()).toHaveTextContent("✓");
  });
});

describe("tema yang merender sampul di halamannya (slot cover `inTheme`)", () => {
  // `warta` (halaman muka koran): petunjuk "bukan di halaman undangannya"
  // akan membuat pemilik tak mengunggah — halaman muka lalu tampil monogram.
  it("label & petunjuk menyebut halaman undangan, bukan hanya WhatsApp", () => {
    render(
      <WeddingEditor
        {...props("wedding")}
        photoSlots={{ cover: { aspect: 4 / 3, url: null, inTheme: true } }}
      />,
    );

    expect(
      screen.getByLabelText(copy.editor.photo.coverLabelInTheme),
    ).toHaveAttribute("type", "file");
    expect(
      screen.getByText(copy.editor.photo.coverHintInTheme),
    ).toBeInTheDocument();
    expect(screen.queryByText(copy.editor.photo.coverHint)).toBeNull();
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  useForm,
  type DefaultValues,
  type UseFormReturn,
} from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorValues } from "@/components/dashboard/editor/types";
import type { Photo } from "@/lib/validation/content";

/**
 * Tombol "Hapus" foto bernama di langkah editor — dengan `useForm` ASLI.
 *
 * `photo-field.test.tsx` memakai induk `useState`, jadi tak pernah melihat
 * bahwa `setValue(…, undefined, { shouldDirty: true })` membuat
 * react-hook-form 7.90 melempar TypeError di `getDirtyFields` (nilai bawaan
 * berupa objek, nilai baru `undefined`). Akibatnya di produksi: tombolnya
 * diam, objek foto tak terhapus, dan autosave tak pernah terpicu.
 */

const { deleteNamedPhotoAction } = vi.hoisted(() => ({
  deleteNamedPhotoAction: vi.fn((_inv: string, _path: string) =>
    Promise.resolve({ status: "success" }),
  ),
}));
vi.mock("@/server/actions/named-photo", () => ({
  uploadNamedPhotoAction: vi.fn(),
  deleteNamedPhotoAction,
}));
vi.mock("@/server/actions/media", () => ({
  uploadGalleryPhotoAction: vi.fn(),
  deleteGalleryPhotoAction: vi.fn(),
}));

import { CoupleStep } from "@/components/dashboard/editor/steps/couple-step";
import { GalleryStep } from "@/components/dashboard/editor/steps/gallery-step";
import { OrganizerStep } from "@/components/dashboard/editor/steps/organizer-step";

const INV = "44444444-4444-4444-8444-444444444444";
const PATH = `inv/${INV}/foto/22222222-2222-4222-8222-222222222222`;
const FOTO: Photo = { path: PATH, x: 0.3, y: 0.7, zoom: 2 };
const SLOT = { aspect: 4 / 5, url: `https://cdn.test/${PATH}/1600.webp` };

type Kasus = {
  nama: string;
  field: "content.groom.photo" | "content.coverPhoto" | "content.logo";
  content: Record<string, unknown>;
  step: (form: UseFormReturn<EditorValues>) => ReactNode;
};

const KASUS: Kasus[] = [
  {
    nama: "foto mempelai",
    field: "content.groom.photo",
    content: { groom: { name: "Bima", photo: FOTO }, bride: { name: "Rina" } },
    step: (form) => (
      <CoupleStep form={form} invitationId={INV} photoSlots={{ groom: SLOT }} />
    ),
  },
  {
    nama: "foto sampul",
    field: "content.coverPhoto",
    content: { coverPhoto: FOTO },
    step: (form) => (
      <GalleryStep
        form={form}
        invitationId={INV}
        coverSlot={SLOT}
        maxPhotos={8}
        media={[]}
        setMedia={() => {}}
        showGallery={false}
      />
    ),
  },
  {
    nama: "logo",
    field: "content.logo",
    content: { logo: FOTO, pic: {} },
    step: (form) => (
      <OrganizerStep form={form} invitationId={INV} logoSlot={SLOT} />
    ),
  },
];

function Induk({
  kasus,
  onForm,
}: {
  kasus: Kasus;
  onForm: (form: UseFormReturn<EditorValues>) => void;
}) {
  const form = useForm<EditorValues>({
    defaultValues: {
      content: kasus.content,
    } as unknown as DefaultValues<EditorValues>,
  });
  onForm(form);
  return <>{kasus.step(form)}</>;
}

beforeEach(() => vi.clearAllMocks());

describe("Hapus foto bernama dengan form asli", () => {
  it.each(KASUS)(
    "$nama: form kosong, autosave terpicu, objek dihapus",
    async (kasus) => {
      let form: UseFormReturn<EditorValues> | undefined;
      render(<Induk kasus={kasus} onForm={(f) => (form = f)} />);
      // Pemicu autosave yang sama dengan `use-autosave.ts`.
      const autosave = vi.fn();
      const sub = form!.watch(autosave);

      fireEvent.click(screen.getByRole("button", { name: "Hapus" }));

      await waitFor(() =>
        expect(deleteNamedPhotoAction).toHaveBeenCalledWith(INV, PATH),
      );
      expect(form!.getValues(kasus.field)).toBeUndefined();
      expect(autosave).toHaveBeenCalled();
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: "Hapus" })).toBeNull(),
      );
      sub.unsubscribe();
    },
  );
});

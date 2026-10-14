import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `?langkah=jadwal` (DECISIONS #44): tombol "Lengkapi jadwal" di halaman
 * aktivasi membuka editor LANGSUNG di langkah Jadwal — di ketiga kategori,
 * walau posisi langkahnya berbeda (keluarga: ke-2; lainnya: ke-3). Nilai tak
 * dikenal → langkah pertama, bukan galat.
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
import type { EditorValues } from "@/components/dashboard/editor/types";
import { WeddingEditor } from "@/components/dashboard/editor/wedding-editor";
import { copy } from "@/lib/copy";
import { stepKeyFromParam } from "@/lib/editor-links";
import {
  DEFAULT_SETTINGS,
  draftContentSchema,
  emptyContent,
} from "@/lib/validation/content";

const EDITORS = {
  wedding: WeddingEditor,
  corporate: CorporateEditor,
  family: FamilyEditor,
} as const;

function renderEditor(
  category: keyof typeof EDITORS,
  initialStep: string | undefined,
) {
  const values: EditorValues = {
    eventDate: "",
    content: draftContentSchema.parse(emptyContent(category)),
    settings: DEFAULT_SETTINGS,
    events: [],
  };
  const Editor = EDITORS[category];
  render(
    <Editor
      invitationId="9a500f03-f12d-4d66-85fc-af8ebcedd350"
      slug="draft-abc"
      defaultValues={values}
      initialMedia={[]}
      maxPhotos={8}
      songs={[]}
      photoSlots={{}}
      initialStep={initialStep}
    />,
  );
}

const aktif = () =>
  document.querySelector<HTMLButtonElement>('[aria-current="step"]');

afterEach(cleanup);

describe.each(["wedding", "corporate", "family"] as const)(
  "editor %s",
  (category) => {
    it("?langkah=jadwal → langkah Jadwal terbuka lebih dulu", () => {
      renderEditor(category, stepKeyFromParam("jadwal"));
      expect(aktif()).toHaveAttribute("data-step-key", "schedule");
      expect(
        screen.getByRole("button", { name: copy.editor.schedule.add }),
      ).toBeInTheDocument();
    });

    it.each([undefined, "bogus"])(
      "langkah %j → langkah pertama seperti biasa",
      (initialStep) => {
        renderEditor(category, initialStep);
        expect(aktif()).toHaveAttribute("data-step-key", "info");
      },
    );
  },
);

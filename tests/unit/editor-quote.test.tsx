import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kutipan ayat/quote di langkah Pengaturan (SPEC §4.4 langkah 7, DECISIONS
 * #133). Semua tema merender `content.quote`, tetapi editor dulu tak punya
 * isiannya sama sekali — kutipan hanya pernah tampil di data demo.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
const { saveInvitationDraftAction } = vi.hoisted(() => ({
  saveInvitationDraftAction: vi.fn(async (_id: string, _patch: unknown) => ({
    status: "success" as const,
  })),
}));
vi.mock("@/server/actions/invitation", () => ({
  saveInvitationDraftAction,
  checkSlugAvailabilityAction: vi.fn(),
  updateInvitationSlugAction: vi.fn(),
}));
vi.mock("@/server/actions/media", () => ({
  deleteGalleryPhotoAction: vi.fn(),
  uploadGalleryPhotoAction: vi.fn(),
}));

import { WeddingEditor } from "@/components/dashboard/editor/wedding-editor";
import { copy } from "@/lib/copy";
import { OG_ASPECT } from "@/lib/media";
import {
  DEFAULT_SETTINGS,
  draftContentSchema,
  emptyContent,
} from "@/lib/validation/content";

const F = copy.editor.fields;

function props(quote?: {
  text: string;
  source?: string;
}): ComponentProps<typeof WeddingEditor> {
  return {
    invitationId: "9a500f03-f12d-4d66-85fc-af8ebcedd350",
    slug: "draft-abc",
    defaultValues: {
      eventDate: "",
      content: draftContentSchema.parse({
        ...emptyContent("wedding"),
        ...(quote ? { quote } : {}),
      }),
      settings: DEFAULT_SETTINGS,
      events: [],
    },
    initialMedia: [],
    maxPhotos: 8,
    songs: [],
    photoSlots: { cover: { aspect: OG_ASPECT, url: null } },
    music: { allowed: false, lockedAt: null, path: null, url: null },
    video: { allowed: false, url: null, posterUrl: null },
    initialStep: "settings",
  };
}

const terakhirDisimpan = () =>
  saveInvitationDraftAction.mock.calls.at(-1)?.[1] as
    { content?: { quote?: { text?: string; source?: string } } } | undefined;

beforeEach(() => saveInvitationDraftAction.mockClear());
afterEach(cleanup);

describe("langkah Pengaturan — kutipan ayat", () => {
  it("ada isian kutipan & sumber; ketikan tersimpan lewat autosave", async () => {
    render(<WeddingEditor {...props()} />);
    fireEvent.change(screen.getByLabelText(F.quoteText), {
      target: { value: "Cinta itu sabar." },
    });
    fireEvent.change(screen.getByLabelText(F.quoteSource), {
      target: { value: "1 Korintus 13:4" },
    });
    await waitFor(
      () =>
        expect(terakhirDisimpan()?.content?.quote).toEqual({
          text: "Cinta itu sabar.",
          source: "1 Korintus 13:4",
        }),
      { timeout: 4000 },
    );
  });

  it("tombol praset mengisi QS. Ar-Rum : 21 persis seperti acuan", async () => {
    render(<WeddingEditor {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: F.quotePreset }));
    expect(
      (screen.getByLabelText(F.quoteText) as HTMLTextAreaElement).value,
    ).toBe(F.quotePresetText);
    await waitFor(
      () =>
        expect(terakhirDisimpan()?.content?.quote).toEqual({
          text: F.quotePresetText,
          source: "QS. Ar-Rum : 21",
        }),
      { timeout: 4000 },
    );
  });

  it("praset tak ditawarkan bila kutipan sudah terisi — tak menimpa ketikan", () => {
    render(<WeddingEditor {...props({ text: "Ayat pilihan saya." })} />);
    expect(screen.queryByRole("button", { name: F.quotePreset })).toBeNull();
  });
});

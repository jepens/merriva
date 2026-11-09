import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Isian "Mulai" di langkah Jadwal (DECISIONS #42), pada editor ASLI:
 * - sesi berisi tanpa jam → catatan (bukan galat) yang terhubung ke isiannya;
 * - pengaman: mengosongkan jam sesi yang sudah berjam TIDAK menimpa jam
 *   tersimpan (dulu sesi hilang dari undangan aktif begitu autosave jalan);
 * - centang langkah hanya bila semua sesi berisi sudah berjam.
 */

const { saveDraft } = vi.hoisted(() => ({ saveDraft: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/server/actions/invitation", () => ({
  saveInvitationDraftAction: saveDraft,
  checkSlugAvailabilityAction: vi.fn(),
  updateInvitationSlugAction: vi.fn(),
}));
vi.mock("@/server/actions/media", () => ({
  deleteGalleryPhotoAction: vi.fn(),
  uploadGalleryPhotoAction: vi.fn(),
}));

import type { EditorValues } from "@/components/dashboard/editor/types";
import { CorporateEditor } from "@/components/dashboard/editor/corporate-editor";
import { FamilyEditor } from "@/components/dashboard/editor/family-editor";
import { WeddingEditor } from "@/components/dashboard/editor/wedding-editor";
import { copy } from "@/lib/copy";
import {
  DEFAULT_SETTINGS,
  draftContentSchema,
  emptyContent,
} from "@/lib/validation/content";

const EMPTY = {
  name: "",
  startAt: "",
  endAt: "",
  venueName: "",
  address: "",
  mapsUrl: "",
};

const EDITORS = {
  wedding: WeddingEditor,
  corporate: CorporateEditor,
  family: FamilyEditor,
} as const;

function renderWith(
  events: Partial<typeof EMPTY>[],
  category: keyof typeof EDITORS = "wedding",
) {
  const values: EditorValues = {
    eventDate: "",
    content: draftContentSchema.parse(emptyContent(category)),
    settings: DEFAULT_SETTINGS,
    events: events.map((e) => ({ ...EMPTY, ...e })),
  };
  const Editor = EDITORS[category];
  return render(
    <Editor
      invitationId="9a500f03-f12d-4d66-85fc-af8ebcedd350"
      slug="draft-abc"
      defaultValues={values}
      initialMedia={[]}
      maxPhotos={8}
      songs={[]}
      photoSlots={{}}
      music={{ allowed: false, lockedAt: null, path: null, url: null }}
      video={{ allowed: false, url: null, posterUrl: null }}
    />,
  );
}

const tombolJadwal = () =>
  document.querySelector<HTMLButtonElement>('[data-step-key="schedule"]')!;

async function bukaJadwal() {
  const user = userEvent.setup();
  await user.click(tombolJadwal());
  return user;
}

const isianMulai = () => screen.getAllByLabelText(copy.editor.schedule.start);

afterEach(cleanup);
beforeEach(() => {
  saveDraft.mockReset();
  saveDraft.mockResolvedValue({ status: "success" });
});

describe("catatan sesi tanpa jam mulai", () => {
  it("sesi berisi tanpa jam: catatan terhubung ke isian Mulai, bukan galat", async () => {
    renderWith([{ name: "Resepsi", venueName: "Gedung Mawar" }]);
    await bukaJadwal();
    const mulai = isianMulai()[0];
    expect(mulai).toHaveAccessibleDescription(
      copy.editor.schedule.startMissing,
    );
    expect(mulai).not.toHaveAttribute("aria-invalid");

    fireEvent.change(mulai, { target: { value: "2026-08-15T10:00" } });
    expect(isianMulai()[0]).not.toHaveAccessibleDescription(
      copy.editor.schedule.startMissing,
    );
  });

  it("kartu sesi baru yang masih kosong tidak diberi catatan", async () => {
    renderWith([]);
    const user = await bukaJadwal();
    await user.click(
      screen.getByRole("button", { name: copy.editor.schedule.add }),
    );
    expect(isianMulai()[0]).not.toHaveAccessibleDescription(
      copy.editor.schedule.startMissing,
    );
  });
});

describe("pengaman isian Mulai", () => {
  it("mengosongkan jam sesi berjam TIDAK menimpa jam tersimpan", async () => {
    renderWith([{ name: "Akad", startAt: "2026-08-15T10:00" }]);
    const user = await bukaJadwal();
    const mulai = isianMulai()[0];

    // datetime-local melapor "" selama salah satu segmennya kosong.
    fireEvent.change(mulai, { target: { value: "" } });
    fireEvent.blur(mulai);
    expect(mulai).toHaveAccessibleDescription(copy.editor.schedule.startKept);

    // Autosave berikutnya (dipicu isian lain) tetap membawa jam lama.
    await user.type(
      screen.getAllByLabelText(copy.editor.schedule.venue)[0],
      "M",
    );
    await waitFor(() => expect(saveDraft).toHaveBeenCalled(), {
      timeout: 3000,
    });
    const payload = saveDraft.mock.calls.at(-1)?.[1] as EditorValues;
    expect(payload.events[0].startAt).toBe("2026-08-15T10:00");
  });

  it("jam baru yang lengkap tetap tersimpan", async () => {
    renderWith([{ name: "Akad", startAt: "2026-08-15T10:00" }]);
    await bukaJadwal();
    const mulai = isianMulai()[0];
    fireEvent.change(mulai, { target: { value: "" } });
    fireEvent.change(mulai, { target: { value: "2026-09-01T09:00" } });
    await waitFor(() => expect(saveDraft).toHaveBeenCalled(), {
      timeout: 3000,
    });
    const payload = saveDraft.mock.calls.at(-1)?.[1] as EditorValues;
    expect(payload.events[0].startAt).toBe("2026-09-01T09:00");
    expect(mulai).not.toHaveAccessibleDescription(
      copy.editor.schedule.startKept,
    );
  });

  it("sesi yang belum pernah berjam tidak diberi jam karangan", async () => {
    renderWith([{ name: "Resepsi", venueName: "Gedung" }]);
    const user = await bukaJadwal();
    // blur SELALU membawa nilai DOM ke pengaman/RHF (change ke nilai yang sama
    // diabaikan pelacak nilai React, jadi tak membuktikan apa pun).
    fireEvent.blur(isianMulai()[0]);
    expect(isianMulai()[0]).toHaveAccessibleDescription(
      copy.editor.schedule.startMissing,
    );
    await user.type(
      screen.getAllByLabelText(copy.editor.schedule.venue)[0],
      "X",
    );
    await waitFor(() => expect(saveDraft).toHaveBeenCalled(), {
      timeout: 3000,
    });
    const payload = saveDraft.mock.calls.at(-1)?.[1] as EditorValues;
    expect(payload.events[0].startAt).toBe("");
  });
});

describe("pengaman: nilai antara saat tahun diketik ulang (Chrome desktop)", () => {
  // Diukur di Chrome: mengetik "2027" di segmen Tahun memancarkan berturut-turut
  // "0002-…", "0020-…", "0202-…", lalu "2027-…". Dulu hanya "" yang ditahan,
  // sehingga "0002-…" lolos, tersimpan tanpa jam, dan sesi hilang dari undangan.
  it("tahun setengah jadi TIDAK menimpa jam tersimpan; tahun lengkap diterima", async () => {
    renderWith([{ name: "Akad", startAt: "2026-08-15T10:00" }]);
    const user = await bukaJadwal();
    const mulai = isianMulai()[0];
    for (const v of [
      "0002-08-15T10:00",
      "0020-08-15T10:00",
      "0202-08-15T10:00",
    ]) {
      fireEvent.change(mulai, { target: { value: v } });
    }
    expect(mulai).toHaveAccessibleDescription(copy.editor.schedule.startKept);

    await user.type(
      screen.getAllByLabelText(copy.editor.schedule.venue)[0],
      "M",
    );
    await waitFor(() => expect(saveDraft).toHaveBeenCalled(), {
      timeout: 3000,
    });
    expect(
      (saveDraft.mock.calls.at(-1)?.[1] as EditorValues).events[0].startAt,
    ).toBe("2026-08-15T10:00");

    saveDraft.mockClear();
    fireEvent.change(mulai, { target: { value: "2027-08-15T10:00" } });
    await waitFor(() => expect(saveDraft).toHaveBeenCalled(), {
      timeout: 3000,
    });
    expect(
      (saveDraft.mock.calls.at(-1)?.[1] as EditorValues).events[0].startAt,
    ).toBe("2027-08-15T10:00");
  });

  it('"0002-…" lalu dikosongkan: catatan jujur, jam lama tetap yang tersimpan', async () => {
    renderWith([{ name: "Akad", startAt: "2026-08-15T10:00" }]);
    const user = await bukaJadwal();
    const mulai = isianMulai()[0];
    fireEvent.change(mulai, { target: { value: "0002-08-15T10:00" } });
    fireEvent.change(mulai, { target: { value: "" } });
    fireEvent.blur(mulai);
    expect(mulai).toHaveAccessibleDescription(copy.editor.schedule.startKept);

    await user.type(
      screen.getAllByLabelText(copy.editor.schedule.venue)[0],
      "M",
    );
    await waitFor(() => expect(saveDraft).toHaveBeenCalled(), {
      timeout: 3000,
    });
    expect(
      (saveDraft.mock.calls.at(-1)?.[1] as EditorValues).events[0].startAt,
    ).toBe("2026-08-15T10:00");
  });

  it("catatan juga diumumkan lewat region status yang selalu ada (WCAG 4.1.3)", async () => {
    renderWith([{ name: "Akad", startAt: "2026-08-15T10:00" }]);
    await bukaJadwal();
    const status = () =>
      screen
        .getAllByRole("status")
        .filter((el) => el.classList.contains("sr-only"));
    // Region sudah ada SEBELUM catatan muncul (region baru sering diabaikan).
    expect(status()).toHaveLength(1);
    expect(status()[0]).toHaveTextContent("");

    fireEvent.change(isianMulai()[0], { target: { value: "" } });
    expect(status()[0]).toHaveTextContent(copy.editor.schedule.startKept);
  });
});

describe.each(["wedding", "corporate", "family"] as const)(
  "centang langkah Jadwal (%s)",
  (category) => {
    it("TIDAK tercentang bila ada sesi berisi yang belum berjam", () => {
      renderWith(
        [
          { name: "Akad", startAt: "2026-08-15T08:00" },
          { name: "Resepsi", venueName: "Gedung Mawar" },
        ],
        category,
      );
      expect(tombolJadwal()).not.toHaveTextContent("✓");
    });

    it("tercentang bila semua sesi berisi sudah berjam (kartu kosong diabaikan)", () => {
      renderWith([{ name: "Akad", startAt: "2026-08-15T08:00" }, {}], category);
      expect(tombolJadwal()).toHaveTextContent("✓");
    });
  },
);

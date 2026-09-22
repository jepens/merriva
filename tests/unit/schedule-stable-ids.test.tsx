import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Id sesi STABIL di editor ASLI (DECISIONS #43). Dulu RPC menghapus lalu
 * menyisipkan ulang semua sesi tiap autosave, sehingga id berganti dan tautan
 * kalender `?e={id}` di halaman yang sudah terbuka menjadi 404. Kini editor
 * membawa id tiap sesi di setiap simpanan: id DB untuk sesi yang dimuat, id
 * baru untuk kartu yang ditambah — dan id itu tak berubah antar-simpanan.
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
import { WeddingEditor } from "@/components/dashboard/editor/wedding-editor";
import { copy } from "@/lib/copy";
import { isUuid } from "@/lib/id";
import {
  DEFAULT_SETTINGS,
  draftContentSchema,
  emptyContent,
} from "@/lib/validation/content";
import type { EventDraft } from "@/lib/validation/content/event";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const EMPTY = {
  name: "",
  startAt: "",
  endAt: "",
  venueName: "",
  address: "",
  mapsUrl: "",
};

function renderWith(events: EventDraft[]) {
  const values: EditorValues = {
    eventDate: "",
    content: draftContentSchema.parse(emptyContent("wedding")),
    settings: DEFAULT_SETTINGS,
    events: events.map((e) => ({ ...EMPTY, ...e })),
  };
  return render(
    <WeddingEditor
      invitationId="9a500f03-f12d-4d66-85fc-af8ebcedd350"
      slug="draft-abc"
      defaultValues={values}
      initialMedia={[]}
      maxPhotos={8}
      songs={[]}
    />,
  );
}

async function bukaJadwal() {
  const user = userEvent.setup();
  await user.click(
    document.querySelector<HTMLButtonElement>('[data-step-key="schedule"]')!,
  );
  return user;
}

/** Id sesi pada simpanan TERAKHIR yang benar-benar dikirim ke server. */
async function idTersimpan(): Promise<(string | undefined)[]> {
  await waitFor(() => expect(saveDraft).toHaveBeenCalled(), { timeout: 3000 });
  const values = saveDraft.mock.calls.at(-1)?.[1] as EditorValues;
  saveDraft.mockClear();
  return values.events.map((e) => e.id);
}

const isian = (label: string) => screen.getAllByLabelText(label);

afterEach(cleanup);
beforeEach(() => {
  saveDraft.mockReset();
  saveDraft.mockResolvedValue({ status: "success" });
});

describe("id sesi di editor (DECISIONS #43)", () => {
  it("kartu baru ber-id UUID sejak ditambah, dan id itu SAMA di setiap simpanan", async () => {
    renderWith([]);
    const user = await bukaJadwal();
    await user.click(
      screen.getByRole("button", { name: copy.editor.schedule.add }),
    );
    await user.type(isian(copy.editor.schedule.name)[0], "Akad");

    const [pertama] = await idTersimpan();
    expect(pertama && isUuid(pertama)).toBe(true);

    await user.type(isian(copy.editor.schedule.venue)[0], "Masjid");
    expect(await idTersimpan()).toEqual([pertama]);
  });

  it("dua kartu baru mendapat id BERBEDA", async () => {
    renderWith([]);
    const user = await bukaJadwal();
    const tambah = screen.getByRole("button", {
      name: copy.editor.schedule.add,
    });
    await user.click(tambah);
    await user.click(tambah);
    await user.type(isian(copy.editor.schedule.name)[0], "Akad");
    await user.type(isian(copy.editor.schedule.name)[1], "Resepsi");

    const [a, b] = await idTersimpan();
    expect(a && isUuid(a) && b && isUuid(b)).toBe(true);
    expect(a).not.toBe(b);
  });

  it("sesi yang dimuat mempertahankan id DB-nya saat disunting", async () => {
    renderWith([
      { id: A, name: "Akad", startAt: "2026-08-15T08:00" },
      { id: B, name: "Resepsi" },
    ]);
    const user = await bukaJadwal();
    await user.type(isian(copy.editor.schedule.venue)[1], "Gedung");
    expect(await idTersimpan()).toEqual([A, B]);
  });

  it("menghapus sesi membuang id-nya; sesi lain tetap ber-id sama; kartu pengganti tak memakai ulang id lama", async () => {
    renderWith([
      { id: A, name: "Akad", startAt: "2026-08-15T08:00" },
      { id: B, name: "Resepsi" },
    ]);
    const user = await bukaJadwal();
    await user.click(
      screen.getAllByRole("button", { name: copy.editor.list.remove })[0],
    );
    expect(await idTersimpan()).toEqual([B]);

    await user.click(
      screen.getByRole("button", { name: copy.editor.schedule.add }),
    );
    await user.type(isian(copy.editor.schedule.name)[1], "Ngunduh");
    const [tetap, baru] = await idTersimpan();
    expect(tetap).toBe(B);
    expect(baru && isUuid(baru)).toBe(true);
    expect([A, B]).not.toContain(baru);
  });
});

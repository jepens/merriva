import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Sapuan batas isian editor (DECISIONS #41). Merender editor ASLI tiap kategori,
 * membuka setiap langkah, lalu untuk SETIAP isian yang dirender memastikan:
 *  1. isian teks punya `maxLength`;
 *  2. skema server ASLI menerima tepat N karakter dan menolak N+1 di path yang
 *     sama — oracle-nya skema, bukan konstanta yang juga dipakai UI, jadi
 *     `maxLength` yang menyimpang dari skema pasti memerah;
 *  3. isian itu terpetakan ke langkah tempat ia dirender (`STEP_FIELDS`), supaya
 *     penolakan server selalu menunjuk langkah yang benar.
 * Isian baru yang lupa diberi batas otomatis tertangkap tanpa menulis test baru.
 */

const { push, saveDraft } = vi.hoisted(() => ({
  push: vi.fn(),
  saveDraft: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
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

import { CorporateEditor } from "@/components/dashboard/editor/corporate-editor";
import { FamilyEditor } from "@/components/dashboard/editor/family-editor";
import { stepForPath } from "@/components/dashboard/editor/step-fields";
import type { EditorValues } from "@/components/dashboard/editor/types";
import { WeddingEditor } from "@/components/dashboard/editor/wedding-editor";
import { copy } from "@/lib/copy";
import {
  DEFAULT_SETTINGS,
  draftContentSchema,
  editableContent,
  emptyContent,
} from "@/lib/validation/content";
import { FIELD_LIMITS } from "@/lib/validation/content/field-limits";
import { draftErrorMap, draftFieldErrors } from "@/lib/validation/draft-errors";
import { saveDraftSchema } from "@/lib/validation/invitation";

type Cat = "wedding" | "corporate" | "family";

const STORY = { title: "", date: "", narrative: "" };
const EVENT = {
  name: "",
  startAt: "",
  endAt: "",
  venueName: "",
  address: "",
  mapsUrl: "",
};

/** Nilai awal: SETIAP daftar berisi satu baris supaya isian per baris ikut dirender. */
function seed(cat: Cat, over: Record<string, unknown> = {}): EditorValues {
  const content = draftContentSchema.parse({
    ...emptyContent(cat),
    story: [STORY],
    agenda: [STORY],
    wishes: [STORY],
    pic: {},
    envelope: {
      enabled: true,
      banks: [{ bank: "", number: "", holder: "" }],
      ewallets: [{ provider: "", number: "" }],
    },
    ...over,
  });
  return {
    eventDate: "",
    content,
    settings: DEFAULT_SETTINGS,
    events: [EVENT],
  };
}

const EDITORS = {
  wedding: WeddingEditor,
  corporate: CorporateEditor,
  family: FamilyEditor,
} as const;

function renderEditor(cat: Cat, values = seed(cat)) {
  const Editor = EDITORS[cat];
  return render(
    <Editor
      invitationId="9a500f03-f12d-4d66-85fc-af8ebcedd350"
      slug="draft-abc"
      defaultValues={values}
      initialMedia={[]}
      maxPhotos={8}
      songs={[]}
    />,
  );
}

/** Tombol langkah di navigasi (urutan = urutan langkah). */
const stepButtons = () =>
  within(screen.getAllByRole("list")[0]).getAllByRole("button");

/**
 * Kunci langkah ASLI (`steps[].key` milik editor, dari `data-step-key`) — bukan
 * turunan label: kunci yang menyimpang dari `STEP_FIELDS` harus memerah.
 */
function stepKeyOf(button: HTMLElement): string {
  const key = button.dataset.stepKey;
  if (!key)
    throw new Error(
      `tombol langkah tanpa data-step-key: ${button.textContent}`,
    );
  return key;
}

const labelOf = (key: string) =>
  copy.editor.steps[key as keyof typeof copy.editor.steps];

function setAt(obj: unknown, path: string, value: unknown): void {
  const keys = path.split(".");
  let cur = obj as Record<string, unknown>;
  keys.slice(0, -1).forEach((k, i) => {
    const nextIsIndex = /^\d+$/.test(keys[i + 1]);
    if (cur[k] === undefined || cur[k] === null) cur[k] = nextIsIndex ? [] : {};
    cur = cur[k] as Record<string, unknown>;
  });
  cur[keys.at(-1)!] = value;
}

function probe(cat: Cat, name: string, value: string) {
  const payload = structuredClone(seed(cat));
  setAt(payload, name, value);
  return saveDraftSchema.safeParse(payload);
}

const TEKS = new Set(["text", "email", "url", "tel", "search"]);
const isTextual = (el: Element) =>
  el.tagName === "TEXTAREA" ||
  (el.tagName === "INPUT" && TEKS.has((el as HTMLInputElement).type));

/** Isian non-teks yang sah (tanggal, centang, pilihan) — tak butuh maxLength. */
const BUKAN_TEKS = [
  /^eventDate$/,
  /^events\.\d+\.(startAt|endAt)$/,
  /^settings\.(timezone|songId|moderateGuestbook)$/,
  /^settings\.sections\.\w+$/,
  /^content\.envelope\.enabled$/,
];

afterEach(cleanup);
beforeEach(() => {
  push.mockReset();
  saveDraft.mockReset();
  saveDraft.mockResolvedValue({ status: "success" });
});

describe.each(["wedding", "corporate", "family"] as const)(
  "sapuan isian editor %s",
  (cat) => {
    it("setiap isian teks ber-maxLength = batas skema, dan terpetakan ke langkahnya", async () => {
      const user = userEvent.setup();
      renderEditor(cat);
      const stepKeys = stepButtons().map(stepKeyOf);
      let diperiksa = 0;

      for (const [i, key] of stepKeys.entries()) {
        // Label yang tampil memang milik kunci ini (label & kunci terkunci).
        expect(stepButtons()[i]).toHaveTextContent(labelOf(key));
        await user.click(stepButtons()[i]);
        const card = document.querySelector(".py-6") as HTMLElement;
        const fields = card.querySelectorAll(
          "input[name], textarea[name], select[name]",
        );

        for (const el of fields) {
          const name = el.getAttribute("name")!;
          expect(
            stepForPath(name, stepKeys),
            `${name} dipetakan ke langkah`,
          ).toBe(key);

          if (!isTextual(el)) {
            expect(
              BUKAN_TEKS.some((re) => re.test(name)),
              `${name} (${el.tagName.toLowerCase()}) bukan isian teks yang dikenal`,
            ).toBe(true);
            // Chrome mengizinkan tahun 5–6 digit dan `Date.parse` menerimanya.
            const type = (el as HTMLInputElement).type;
            if (type === "date") {
              expect(el.getAttribute("max"), `${name} batas tahun`).toBe(
                "9999-12-31",
              );
            }
            if (type === "datetime-local") {
              expect(el.getAttribute("max"), `${name} batas tahun`).toBe(
                "9999-12-31T23:59",
              );
            }
            continue;
          }

          const raw = el.getAttribute("maxlength");
          expect(raw, `${name} wajib punya maxlength`).not.toBeNull();
          const n = Number(raw);
          // Isian panjang: penghitung terhubung sebagai deskripsinya (nilai awal kosong).
          if (el.tagName === "TEXTAREA") {
            expect(el, `${name} berpenghitung`).toHaveAccessibleDescription(
              copy.editor.counter(0, n),
            );
          }
          expect(
            probe(cat, name, "a".repeat(n)).success,
            `${name}: ${n} karakter diterima`,
          ).toBe(true);
          const lebih = probe(cat, name, "a".repeat(n + 1));
          expect(
            lebih.success
              ? []
              : lebih.error.issues.map((x) => x.path.join(".")),
            `${name}: ${n + 1} karakter ditolak tepat di path ini`,
          ).toEqual([name]);
          diperiksa += 1;
        }
      }
      // Pengaman: sapuan yang tak menemukan apa pun bukan bukti apa pun.
      expect(diperiksa).toBeGreaterThan(10);
    });
  },
);

describe("tombol Tambah berhenti di batas skema", () => {
  const L = FIELD_LIMITS;
  const kasus: [Cat, string, string, number, Record<string, unknown>][] = [
    [
      "wedding",
      "story",
      copy.editor.timeline.wedding.add,
      L.wedding.story,
      { story: [] },
    ],
    [
      "corporate",
      "agenda",
      copy.editor.timeline.corporate.add,
      L.corporate.agenda,
      { agenda: [] },
    ],
    [
      "family",
      "wishes",
      copy.editor.timeline.family.add,
      L.family.wishes,
      { wishes: [] },
    ],
    ["wedding", "envelope", copy.editor.list.addBank, L.envelope.banks, {}],
    [
      "wedding",
      "envelope",
      copy.editor.list.addEwallet,
      L.envelope.ewallets,
      {},
    ],
  ];

  async function bukaLangkah(key: string) {
    const user = userEvent.setup();
    const btn = stepButtons().find((b) => stepKeyOf(b) === key)!;
    await user.click(btn);
    return user;
  }

  it.each(kasus)(
    "%s/%s: %s nonaktif tepat di %i entri, dengan alasan terlihat",
    async (cat, step, label, max, over) => {
      const baris = (k: number, row: unknown) =>
        Array.from({ length: k }, () => structuredClone(row));
      const isi =
        label === copy.editor.list.addBank
          ? {
              envelope: {
                enabled: true,
                banks: baris(max - 1, { bank: "", number: "", holder: "" }),
                ewallets: [],
              },
            }
          : label === copy.editor.list.addEwallet
            ? {
                envelope: {
                  enabled: true,
                  banks: [],
                  ewallets: baris(max - 1, { provider: "", number: "" }),
                },
              }
            : { ...over, [step]: baris(max - 1, STORY) };

      renderEditor(cat, seed(cat, isi));
      const user = await bukaLangkah(step);

      const tombol = screen.getByRole("button", { name: label });
      expect(tombol).toBeEnabled();
      await user.click(tombol); // entri ke-`max`
      const penuh = screen.getByRole("button", { name: label });
      expect(penuh).toBeDisabled();
      expect(penuh).toHaveAccessibleDescription(copy.editor.list.full(max));
    },
  );

  it(`sesi jadwal nonaktif tepat di ${FIELD_LIMITS.event.sessions}`, async () => {
    const max = FIELD_LIMITS.event.sessions;
    const values = {
      ...seed("wedding"),
      events: Array.from({ length: max - 1 }, () => ({ ...EVENT })),
    };
    renderEditor("wedding", values);
    const user = await bukaLangkah("schedule");
    await user.click(
      screen.getByRole("button", { name: copy.editor.schedule.add }),
    );
    expect(
      screen.getByRole("button", { name: copy.editor.schedule.add }),
    ).toBeDisabled();
    expect(screen.getByText(copy.editor.list.full(max))).toBeInTheDocument();
  });
});

describe("penolakan server tampil per isian, berbahasa Indonesia, dan menunjuk langkahnya", () => {
  beforeEach(() => {
    // Server palsu memakai skema + pemetaan galat ASLI.
    saveDraft.mockImplementation(async (_id: string, payload: unknown) => {
      const r = saveDraftSchema.safeParse(payload, { error: draftErrorMap });
      return r.success
        ? { status: "success" }
        : { status: "error", fieldErrors: draftFieldErrors(r.error) };
    });
  });

  it("data lama yang melebihi batas: pesan di isiannya, penanda di langkahnya, nama langkah di pesan Selesai", async () => {
    const user = userEvent.setup();
    // Narasi 2.001 karakter dari data lama (sebelum ada batas di UI), dimuat
    // lewat jalur yang sama dengan halaman edit.
    const lama = editableContent(
      {
        ...emptyContent("wedding"),
        story: [{ title: "Awal", narrative: "a".repeat(2001) }],
      },
      "wedding",
    );
    renderEditor("wedding", { ...seed("wedding"), content: lama });

    // Perubahan apa pun memicu autosave → server menolak narasi lama itu.
    await user.type(screen.getByLabelText(copy.editor.fields.title), "x");
    const pesan = copy.editor.validation.tooLong(
      FIELD_LIMITS.storyEntry.narrative,
    );
    const tombolCerita = () =>
      stepButtons().find((b) => stepKeyOf(b) === "story")!;
    await waitFor(
      () => expect(tombolCerita()).toHaveTextContent(copy.editor.stepNeedsFix),
      { timeout: 3000 },
    );

    // Penanda hanya di langkah yang bermasalah — menandai semua langkah membuat
    // isiannya mustahil ditemukan, padahal itulah tujuan penanda ini.
    for (const b of stepButtons().filter((x) => stepKeyOf(x) !== "story")) {
      expect(b).not.toHaveTextContent(copy.editor.stepNeedsFix);
    }

    // Pesan Indonesia di isian yang tepat, bukan pesan bawaan Zod.
    await user.click(tombolCerita());
    expect(screen.getByText(pesan)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(
      /too big|expected string|characters/i,
    );

    // Dari langkah terakhir, "Selesai" menyebut langkah yang harus dibuka.
    const tombolTerakhir = stepButtons().at(-1)!;
    await user.click(tombolTerakhir);
    await user.click(
      screen.getByRole("button", { name: copy.editor.nav.finish }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        copy.editor.nav.finishRejected(copy.editor.steps.story),
      ),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("pesan & penanda hilang begitu isiannya diperbaiki dan simpanan diterima", async () => {
    const user = userEvent.setup();
    renderEditor("wedding");
    const tombolPengaturan = () =>
      stepButtons().find((b) => stepKeyOf(b) === "settings")!;
    await user.click(tombolPengaturan());

    const youtube = screen.getByPlaceholderText("https://youtu.be/…");
    await user.type(youtube, "javascript:alert(1)");
    await waitFor(
      () => expect(screen.getByText("Tautan tidak valid")).toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(tombolPengaturan()).toHaveTextContent(copy.editor.stepNeedsFix);
    // Pembaca layar: isian ditandai tidak valid dan galat menjadi deskripsinya.
    expect(youtube).toHaveAttribute("aria-invalid", "true");
    expect(youtube).toHaveAccessibleDescription("Tautan tidak valid");
    expect(screen.getByLabelText(copy.editor.fields.youtubeUrl)).toBe(youtube);

    await user.clear(youtube);
    await waitFor(
      () => expect(screen.queryByText("Tautan tidak valid")).toBeNull(),
      { timeout: 3000 },
    );
    expect(tombolPengaturan()).not.toHaveTextContent(copy.editor.stepNeedsFix);
    expect(youtube).not.toHaveAttribute("aria-invalid");
  });

  it("dua langkah bermasalah: keduanya bertanda dan pesan Selesai menyebut keduanya", async () => {
    const user = userEvent.setup();
    const lama = editableContent(
      {
        ...emptyContent("wedding"),
        story: [{ title: "Awal", narrative: "a".repeat(2001) }],
      },
      "wedding",
    );
    renderEditor("wedding", { ...seed("wedding"), content: lama });
    const tombol = (key: string) =>
      stepButtons().find((b) => stepKeyOf(b) === key)!;

    await user.click(tombol("settings"));
    await user.type(
      screen.getByLabelText(copy.editor.fields.youtubeUrl),
      "javascript:x",
    );
    await waitFor(
      () =>
        expect(tombol("settings")).toHaveTextContent(copy.editor.stepNeedsFix),
      { timeout: 3000 },
    );
    expect(tombol("story")).toHaveTextContent(copy.editor.stepNeedsFix);
    expect(tombol("info")).not.toHaveTextContent(copy.editor.stepNeedsFix);

    await user.click(
      screen.getByRole("button", { name: copy.editor.nav.finish }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        copy.editor.nav.finishRejected(
          `${copy.editor.steps.story}, ${copy.editor.steps.settings}`,
        ),
      ),
    );
  });
});

describe("penghitung karakter isian panjang", () => {
  it("mengikuti isi yang diketik dan memerah tepat di batas", async () => {
    const user = userEvent.setup();
    renderEditor("wedding");
    await user.click(stepButtons().find((b) => stepKeyOf(b) === "story")!);
    const narasi = screen.getByLabelText(
      copy.editor.timeline.wedding.narrative,
    );
    const max = FIELD_LIMITS.storyEntry.narrative;

    await user.type(narasi, "abc");
    const penghitung = screen.getByText(copy.editor.counter(3, max));
    expect(narasi).toHaveAccessibleDescription(copy.editor.counter(3, max));
    expect(penghitung).not.toHaveClass("text-destructive");

    await user.clear(narasi);
    await user.click(narasi);
    await user.paste("a".repeat(max + 50)); // tempelan kepanjangan dipotong maxLength
    expect(narasi).toHaveValue("a".repeat(max));
    expect(screen.getByText(copy.editor.counter(max, max))).toHaveClass(
      "text-destructive",
    );
  });
});

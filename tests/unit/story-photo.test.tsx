import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  EditorValues,
  StoryPhotoSlot,
} from "@/components/dashboard/editor/types";
import { copy } from "@/lib/copy";
import { storyPhotoAspect } from "@/lib/customizer/theme-options";
import { parseContentForRender } from "@/lib/invitation-content";
import {
  corporateContentSchema,
  DEFAULT_SETTINGS,
  type DraftContent,
  draftContentSchema,
  emptyContent,
  weddingContentSchema,
} from "@/lib/validation/content";
import { buildInvitationData } from "@/server/invitation-data";
import { fotoCerita } from "@/themes/warta/foto-cerita";
import type { InvitationMediaView, PhotoView } from "@/types/invitation";

/**
 * Foto per entri love story (DECISIONS #127): bentuk data, penyaringan di
 * server, aturan cadangan galeri Warta, dan bidang unggah di editor.
 */

const { uploadNamedPhotoAction, deleteNamedPhotoAction } = vi.hoisted(() => ({
  uploadNamedPhotoAction: vi.fn(
    (_inv: string, _fd: FormData): Promise<unknown> =>
      Promise.resolve({ status: "error" }),
  ),
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

import { TimelineStep } from "@/components/dashboard/editor/steps/timeline-step";
import { Story } from "@/themes/warta/sections";

const INV = "85d261d6-1c2b-4e3a-9f00-0a1b2c3d4e5f";
const LAIN = "11111111-2222-4333-8444-555555555555";
const foto = (n: number, inv = INV) =>
  `inv/${inv}/foto/${n}${n}${n}${n}${n}${n}${n}${n}-1111-4111-8111-111111111111`;

const entri = (title: string, photo?: unknown) => ({
  title,
  date: "Maret 2020",
  narrative: `Narasi ${title}`,
  ...(photo === undefined ? {} : { photo }),
});

const WEDDING = {
  ...emptyContent("wedding"),
  groom: { name: "Andi" },
  bride: { name: "Sinta" },
};

describe("skema love story", () => {
  it("foto boleh objek atau string telanjang (dinormalkan ke titik tengah)", () => {
    const r = weddingContentSchema.parse({
      ...WEDDING,
      story: [
        entri("A", { path: foto(1), x: 0.2, y: 0.8, zoom: 2 }),
        entri("B", foto(2)),
        entri("C"),
      ],
    });
    expect(r.story[0].photo).toEqual({
      path: foto(1),
      x: 0.2,
      y: 0.8,
      zoom: 2,
    });
    expect(r.story[1].photo).toEqual({
      path: foto(2),
      x: 0.5,
      y: 0.5,
      zoom: 1,
    });
    expect(r.story[2].photo).toBeUndefined();
  });

  it("foto rusak gugur sendiri — tak menggagalkan SELURUH konten", () => {
    const r = weddingContentSchema.safeParse({
      ...WEDDING,
      story: [entri("A", "https://vendor.test/x.webp"), entri("B", foto(2))],
    });
    expect(r.success).toBe(true);
    expect(r.data?.story[0].photo).toBeUndefined();
    expect(r.data?.story[1].photo?.path).toBe(foto(2));
  });

  it("skema draft juga menyimpan foto (autosave tak membuangnya)", () => {
    const r = draftContentSchema.parse({
      ...emptyContent("wedding"),
      story: [{ title: "", narrative: "", photo: foto(3) }],
    });
    expect(r.category === "wedding" && r.story[0].photo?.path).toBe(foto(3));
  });

  it("agenda korporat TIDAK punya foto (skema bersama tak ikut melebar)", () => {
    const r = corporateContentSchema.parse({
      ...emptyContent("corporate"),
      eventName: "Rapat",
      agenda: [entri("A", foto(1))],
    });
    expect(r.agenda[0]).not.toHaveProperty("photo");
  });
});

describe("parseContentForRender — draft belum lengkap", () => {
  it("foto entri cerita ikut ke pratinjau walau konten belum lolos skema ketat", () => {
    // Nama mempelai kosong → skema ketat gagal → jalur draft (coerce).
    const c = parseContentForRender(
      { ...emptyContent("wedding"), story: [entri("A", foto(1)), entri("B")] },
      "wedding",
    );
    expect(c.category === "wedding" && c.story[0].photo?.path).toBe(foto(1));
    expect(c.category === "wedding" && c.story[1].photo).toBeUndefined();
  });
});

describe("buildInvitationData — storyPhotos", () => {
  function dengan(
    story: unknown[],
    category: "wedding" | "corporate" = "wedding",
  ) {
    return buildInvitationData({
      invitationId: INV,
      slug: "andi-sinta",
      category,
      content:
        category === "wedding"
          ? { ...WEDDING, story }
          : { ...emptyContent("corporate"), eventName: "Rapat" },
      settings: DEFAULT_SETTINGS,
      eventDate: null,
      eventRows: [],
      mediaRows: [],
      watermark: false,
      videoAllowed: true,
      maxPhotos: 20,
      themeOptions: null,
      music: null,
      musicLocked: false,
      liveMusicPaths: [],
    });
  }

  it("sejajar indeks content.story; varian DISPLAY + titik fokus; tanpa foto → null", () => {
    const d = dengan([
      entri("A", { path: foto(1), x: 0.3, y: 0.6, zoom: 1.5 }),
      entri("B"),
    ]);
    expect(d.storyPhotos).toHaveLength(2);
    expect(d.storyPhotos?.[0]?.url).toMatch(
      new RegExp(`/${foto(1)}/1600\\.webp$`),
    );
    expect(d.storyPhotos?.[0]).toMatchObject({ x: 0.3, y: 0.6, zoom: 1.5 });
    expect(d.storyPhotos?.[1]).toBeNull();
  });

  it("path milik undangan LAIN tak di-resolve (content ditulis klien)", () => {
    const d = dengan([
      entri("A", foto(1, LAIN)),
      entri("B", "inv/x/1600.webp"),
    ]);
    expect(d.storyPhotos).toEqual([null, null]);
  });

  it("kategori tanpa love story → tak ada storyPhotos", () => {
    expect(dengan([], "corporate").storyPhotos).toBeUndefined();
  });
});

describe("Warta — fotoCerita (cadangan galeri)", () => {
  const p = (n: number): PhotoView => ({
    url: `u${n}`,
    x: 0.5,
    y: 0.5,
    zoom: 1,
  });
  const m = (n: number) => ({ id: `m${n}` }) as unknown as InvitationMediaView;

  it("tanpa satu pun unggahan → galeri berurutan (perilaku lama)", () => {
    expect(fotoCerita(3, [null, null, null], [m(1), m(2)])).toEqual([
      { galeri: m(1) },
      { galeri: m(2) },
      null,
    ]);
    expect(fotoCerita(1, undefined, [m(1)])).toEqual([{ galeri: m(1) }]);
  });

  it("ada SATU unggahan → hanya unggahan; entri lain tanpa foto, galeri tak dipakai", () => {
    expect(fotoCerita(3, [null, p(2), null], [m(1), m(2), m(3)])).toEqual([
      null,
      { unggah: p(2) },
      null,
    ]);
  });
});

describe("storyPhotoAspect", () => {
  it("angka tunggal tetap; array bergiliran per indeks", () => {
    expect(storyPhotoAspect({ aspect: 1.5 }, 7)).toBe(1.5);
    const warta = { aspect: [4 / 3, 3 / 4] };
    expect([0, 1, 2, 3].map((i) => storyPhotoAspect(warta, i))).toEqual([
      4 / 3,
      3 / 4,
      4 / 3,
      3 / 4,
    ]);
  });
});

describe("editor — langkah Cerita", () => {
  let form: UseFormReturn<EditorValues> | null = null;

  function Induk(props: {
    story: unknown[];
    photo: StoryPhotoSlot | null;
    name?: "content.story" | "content.agenda";
    /** `false` = langkahnya dilepas (pindah langkah); form tetap hidup. */
    tampil?: boolean;
  }) {
    const f = useForm<EditorValues>({
      defaultValues: {
        eventDate: "",
        content: {
          ...(props.name === "content.agenda"
            ? { ...emptyContent("corporate"), agenda: props.story }
            : { ...emptyContent("wedding"), story: props.story }),
        } as DraftContent,
        settings: DEFAULT_SETTINGS,
        events: [],
      },
    });
    form = f;
    if (props.tampil === false) return null;
    return (
      <TimelineStep
        form={f}
        name={props.name ?? "content.story"}
        labels={copy.editor.timeline.wedding}
        invitationId={INV}
        photo={props.photo}
      />
    );
  }

  const SLOT: StoryPhotoSlot = {
    aspect: [4 / 3, 3 / 4],
    urls: { [foto(1)]: `https://cdn.test/${foto(1)}/1600.webp` },
  };
  const label = (i: number) => `${copy.editor.photo.storyLabel} ${i}`;
  const cerita = () =>
    (
      form?.getValues("content") as {
        story?: Array<{ title?: string; photo?: { path: string } }>;
      }
    ).story ?? [];

  beforeEach(() => {
    vi.clearAllMocks();
    form = null;
  });

  it("tema tanpa foto cerita → bidang unggah tak tampil", () => {
    render(<Induk story={[entri("A")]} photo={null} />);
    expect(screen.queryByText(label(1))).toBeNull();
  });

  it("tema berfoto cerita → satu bidang per entri; foto tersimpan tampil dari URL server", () => {
    render(
      <Induk
        story={[
          entri("A", { path: foto(1), x: 0.5, y: 0.5, zoom: 1 }),
          entri("B"),
        ]}
        photo={SLOT}
      />,
    );
    expect(screen.getByText(label(1))).toBeInTheDocument();
    expect(screen.getByText(label(2))).toBeInTheDocument();
    const img = screen.getByAltText(copy.editor.photo.preview);
    expect(img.getAttribute("src")).toBe(SLOT.urls[foto(1)]);
  });

  it("agenda (korporat) tak pernah berfoto, walau slot dikirim", () => {
    render(<Induk name="content.agenda" story={[entri("A")]} photo={SLOT} />);
    expect(screen.queryByText(label(1))).toBeNull();
  });

  it("unggah di entri ke-2 → `{ path, x, y, zoom }` masuk ke entri ITU", async () => {
    uploadNamedPhotoAction.mockResolvedValue({
      status: "success",
      path: foto(2),
      url: `https://cdn.test/${foto(2)}/1600.webp`,
    });
    render(<Induk story={[entri("A"), entri("B")]} photo={SLOT} />);
    const input = screen.getByLabelText(label(2)) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File([new Uint8Array(9)], "f.jpg", { type: "image/jpeg" })],
      },
    });
    await waitFor(() =>
      expect(cerita()[1]?.photo).toEqual({
        path: foto(2),
        x: 0.5,
        y: 0.5,
        zoom: 1,
      }),
    );
    expect(cerita()[0]?.photo).toBeUndefined();
  });

  it("hapus entri berfoto → berkasnya dihapus; entri berikutnya tetap dengan fotonya", () => {
    render(
      <Induk
        story={[
          entri("A", { path: foto(1), x: 0.5, y: 0.5, zoom: 1 }),
          entri("B", { path: foto(2), x: 0.5, y: 0.5, zoom: 1 }),
        ]}
        photo={SLOT}
      />,
    );
    act(() => {
      fireEvent.click(
        screen.getAllByRole("button", { name: copy.editor.list.remove })[0],
      );
    });
    expect(deleteNamedPhotoAction).toHaveBeenCalledTimes(1);
    expect(deleteNamedPhotoAction).toHaveBeenCalledWith(INV, foto(1));
    expect(cerita().map((s) => s.title)).toEqual(["B"]);
    expect(cerita()[0]?.photo?.path).toBe(foto(2));
  });

  it("hapus entri berfoto saat tema TANPA foto cerita → berkasnya tetap dihapus", () => {
    render(
      <Induk
        story={[entri("A", { path: foto(1), x: 0.5, y: 0.5, zoom: 1 })]}
        photo={null}
      />,
    );
    act(() => {
      fireEvent.click(
        screen.getByRole("button", { name: copy.editor.list.remove }),
      );
    });
    expect(deleteNamedPhotoAction).toHaveBeenCalledWith(INV, foto(1));
  });

  it("hapus entri tanpa foto → tak ada penghapusan berkas", () => {
    render(<Induk story={[entri("A")]} photo={SLOT} />);
    act(() => {
      fireEvent.click(
        screen.getByRole("button", { name: copy.editor.list.remove }),
      );
    });
    expect(deleteNamedPhotoAction).not.toHaveBeenCalled();
  });
  const berkas = () =>
    new File([new Uint8Array(9)], "f.jpg", { type: "image/jpeg" });
  const objek = (n: number) => ({ path: foto(n), x: 0.5, y: 0.5, zoom: 1 });
  /** Unggahan yang ditahan sampai dilepas — kompres + unggah di 4G butuh detik. */
  function tahanUnggah(path: string) {
    let lepas: () => void = () => {};
    uploadNamedPhotoAction.mockImplementation(
      () =>
        new Promise((ok) => {
          lepas = () =>
            ok({
              status: "success",
              path,
              url: `https://cdn.test/${path}/1600.webp`,
            });
        }),
    );
    return () => lepas();
  }
  const hapusEntriKe = (n: number) =>
    act(() => {
      fireEvent.click(
        screen.getAllByRole("button", { name: copy.editor.list.remove })[n],
      );
    });

  it("unggah masih berjalan lalu entri SEBELUMNYA dihapus → foto tetap di entrinya, tak ada yatim", async () => {
    const lepas = tahanUnggah(foto(9));
    render(
      <Induk
        story={[
          entri("A", objek(1)),
          entri("B", objek(2)),
          entri("C", objek(3)),
        ]}
        photo={SLOT}
      />,
    );
    fireEvent.change(screen.getByLabelText(label(2)), {
      target: { files: [berkas()] },
    });
    await waitFor(() => expect(uploadNamedPhotoAction).toHaveBeenCalled());
    hapusEntriKe(0); // tombol Hapus entri A (urutan DOM: kepala kartu dulu)
    await act(async () => lepas());

    await waitFor(() => expect(cerita()[0]?.photo?.path).toBe(foto(9)));
    expect(cerita().map((s) => [s.title, s.photo?.path])).toEqual([
      ["B", foto(9)],
      ["C", foto(3)],
    ]);
    // A (entrinya dihapus) & foto lama B (diganti) — foto C tak tersentuh.
    expect(deleteNamedPhotoAction.mock.calls.map((c) => c[1]).sort()).toEqual(
      [foto(1), foto(2)].sort(),
    );
  });

  it("entri yang sedang mengunggah dihapus → unggahan barunya dibuang, tak ada entri hantu", async () => {
    const lepas = tahanUnggah(foto(9));
    render(<Induk story={[entri("A"), entri("B", objek(2))]} photo={SLOT} />);
    fireEvent.change(screen.getByLabelText(label(2)), {
      target: { files: [berkas()] },
    });
    await waitFor(() => expect(uploadNamedPhotoAction).toHaveBeenCalled());
    hapusEntriKe(1); // [A-entri, B-entri, B-foto]
    await act(async () => lepas());

    await waitFor(() =>
      expect(deleteNamedPhotoAction.mock.calls.map((c) => c[1])).toContain(
        foto(9),
      ),
    );
    expect(cerita()).toHaveLength(1);
    expect(cerita()[0]?.title).toBe("A");
    expect(cerita()[0]?.photo).toBeUndefined();
  });

  it("bingkai memakai indeks entri SEBAGAIMANA DIRENDER — entri belum lengkap di depan tak dihitung", () => {
    render(
      <Induk
        // Judul hanya spasi = kosong sesudah trim skema → A gugur saat render
        // (narasi sendiri opsional sejak #132).
        story={[{ title: "   ", narrative: "Narasi A" }, entri("B", objek(1))]}
        photo={SLOT}
      />,
    );
    const bingkai = () =>
      screen.getByAltText(copy.editor.photo.preview).parentElement!;
    // A gugur saat render → B tampil di indeks 0 → lanskap 4/3 (bukan 3/4).
    expect(bingkai().style.aspectRatio).toBe(`${4 / 3} / 1`);

    // A diberi judul → B kini indeks 1 → potret 3/4, tanpa muat ulang.
    act(() => {
      fireEvent.change(screen.getAllByRole("textbox")[0], {
        target: { value: "Judul A" },
      });
    });
    expect(bingkai().style.aspectRatio).toBe(`${3 / 4} / 1`);
  });

  it("tema bercadangan galeri → catatan perilakunya tampil sekali di atas daftar", () => {
    const { unmount } = render(
      <Induk
        story={[entri("A"), entri("B")]}
        photo={{ ...SLOT, galleryFallback: true }}
      />,
    );
    expect(
      screen.getAllByText(copy.editor.photo.storyFallbackNote),
    ).toHaveLength(1);
    unmount();
    render(<Induk story={[entri("A")]} photo={SLOT} />);
    expect(screen.queryByText(copy.editor.photo.storyFallbackNote)).toBeNull();
  });

  it("foto yang baru diunggah tetap tampil sesudah pindah langkah lalu kembali", async () => {
    uploadNamedPhotoAction.mockResolvedValue({
      status: "success",
      path: foto(8),
      url: `https://cdn.test/${foto(8)}/1600.webp`,
    });
    const { rerender } = render(<Induk story={[entri("A")]} photo={SLOT} />);
    fireEvent.change(screen.getByLabelText(label(1)), {
      target: { files: [berkas()] },
    });
    await waitFor(() => expect(cerita()[0]?.photo?.path).toBe(foto(8)));

    // `urls` dari server belum mengenal foto ini (dirakit saat halaman dimuat).
    rerender(<Induk story={[entri("A")]} photo={SLOT} tampil={false} />);
    rerender(<Induk story={[entri("A")]} photo={SLOT} />);
    expect(
      screen.getByAltText(copy.editor.photo.preview).getAttribute("src"),
    ).toBe(`https://cdn.test/${foto(8)}/1600.webp`);
  });
});

describe("Warta — Story merender foto unggahan dengan titik fokusnya", () => {
  it("unggahan → fotoStyle pemilik; galeri → srcset 2 varian; null → tanpa foto", async () => {
    // `Reveal` memakai IntersectionObserver; jsdom tak punya.
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    const m = {
      id: "m1",
      url: "https://cdn.test/g/1600.webp",
      thumbUrl: "https://cdn.test/g/400.webp",
      width: 1600,
      height: 1200,
    } as InvitationMediaView;
    const { container } = render(
      <Story
        rubric="Feature"
        items={[entri("A"), entri("B"), entri("C")]}
        photos={[
          {
            unggah: {
              url: "https://cdn.test/u/1600.webp",
              x: 0.2,
              y: 0.8,
              zoom: 2,
            },
          },
          { galeri: m },
          null,
        ]}
      />,
    );
    const imgs = [...container.querySelectorAll("article")].map((a) =>
      a.querySelector("img"),
    );
    expect(imgs[0]?.getAttribute("src")).toBe("https://cdn.test/u/1600.webp");
    expect(imgs[0]?.style.objectPosition).toBe("20% 80%");
    expect(imgs[0]?.style.transform).toBe("scale(2)");
    expect(imgs[1]?.getAttribute("srcset")).toContain("400.webp 400w");
    expect(imgs[2]).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe("narasi love story opsional (#132)", () => {
  it('skema ketat menerima entri tanpa narasi (keluaran ""); agenda tetap wajib', () => {
    const r = weddingContentSchema.parse({
      ...WEDDING,
      story: [{ title: "Lamaran", date: "Sebuah cincin.", photo: foto(2) }],
    });
    expect(r.story[0]).toMatchObject({ title: "Lamaran", narrative: "" });
    expect(
      corporateContentSchema.safeParse({
        ...emptyContent("corporate"),
        eventName: "Rapat",
        agenda: [{ title: "Pembukaan" }],
      }).success,
    ).toBe(false);
  });

  it("render: entri berjudul tanpa narasi TAMPIL bersama fotonya; tanpa judul gugur", () => {
    const c = parseContentForRender(
      {
        ...emptyContent("wedding"),
        story: [
          entri("A", foto(1)),
          { title: "Lamaran", date: "Sebuah cincin.", photo: foto(2) },
          { title: "  ", narrative: "Tanpa judul" },
        ],
      },
      "wedding",
    );
    expect(c.category === "wedding" && c.story.map((s) => s.title)).toEqual([
      "A",
      "Lamaran",
    ]);
    expect(c.category === "wedding" && c.story[1]?.photo?.path).toBe(foto(2));
  });

  it("Warta: entri tanpa narasi → judul + foto + keterangan, tanpa paragraf kosong", async () => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    const { container } = render(
      <Story
        rubric="Feature"
        items={[
          entri("A"),
          { title: "Lamaran", date: "Sebuah cincin.", narrative: "" },
        ]}
        photos={[
          null,
          {
            unggah: { url: "https://cdn.test/l.webp", x: 0.5, y: 0.5, zoom: 1 },
          },
        ]}
      />,
    );
    const [a, b] = [...container.querySelectorAll("article")];
    expect(a?.querySelector(".wt-cols")).not.toBeNull();
    expect(b?.textContent).toContain("Lamaran");
    expect(b?.querySelector("img")?.getAttribute("src")).toBe(
      "https://cdn.test/l.webp",
    );
    expect(b?.textContent).toContain("Sebuah cincin.");
    expect(b?.querySelector(".wt-cols")).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe("editor — cerita tanpa judul diberi tahu (#132)", () => {
  function Induk(props: { story: unknown[] }) {
    const f = useForm<EditorValues>({
      defaultValues: {
        eventDate: "",
        content: {
          ...emptyContent("wedding"),
          story: props.story,
        } as DraftContent,
        settings: DEFAULT_SETTINGS,
        events: [],
      },
    });
    return (
      <TimelineStep
        form={f}
        name="content.story"
        labels={copy.editor.timeline.wedding}
        invitationId={INV}
        photo={null}
      />
    );
  }
  const PESAN = copy.editor.list.untitledStoryHidden;

  it("entri baru (kosong total) → tanpa peringatan", () => {
    render(<Induk story={[{ title: "", date: "", narrative: "" }]} />);
    expect(screen.queryByText(PESAN)).toBeNull();
  });

  it("entri berisi (keterangan/foto/narasi) tanpa judul → peringatan", () => {
    render(
      <Induk
        story={[
          { title: "  ", date: "Sebuah cincin." },
          { title: "", photo: { path: foto(1), x: 0.5, y: 0.5, zoom: 1 } },
        ]}
      />,
    );
    expect(screen.getAllByText(PESAN)).toHaveLength(2);
  });

  it("entri berjudul (narasi kosong pun) → tanpa peringatan; mengisi judul menghapusnya", () => {
    render(<Induk story={[{ title: "", narrative: "Isi" }]} />);
    expect(screen.getByText(PESAN)).toBeInTheDocument();
    act(() => {
      fireEvent.change(screen.getAllByRole("textbox")[0], {
        target: { value: "Lamaran" },
      });
    });
    expect(screen.queryByText(PESAN)).toBeNull();
  });
});

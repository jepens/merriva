import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  useForm,
  type DefaultValues,
  type UseFormReturn,
} from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  EditorValues,
  VideoSlotView,
} from "@/components/dashboard/editor/types";
import { copy } from "@/lib/copy";
import type { Video } from "@/lib/validation/content";
import { VIDEO_MAX_BYTES } from "@/lib/video";

/**
 * Blok "Video" langkah Pengaturan (FASE J) — dengan `useForm` ASLI (pelajaran
 * DECISIONS #108: induk `useState` menyembunyikan TypeError RHF pada nilai
 * objek yang menjadi `undefined`).
 *
 * Yang dijaga: aturan ≤60 dtk / 40 MB / landscape / tipe ditolak DI KLIEN
 * dengan pesan Indonesia sebelum satu byte pun dikirim; hasil unggah masuk ke
 * form (autosave yang menyimpan); video lama dibuang saat diganti/dihapus; dan
 * paket tanpa fitur video mematikan tombol unggah tanpa menahan penghapusan.
 */

const { deleteInvitationVideoAction } = vi.hoisted(() => ({
  deleteInvitationVideoAction: vi.fn((_inv: string, _paths: string[]) =>
    Promise.resolve({ status: "success" }),
  ),
}));
vi.mock("@/server/actions/video", () => ({ deleteInvitationVideoAction }));

const { bacaVideo } = vi.hoisted(() => ({
  bacaVideo: vi.fn((_f: File) =>
    Promise.resolve<{
      meta: { durationSec: number; width: number; height: number };
      poster: { blob: Blob; format: "webp" | "jpeg" } | null;
    } | null>({
      meta: { durationSec: 42.3456, width: 1920, height: 1080 },
      poster: {
        blob: new Blob([new Uint8Array(10)], { type: "image/webp" }),
        format: "webp",
      },
    }),
  ),
}));
vi.mock("@/lib/video-client", () => ({ bacaVideo }));

import { SettingsStep } from "@/components/dashboard/editor/steps/settings-step";

const INV = "44444444-4444-4444-8444-444444444444";
const LAMA: Video = {
  path: `video/${INV}/11111111-1111-4111-8111-111111111111/video.mp4`,
  poster: `video/${INV}/11111111-1111-4111-8111-111111111111/poster.webp`,
  width: 1280,
  height: 720,
  durationSec: 10,
};
const BARU = `video/${INV}/22222222-2222-4222-8222-222222222222`;
const V = copy.editor.video;

const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
  Promise.resolve(
    new Response(
      JSON.stringify({
        status: "success",
        video: { path: `${BARU}/video.mp4`, poster: `${BARU}/poster.webp` },
        url: `https://cdn.test/${BARU}/video.mp4`,
        posterUrl: `https://cdn.test/${BARU}/poster.webp`,
      }),
    ),
  ),
);

function Induk({
  video,
  slot,
  onForm,
}: {
  video?: Video;
  slot: VideoSlotView;
  onForm: (form: UseFormReturn<EditorValues>) => void;
}) {
  const form = useForm<EditorValues>({
    defaultValues: {
      content: { category: "wedding", ...(video ? { video } : {}) },
      settings: { sections: {} },
    } as unknown as DefaultValues<EditorValues>,
  });
  onForm(form);
  return (
    <SettingsStep
      form={form}
      invitationId={INV}
      songs={[]}
      music={{ allowed: false, lockedAt: null, path: null, url: null }}
      video={slot}
    />
  );
}

function pasang(opts: { video?: Video; slot?: Partial<VideoSlotView> } = {}) {
  let form: UseFormReturn<EditorValues> | undefined;
  const slot: VideoSlotView = {
    allowed: true,
    url: opts.video ? `https://cdn.test/${opts.video.path}` : null,
    posterUrl: null,
    ...opts.slot,
  };
  const utils = render(
    <Induk video={opts.video} slot={slot} onForm={(f) => (form = f)} />,
  );
  return { ...utils, form: () => form! };
}

function pilih(file: File) {
  fireEvent.change(screen.getByLabelText(V.fileLabel), {
    target: { files: [file] },
  });
}

const mp4 = (bytes = 1000) =>
  new File([new Uint8Array(bytes)], "klip.mp4", { type: "video/mp4" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("VideoField — validasi klien (sebelum mengirim apa pun)", () => {
  it("tipe salah → pesan Indonesia, tak membaca & tak mengirim", async () => {
    pasang();
    pilih(new File([new Uint8Array(10)], "x.avi", { type: "video/x-msvideo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(V.errors.type);
    expect(bacaVideo).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("> 40 MB → ditolak", async () => {
    pasang();
    // Ukuran dipalsukan — tak perlu mengalokasikan 40 MB di test.
    const besar = mp4();
    Object.defineProperty(besar, "size", { value: VIDEO_MAX_BYTES + 1 });
    pilih(besar);
    expect(await screen.findByRole("alert")).toHaveTextContent(V.errors.size);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["potret", { durationSec: 20, width: 1080, height: 1920 }, "orientation"],
    ["> 61 dtk", { durationSec: 75, width: 1920, height: 1080 }, "duration"],
  ] as const)("%s → ditolak", async (_n, meta, issue) => {
    bacaVideo.mockResolvedValueOnce({ meta, poster: null });
    pasang();
    pilih(mp4());
    expect(await screen.findByRole("alert")).toHaveTextContent(V.errors[issue]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tak terbaca peramban → pesan 'unreadable'", async () => {
    bacaVideo.mockResolvedValueOnce(null);
    pasang();
    pilih(mp4());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      V.errors.unreadable,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("VideoField — unggah & hapus dengan form asli", () => {
  it("sukses: video + poster dikirim, nilai masuk form, video LAMA dibuang", async () => {
    const { form } = pasang({ video: LAMA });
    const autosave = vi.fn();
    const sub = form().watch(autosave);

    pilih(mp4());

    await waitFor(() =>
      expect(form().getValues("content.video")).toEqual({
        path: `${BARU}/video.mp4`,
        poster: `${BARU}/poster.webp`,
        width: 1920,
        height: 1080,
        durationSec: 42.35,
      }),
    );
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`/api/invitations/${INV}/video`);
    const fd = init!.body as FormData;
    expect(fd.get("video")).toBeInstanceOf(File);
    expect((fd.get("poster") as File).name).toBe("poster.webp");
    expect(deleteInvitationVideoAction).toHaveBeenCalledWith(INV, [
      LAMA.path,
      LAMA.poster,
    ]);
    expect(autosave).toHaveBeenCalled();
    sub.unsubscribe();
  });

  it("server menolak paket → pesan 'limit', form tak berubah", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "error", reason: "limit" }), {
        status: 403,
      }),
    );
    const { form } = pasang();
    pilih(mp4());
    expect(await screen.findByRole("alert")).toHaveTextContent(V.errors.limit);
    expect(form().getValues("content.video")).toBeUndefined();
  });

  it("Hapus: form kosong, autosave terpicu, objek video + poster dihapus", async () => {
    const { form } = pasang({ video: LAMA });
    const autosave = vi.fn();
    const sub = form().watch(autosave);

    fireEvent.click(screen.getByRole("button", { name: V.remove }));

    await waitFor(() =>
      expect(deleteInvitationVideoAction).toHaveBeenCalledWith(INV, [
        LAMA.path,
        LAMA.poster,
      ]),
    );
    expect(form().getValues("content.video")).toBeUndefined();
    expect(autosave).toHaveBeenCalled();
    sub.unsubscribe();
  });
});

describe("VideoField — paket tanpa fitur video", () => {
  it("tombol unggah mati + penjelasan; video lama tetap bisa dihapus", () => {
    pasang({ video: LAMA, slot: { allowed: false } });
    const blok = screen.getByRole("group", { name: V.legend });
    expect(within(blok).getByText(V.locked)).toBeInTheDocument();
    expect(
      within(blok).getByRole("button", { name: V.replace }),
    ).toBeDisabled();
    expect(within(blok).getByRole("button", { name: V.remove })).toBeEnabled();
  });

  it("tautan YouTube tetap di blok yang sama", () => {
    pasang();
    const blok = screen.getByRole("group", { name: V.legend });
    expect(
      within(blok).getByLabelText(copy.editor.fields.youtubeUrl),
    ).toBeInTheDocument();
  });
});

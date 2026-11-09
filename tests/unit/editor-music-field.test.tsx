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

import { SettingsStep } from "@/components/dashboard/editor/steps/settings-step";
import type {
  EditorValues,
  MusicSlotView,
} from "@/components/dashboard/editor/types";
import { copy } from "@/lib/copy";
import {
  CUSTOM_MUSIC_ATTEST_HEADER,
  CUSTOM_MUSIC_ATTEST_VERSION,
  CUSTOM_MUSIC_MAX_BYTES,
} from "@/lib/custom-music";
import type { CustomMusic } from "@/lib/validation/content";

/**
 * Blok "Lagu sendiri (MP3)" langkah Pengaturan (DECISIONS #121) — dengan
 * `useForm` ASLI (pelajaran DECISIONS #108).
 *
 * Yang dijaga: tanpa centang pernyataan hak tak ada yang terkirim; berkas
 * bukan-MP3 / terlalu besar / terlalu pendek ditolak DI KLIEN sebelum satu
 * byte pun dikirim; unggahan sukses mengirim berkas + versi pernyataan ke
 * route undangan ini, menulis `content.customMusic` (autosave yang
 * menyimpan), lalu mengosongkan centang (pernyataan per unggahan); galat route
 * dipetakan ke teks Indonesia; "Hapus lagu" hanya mengosongkan form; dan yang
 * tampil mengikuti NILAI FORM, bukan state komponen — pindah langkah editor
 * meng-unmount bidang ini.
 */

const INV = "55555555-5555-4555-8555-555555555555";
const M = copy.editor.customMusic;
const LAMA: CustomMusic = {
  path: `audio/${INV}/11111111-1111-4111-8111-111111111111.mp3`,
  name: "lagu-lama.mp3",
};
const BARU = `audio/${INV}/22222222-2222-4222-8222-222222222222.mp3`;

/**
 * MP3 sintetis: rantai frame MPEG-1 Layer III 32 kbps / 44,1 kHz (header
 * `FF FB 10 00`, 104 byte, 1152 sampel per frame) — cukup untuk `parseMp3`
 * menghitung durasi tanpa berkas audio sungguhan.
 */
function mp3Bytes(seconds: number): Uint8Array {
  const FRAME = 104;
  const frames = Math.ceil((seconds * 44100) / 1152);
  const b = new Uint8Array(frames * FRAME);
  for (let i = 0; i < frames; i++) b.set([0xff, 0xfb, 0x10, 0x00], i * FRAME);
  return b;
}

const mp3 = (seconds = 15, name = "lagu-kami.mp3") =>
  new File([mp3Bytes(seconds) as BlobPart], name, { type: "audio/mpeg" });

const sukses = (path = BARU) =>
  new Response(
    JSON.stringify({
      status: "success",
      path,
      url: `https://cdn.test/${path}`,
      durationSec: 15,
    }),
  );

const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
  Promise.resolve(sukses()),
);

function Induk({
  music,
  slot,
  onForm,
  tampil = true,
}: {
  music?: CustomMusic;
  slot: MusicSlotView;
  onForm: (form: UseFormReturn<EditorValues>) => void;
  /** `false` = pemilik sedang di langkah lain (bidang ter-unmount, form tetap). */
  tampil?: boolean;
}) {
  const form = useForm<EditorValues>({
    defaultValues: {
      content: {
        category: "wedding",
        ...(music ? { customMusic: music } : {}),
      },
      settings: { sections: {} },
    } as unknown as DefaultValues<EditorValues>,
  });
  onForm(form);
  if (!tampil) return <p>Langkah lain</p>;
  return (
    <SettingsStep
      form={form}
      invitationId={INV}
      songs={[]}
      music={slot}
      video={{ allowed: false, url: null, posterUrl: null }}
    />
  );
}

function pasang(
  opts: { music?: CustomMusic; slot?: Partial<MusicSlotView> } = {},
) {
  let form: UseFormReturn<EditorValues> | undefined;
  const slot: MusicSlotView = {
    allowed: true,
    lockedAt: null,
    path: opts.music?.path ?? null,
    url: opts.music ? `https://cdn.test/${opts.music.path}` : null,
    ...opts.slot,
  };
  const induk = (tampil: boolean) => (
    <Induk
      music={opts.music}
      slot={slot}
      onForm={(f) => (form = f)}
      tampil={tampil}
    />
  );
  const utils = render(induk(true));
  return {
    ...utils,
    form: () => form!,
    /** Pindah ke langkah lain lalu kembali — bidang lagu dipasang ulang. */
    pindahLangkahLaluKembali: () => {
      utils.rerender(induk(false));
      expect(screen.queryByRole("group", { name: M.legend })).toBeNull();
      utils.rerender(induk(true));
    },
  };
}

const blok = () => screen.getByRole("group", { name: M.legend });
const centang = () => screen.getByRole("checkbox", { name: M.attest });
/** Region aria-live (sr-only) milik blok lagu. */
const siaran = () => within(blok()).getByRole("status");

function pilih(file: File, label: string = M.add) {
  fireEvent.change(within(blok()).getByLabelText(label), {
    target: { files: [file] },
  });
}

/** Janji yang diselesaikan dari luar — untuk menahan satu tahap alur. */
function ditahan<T>() {
  let lepas!: (v: T) => void;
  const janji = new Promise<T>((r) => (lepas = r));
  return { janji, lepas };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("MusicField — gerbang", () => {
  it("bukan Premium tanpa lagu → hanya teks netral, tanpa unggah/pemutar", () => {
    pasang({ slot: { allowed: false } });
    const b = blok();
    expect(within(b).getByText(M.locked)).toBeInTheDocument();
    expect(within(b).queryByRole("checkbox")).toBeNull();
    expect(within(b).queryByRole("button")).toBeNull();
    expect(within(b).queryByLabelText(M.preview)).toBeNull();
    expect(b.querySelector('input[type="file"]')).toBeNull();
  });

  it("bukan Premium DENGAN lagu tersimpan (turun paket) → nama + keterangan + Hapus, tanpa unggah/pemutar", async () => {
    const { form } = pasang({ music: LAMA, slot: { allowed: false } });
    const b = blok();
    expect(within(b).getByText(LAMA.name!)).toBeInTheDocument();
    expect(within(b).getByText(M.lockedHasSong)).toBeInTheDocument();
    expect(within(b).queryByText(M.locked)).toBeNull();
    expect(within(b).queryByRole("checkbox")).toBeNull();
    expect(within(b).queryByLabelText(M.preview)).toBeNull();
    expect(b.querySelector('input[type="file"]')).toBeNull();

    fireEvent.click(within(b).getByRole("button", { name: M.remove }));

    await waitFor(() =>
      expect(form().getValues("content.customMusic")).toBeUndefined(),
    );
    expect(within(b).getByText(M.locked)).toBeInTheDocument();
    expect(within(b).queryByRole("button")).toBeNull();
    // Tombolnya lenyap → fokus ke kelompoknya, bukan jatuh ke <body>.
    expect(b).toHaveFocus();
    expect(siaran()).toHaveTextContent(M.removed);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dikunci admin → hanya pesan + email dukungan; lagu lama tak diputar", () => {
    pasang({
      music: LAMA,
      slot: { lockedAt: "2026-11-09T01:00:00Z" },
    });
    const b = blok();
    expect(
      within(b).getByText(M.lockedByAdmin(copy.support.email)),
    ).toBeInTheDocument();
    expect(within(b).queryByRole("checkbox")).toBeNull();
    expect(within(b).queryByRole("button")).toBeNull();
    expect(within(b).queryByLabelText(M.preview)).toBeNull();
    expect(b.querySelector('input[type="file"]')).toBeNull();
  });
});

describe("MusicField — pernyataan hak wajib per unggahan", () => {
  it("tanpa centang: tombol mati + petunjuk; input yang dipicu langsung tetap tak mengirim", async () => {
    pasang();
    const tombol = within(blok()).getByRole("button", { name: M.add });
    expect(tombol).toBeDisabled();
    expect(tombol).toHaveAccessibleDescription(M.attestNeeded);

    // Berkas SAH — satu-satunya yang menahannya adalah centang yang kosong.
    pilih(mp3());
    expect(await screen.findByRole("alert")).toHaveTextContent(M.errors.attest);
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(centang());
    expect(tombol).toBeEnabled();
    expect(screen.queryByText(M.attestNeeded)).toBeNull();
  });
});

describe("MusicField — validasi klien (sebelum mengirim apa pun)", () => {
  it.each([
    [
      "bukan MP3 (WAV)",
      () => new File([new Uint8Array(100)], "x.wav", { type: "audio/wav" }),
      M.errors.type,
    ],
    [
      "> 8 MB",
      () => {
        // Ukuran dipalsukan — tak perlu mengalokasikan 8 MB di test.
        const f = mp3();
        Object.defineProperty(f, "size", { value: CUSTOM_MUSIC_MAX_BYTES + 1 });
        return f;
      },
      M.errors.size,
    ],
    ["MP3 terlalu pendek (5 dtk)", () => mp3(5), M.errors.short],
    [
      "isi bukan rantai frame MP3",
      () =>
        new File([new Uint8Array(4096).fill(7)], "palsu.mp3", {
          type: "audio/mpeg",
        }),
      M.errors.format,
    ],
  ] as const)("%s → ditolak, tak terkirim", async (_n, buat, pesan) => {
    const { form } = pasang();
    fireEvent.click(centang());
    pilih(buat());
    expect(await screen.findByRole("alert")).toHaveTextContent(pesan);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(form().getValues("content.customMusic")).toBeUndefined();
  });
});

describe("MusicField — unggah & hapus dengan form asli", () => {
  it("sukses: berkas + versi pernyataan ke route undangan ini, form terisi, centang kosong lagi", async () => {
    const { form } = pasang();
    const autosave = vi.fn();
    const sub = form().watch(autosave);

    fireEvent.click(centang());
    const berkas = mp3();
    pilih(berkas);

    await waitFor(() =>
      expect(form().getValues("content.customMusic")).toEqual({
        path: BARU,
        name: "lagu-kami.mp3",
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`/api/invitations/${INV}/music`);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(berkas);
    expect(init?.headers).toEqual({
      "Content-Type": "audio/mpeg",
      [CUSTOM_MUSIC_ATTEST_HEADER]: String(CUSTOM_MUSIC_ATTEST_VERSION),
    });
    expect(autosave).toHaveBeenCalled();

    // Pernyataan berlaku per unggahan → harus dicentang ulang untuk mengganti.
    await waitFor(() => expect(centang()).not.toBeChecked());
    const b = blok();
    expect(within(b).getByRole("button", { name: M.replace })).toBeDisabled();
    expect(within(b).getByText("lagu-kami.mp3")).toBeInTheDocument();
    expect(within(b).getByLabelText(M.preview)).toHaveAttribute(
      "src",
      `https://cdn.test/${BARU}`,
    );
    sub.unsubscribe();
  });

  it("nama berkas dipangkas ke 120 karakter", async () => {
    const { form } = pasang();
    fireEvent.click(centang());
    pilih(mp3(15, `${"a".repeat(130)}.mp3`));
    await waitFor(() =>
      expect(form().getValues("content.customMusic")?.name).toBe(
        "a".repeat(120),
      ),
    );
  });

  it.each([
    [
      "kuota (JSON)",
      () =>
        new Response(JSON.stringify({ status: "error", reason: "quota" }), {
          status: 429,
        }),
      M.errors.quota,
    ],
    [
      "dikunci admin (JSON)",
      () =>
        new Response(JSON.stringify({ status: "error", reason: "locked" }), {
          status: 403,
        }),
      M.errors.locked,
    ],
    [
      // Kotaknya SUDAH dicentang — "centang dulu" (`attest`) akan menyesatkan.
      "versi pernyataan usang (JSON 'attest')",
      () =>
        new Response(JSON.stringify({ status: "error", reason: "attest" }), {
          status: 400,
        }),
      M.errors.attestStale,
    ],
    [
      "401 bukan JSON",
      () => new Response("<html>", { status: 401 }),
      M.errors.auth,
    ],
    [
      "413 dari proksi",
      () => new Response("Payload Too Large", { status: 413 }),
      M.errors.size,
    ],
    [
      "500 bukan JSON",
      () => new Response("oops", { status: 500 }),
      M.errors.server,
    ],
  ] as const)(
    "galat route: %s → teks Indonesia, form tak berubah",
    async (_n, res, pesan) => {
      fetchMock.mockResolvedValueOnce(res());
      const { form } = pasang();
      fireEvent.click(centang());
      pilih(mp3());
      expect(await screen.findByRole("alert")).toHaveTextContent(pesan);
      expect(form().getValues("content.customMusic")).toBeUndefined();
      // Unggahan gagal tak dicatat — centang tetap, pemilik bisa mencoba lagi.
      expect(centang()).toBeChecked();
    },
  );

  it("jaringan putus → pesan 'server'", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    pasang();
    fireEvent.click(centang());
    pilih(mp3());
    expect(await screen.findByRole("alert")).toHaveTextContent(M.errors.server);
  });

  it("Hapus lagu: form kosong, autosave terpicu, tanpa permintaan ke server; fokus ke pernyataan hak", async () => {
    const { form } = pasang({ music: LAMA });
    const autosave = vi.fn();
    const sub = form().watch(autosave);
    const b = blok();
    expect(within(b).getByText(LAMA.name!)).toBeInTheDocument();

    fireEvent.click(within(b).getByRole("button", { name: M.remove }));

    await waitFor(() =>
      expect(form().getValues("content.customMusic")).toBeUndefined(),
    );
    expect(autosave).toHaveBeenCalled();
    expect(within(b).queryByLabelText(M.preview)).toBeNull();
    expect(within(b).getByRole("button", { name: M.add })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    // Tombol Hapus lenyap: fokus pindah ke langkah berikut yang wajar, dan
    // pembaca layar diberi tahu hasilnya.
    expect(centang()).toHaveFocus();
    expect(siaran()).toHaveTextContent(M.removed);
    sub.unsubscribe();
  });

  it("lagu tanpa nama → label 'Lagu unggahan'", () => {
    pasang({ music: { path: LAMA.path } });
    expect(within(blok()).getByText(M.unnamed)).toBeInTheDocument();
  });
});

describe("MusicField — pengumuman pembaca layar (aria-live)", () => {
  it("region selalu ada (sr-only) dan mengumumkan memeriksa → mengunggah → berhasil", async () => {
    const baca = ditahan<ArrayBuffer>();
    const kirim = ditahan<Response>();
    fetchMock.mockImplementationOnce(() => kirim.janji);
    pasang();
    // Ada SEBELUM apa pun terjadi: region yang muncul bersama isinya sering
    // tak diumumkan.
    expect(siaran()).toHaveTextContent("");
    expect(siaran()).toHaveAttribute("aria-live", "polite");
    expect(siaran()).toHaveClass("sr-only");

    fireEvent.click(centang());
    const berkas = mp3();
    const isi = await berkas.arrayBuffer();
    berkas.arrayBuffer = () => baca.janji;
    pilih(berkas);

    await waitFor(() => expect(siaran()).toHaveTextContent(M.reading));
    baca.lepas(isi);
    await waitFor(() => expect(siaran()).toHaveTextContent(M.working));
    kirim.lepas(sukses());
    await waitFor(() => expect(siaran()).toHaveTextContent(M.uploaded));
  });

  it("unggahan gagal tidak diumumkan sebagai berhasil (galatnya sudah role=alert)", async () => {
    fetchMock.mockResolvedValueOnce(new Response("oops", { status: 500 }));
    pasang();
    fireEvent.click(centang());
    pilih(mp3());
    expect(await screen.findByRole("alert")).toHaveTextContent(M.errors.server);
    expect(siaran()).toHaveTextContent("");
  });
});

describe("MusicField — tampilan mengikuti nilai form, bukan state komponen", () => {
  it("unggah lalu pindah langkah & kembali: nama, Hapus, dan pemutar lagu BARU — bukan lagu lama dari server", async () => {
    // Dulu URL hanya hidup di state lokal: dipasang ulang, `useState` kembali
    // ke URL lagu LAMA dari server, dan pemutar memutarnya di bawah nama BARU.
    const { form, pindahLangkahLaluKembali } = pasang({ music: LAMA });
    fireEvent.click(centang());
    pilih(mp3(), M.replace);
    await waitFor(() =>
      expect(form().getValues("content.customMusic")?.path).toBe(BARU),
    );

    pindahLangkahLaluKembali();

    const b = blok();
    expect(within(b).getByText("lagu-kami.mp3")).toBeInTheDocument();
    expect(within(b).getByRole("button", { name: M.remove })).toBeEnabled();
    expect(within(b).getByLabelText(M.preview)).toHaveAttribute(
      "src",
      `https://cdn.test/${BARU}`,
    );
  });

  it("unggah tanpa lagu tersimpan lalu pindah langkah & kembali: lagu + tombol Hapus tetap ada", async () => {
    const PERTAMA = `audio/${INV}/33333333-3333-4333-8333-333333333333.mp3`;
    fetchMock.mockResolvedValueOnce(sukses(PERTAMA));
    const { form, pindahLangkahLaluKembali } = pasang();
    fireEvent.click(centang());
    pilih(mp3());
    await waitFor(() =>
      expect(form().getValues("content.customMusic")?.path).toBe(PERTAMA),
    );

    pindahLangkahLaluKembali();

    const b = blok();
    expect(within(b).getByText("lagu-kami.mp3")).toBeInTheDocument();
    expect(within(b).getByLabelText(M.preview)).toHaveAttribute(
      "src",
      `https://cdn.test/${PERTAMA}`,
    );
    fireEvent.click(within(b).getByRole("button", { name: M.remove }));
    await waitFor(() =>
      expect(form().getValues("content.customMusic")).toBeUndefined(),
    );
  });

  it("rujukan yang objeknya tak hidup lagi (server: path null) → nama + Hapus tetap ada, tanpa pemutar", () => {
    // Mis. autosave tertunda > 24 jam sehingga cron sudah menyapu objeknya:
    // pemilik harus tetap bisa melihat dan menghapus rujukannya.
    const BASI = `audio/${INV}/44444444-4444-4444-8444-444444444444.mp3`;
    pasang({
      music: { path: BASI, name: "lagu-basi.mp3" },
      slot: { path: null, url: null },
    });
    const b = blok();
    expect(within(b).getByText("lagu-basi.mp3")).toBeInTheDocument();
    expect(within(b).getByRole("button", { name: M.remove })).toBeEnabled();
    expect(within(b).queryByLabelText(M.preview)).toBeNull();
  });

  it("URL dari server hanya berlaku untuk path-nya sendiri", () => {
    const LAIN = `audio/${INV}/55555555-5555-4555-8555-555555555555.mp3`;
    pasang({
      music: { path: LAIN, name: "lagu-lain.mp3" },
      slot: { path: LAMA.path, url: `https://cdn.test/${LAMA.path}` },
    });
    expect(within(blok()).queryByLabelText(M.preview)).toBeNull();
  });
});

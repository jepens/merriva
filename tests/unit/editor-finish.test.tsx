import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Langkah terakhir editor: tombol "Selesai" → pratinjau (DECISIONS #40).
 *
 * Dulu tombol kanan di-disable mati di langkah terakhir — pemilik menyangka
 * formnya rusak. Yang dijaga di sini bukan sekadar labelnya, melainkan
 * jaminan yang menyertainya: autosave DI-DEBOUNCE 800 ms, jadi berpindah
 * halaman tanpa menunggu simpanan tertunda akan menelan ketikan terakhir.
 */

const { push, saveDraft } = vi.hoisted(() => ({
  push: vi.fn(),
  saveDraft: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/server/actions/invitation", () => ({
  saveInvitationDraftAction: saveDraft,
}));

import {
  EditorShell,
  type EditorStep,
} from "@/components/dashboard/editor/editor-shell";
import { copy } from "@/lib/copy";
import { DEFAULT_SETTINGS, emptyContent } from "@/lib/validation/content";

const steps: EditorStep[] = [
  {
    key: "isi",
    label: "Isi",
    render: (ctx) => (
      <input aria-label="Tanggal acara" {...ctx.form.register("eventDate")} />
    ),
    complete: () => true,
  },
  {
    key: "pengaturan",
    label: "Pengaturan",
    // Langkah terakhir juga punya isian: pemilik memang masih bisa mengetik di
    // sini, termasuk selagi "Selesai" menunggu simpanan.
    render: (ctx) => (
      <>
        <p>Langkah terakhir</p>
        <input aria-label="Tanggal acara" {...ctx.form.register("eventDate")} />
      </>
    ),
    complete: () => true,
  },
];

function renderEditor() {
  return render(
    <EditorShell
      invitationId="9a500f03-f12d-4d66-85fc-af8ebcedd350"
      slug="draft-abc"
      defaultValues={{
        eventDate: "",
        content: emptyContent("wedding"),
        settings: DEFAULT_SETTINGS,
        events: [],
      }}
      initialMedia={[]}
      maxPhotos={8}
      songs={[]}
      steps={steps}
    />,
  );
}

const tombolKanan = () =>
  screen.getByRole("button", {
    name: new RegExp(
      `${copy.editor.nav.next}|${copy.editor.nav.finish}|${copy.editor.nav.finishing}`,
    ),
  });

afterEach(cleanup);
beforeEach(() => {
  push.mockReset();
  saveDraft.mockReset();
  saveDraft.mockResolvedValue({ status: "success" });
});

describe("tombol langkah terakhir", () => {
  it("langkah non-terakhir tetap berlabel Berikutnya dan bisa diklik", () => {
    renderEditor();
    const btn = tombolKanan();
    expect(btn).toHaveTextContent(copy.editor.nav.next);
    expect(btn).toBeEnabled();
  });

  it("langkah terakhir berlabel Selesai dan TIDAK nonaktif", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(tombolKanan()); // → langkah terakhir

    const btn = tombolKanan();
    expect(btn).toHaveTextContent(copy.editor.nav.finish);
    expect(btn).toBeEnabled();
  });

  it("membawa ke halaman pratinjau undangan ini", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(tombolKanan());
    await user.click(tombolKanan());

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/preview/9a500f03-f12d-4d66-85fc-af8ebcedd350",
      ),
    );
  });
});

describe("jaring pengaman autosave", () => {
  it("keluar lewat tautan lain: ketikan terakhir tetap dikirim saat editor dilepas", async () => {
    const user = userEvent.setup();
    const { unmount } = renderEditor();
    await user.type(screen.getByLabelText("Tanggal acara"), "2026-12-12");

    // Pemilik menekan "Kustomisasi Tampilan"/"Undangan" di tengah jendela
    // debounce: dulu timer-nya dibuang mentah-mentah dan ketikan ini hilang.
    unmount();

    await waitFor(() => expect(saveDraft).toHaveBeenCalled());
    expect(saveDraft.mock.calls.at(-1)?.[1]).toMatchObject({
      eventDate: "2026-12-12",
    });
  });

  it('indikator tidak bilang "Tersimpan" selagi ada ketikan yang belum terkirim', async () => {
    const user = userEvent.setup();
    let selesaikanSimpanPertama: () => void = () => {};
    saveDraft
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            selesaikanSimpanPertama = () => resolve({ status: "success" });
          }),
      )
      .mockResolvedValue({ status: "success" });

    renderEditor();
    const isian = screen.getByLabelText("Tanggal acara");
    await user.type(isian, "2026-12-12");
    // Tunggu autosave (debounce 800 ms) berangkat.
    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1), {
      timeout: 3000,
    });

    // Ketikan baru masuk SELAGI request pertama berjalan.
    await user.type(isian, "9");
    selesaikanSimpanPertama();

    // Beri waktu rantai simpan menuliskan statusnya (jauh di bawah debounce
    // 800 ms, jadi ketikan terakhir PASTI belum berangkat saat kita menilai).
    await act(async () => {
      await new Promise((lanjut) => setTimeout(lanjut, 50));
    });

    // Request pertama sukses, tetapi ketikan terakhir belum terkirim: mengaku
    // "Tersimpan" di sini membuat pemilik berani menutup tab dan kehilangannya.
    expect(screen.getByRole("status")).toHaveTextContent(
      copy.editor.save.saving,
    );
  });
});

describe("ketikan terakhir sebelum berpindah halaman", () => {
  it("ikut tersimpan — nilai terbaru dikirim ke server", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.type(screen.getByLabelText("Tanggal acara"), "2026-12-12");
    await user.click(tombolKanan()); // pindah ke langkah terakhir
    await user.click(tombolKanan()); // Selesai

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(saveDraft).toHaveBeenCalled();
    const terakhir = saveDraft.mock.calls.at(-1);
    expect(terakhir?.[0]).toBe("9a500f03-f12d-4d66-85fc-af8ebcedd350");
    expect(terakhir?.[1]).toMatchObject({ eventDate: "2026-12-12" });
  });

  it("navigasi DITAHAN sampai simpanan selesai", async () => {
    const user = userEvent.setup();
    let selesaikanSimpan: (v: { status: string }) => void = () => {};
    saveDraft.mockImplementation(
      () =>
        new Promise((resolve) => {
          selesaikanSimpan = resolve;
        }),
    );

    renderEditor();
    await user.type(screen.getByLabelText("Tanggal acara"), "2026-12-12");
    await user.click(tombolKanan());
    await user.click(tombolKanan());

    // Simpan masih menggantung → pemilik belum boleh dipindahkan.
    await waitFor(() => expect(saveDraft).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
    expect(tombolKanan()).toBeDisabled();
    expect(tombolKanan()).toHaveTextContent(copy.editor.nav.finishing);

    selesaikanSimpan({ status: "success" });
    await waitFor(() => expect(push).toHaveBeenCalled());
  });

  it("simpan GAGAL → tetap di editor, pemilik diberi tahu, tombol hidup lagi", async () => {
    const user = userEvent.setup();
    saveDraft.mockResolvedValue({ status: "error" });

    renderEditor();
    await user.type(screen.getByLabelText("Tanggal acara"), "2026-12-12");
    await user.click(tombolKanan());
    await user.click(tombolKanan());

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        copy.editor.nav.finishFailed,
      ),
    );
    expect(push).not.toHaveBeenCalled();
    expect(tombolKanan()).toBeEnabled();
  });

  it("ketikan yang masuk SAAT simpan berjalan ikut terkirim sebelum pindah", async () => {
    const user = userEvent.setup();
    let selesaikanSimpanPertama: (v: { status: string }) => void = () => {};
    saveDraft
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            selesaikanSimpanPertama = resolve;
          }),
      )
      .mockResolvedValue({ status: "success" });

    renderEditor();
    await user.type(screen.getByLabelText("Tanggal acara"), "2026-12-12");
    await user.click(tombolKanan()); // ke langkah terakhir
    await user.click(tombolKanan()); // Selesai → simpan pertama menggantung
    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1));

    // Pemilik masih sempat mengubah isian sementara request pertama berjalan.
    const isian = screen.getByLabelText("Tanggal acara");
    await user.clear(isian);
    await user.type(isian, "2027-01-01");
    selesaikanSimpanPertama({ status: "success" });

    // Susulan wajib terkirim: tanpa itu ketikan terakhir hilang diam-diam.
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(saveDraft.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(saveDraft.mock.calls.at(-1)?.[1]).toMatchObject({
      eventDate: "2027-01-01",
    });
  });

  it("DITOLAK server: pesan menunjuk isian, bukan koneksi, dan isi sama tak dikirim ulang", async () => {
    const user = userEvent.setup();
    // Bentuk respons penolakan Zod dari server: membawa `fieldErrors`.
    saveDraft.mockResolvedValue({
      status: "error",
      fieldErrors: { content: ["Too big: expected string to have <=2000"] },
    });

    renderEditor();
    await user.type(screen.getByLabelText("Tanggal acara"), "2026-12-12");
    await user.click(tombolKanan());
    await user.click(tombolKanan());

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        copy.editor.nav.finishRejectedUnknown,
      ),
    );
    expect(push).not.toHaveBeenCalled();

    // Menekan lagi TIDAK boleh mengulang payload identik yang pasti ditolak.
    const sesudahTolakan = saveDraft.mock.calls.length;
    await user.click(tombolKanan());
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        copy.editor.nav.finishRejectedUnknown,
      ),
    );
    expect(saveDraft).toHaveBeenCalledTimes(sesudahTolakan);
    expect(push).not.toHaveBeenCalled();
  });

  it("isian diperbaiki setelah ditolak: simpanan lolos, pesan hilang, Selesai jalan", async () => {
    const user = userEvent.setup();
    saveDraft.mockResolvedValue({
      status: "error",
      fieldErrors: { content: ["Too big"] },
    });

    renderEditor();
    await user.type(screen.getByLabelText("Tanggal acara"), "2026-12-12");
    await user.click(tombolKanan());
    await user.click(tombolKanan());
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    // Pemilik memperbaiki isiannya → payload BARU boleh dicoba lagi.
    saveDraft.mockResolvedValue({ status: "success" });
    const isian = screen.getByLabelText("Tanggal acara");
    await user.clear(isian);
    await user.type(isian, "2026-12-13");

    // Autosave berikutnya berhasil → keluhan lama hilang SENDIRI, tanpa pemilik
    // menekan apa pun. (Menilainya sesudah klik Selesai tak membuktikan apa-apa:
    // handler memang mengosongkan keluhan di awal tiap percobaan.)
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull(), {
      timeout: 3000,
    });

    await user.click(tombolKanan());
    await waitFor(() => expect(push).toHaveBeenCalled());
  });

  it("klik ganda hanya menghasilkan satu navigasi", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(tombolKanan());

    const btn = tombolKanan();
    await Promise.all([user.click(btn), user.click(btn)]);

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
  });
});

import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Halaman Sebar Undangan (SPEC §4.7, DECISIONS #120). Klien nyata: 222 tamu,
 * 0 bernomor — dulu tak ada satu pun tombol kirim, "Salin pesan" tak mencatat
 * apa pun, dan tak ada jejak siapa yang sudah dikirimi.
 */

const { mark, unmark, save } = vi.hoisted(() => ({
  mark: vi.fn(async () => ({ status: "success" as const })),
  unmark: vi.fn(async () => ({ status: "success" as const })),
  save: vi.fn(async () => ({ status: "success" as const })),
}));
vi.mock("@/server/actions/guests", () => ({
  markWaClickedAction: mark,
  unmarkWaClickedAction: unmark,
}));
vi.mock("@/server/actions/sebar", () => ({
  saveShareTemplatesAction: save,
}));

import {
  SebarUndangan,
  type SebarGuest,
} from "@/components/dashboard/sebar-undangan";
import { copy } from "@/lib/copy";

const t = copy.dashboard.sebar;
const INV = "11111111-1111-4111-8111-111111111111";

function tamu(id: string, name: string, extra: Partial<SebarGuest> = {}) {
  return {
    id,
    name,
    phone: null,
    token: `tok${id}xxxxxx`,
    groupLabel: null,
    sent: false,
    opened: false,
    rsvp: null,
    ...extra,
  } satisfies SebarGuest;
}

const GUESTS: SebarGuest[] = [
  tamu("g1", "Dzulfanris"),
  tamu("g2", "Bpk Halkemri", { groupLabel: "buyung" }),
  tamu("g3", "Ibu Lina", { phone: "+6281234567890" }),
  tamu("g4", "Ibu Niken", { sent: true, opened: true }),
  tamu("g5", "Pak Cecep", { opened: true, rsvp: "yes" }),
];

let opened: string[] = [];
let clip: string[] = [];

function pasang(
  over: Partial<Parameters<typeof SebarUndangan>[0]> = {},
): ReturnType<typeof userEvent.setup> {
  const user = userEvent.setup();
  // SESUDAH setup(): user-event memasang stub clipboard sendiri.
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(async (s: string) => void clip.push(s)) },
  });
  render(
    <SebarUndangan
      invitationId={INV}
      slug="rani-wanda"
      acara="pernikahan Wanda & Rani"
      tanggal="Minggu, 6 Desember 2026"
      templates={{ personal: null, general: null }}
      initial={GUESTS}
      {...over}
    />,
  );
  return user;
}

const kartu = (nama: string) =>
  screen.getByText(nama, { selector: "span" }).closest("li") as HTMLElement;

beforeEach(() => {
  opened = [];
  clip = [];
  sessionStorage.clear();
  vi.spyOn(window, "open").mockImplementation((url) => {
    opened.push(String(url));
    return null;
  });
  mark.mockClear();
  unmark.mockClear();
  save.mockClear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("kirim ke tamu TANPA nomor", () => {
  it("tombol 'Kirim via WA' ada untuk tamu tanpa nomor → wa.me/?text= (pemilih kontak)", async () => {
    const user = pasang();
    await user.click(
      within(kartu("Dzulfanris")).getByRole("button", { name: t.waSend }),
    );
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatch(/^https:\/\/wa\.me\/\?text=/);
    const pesan = decodeURIComponent(opened[0].split("text=")[1]);
    expect(pesan).toContain("Kepada Yth. Dzulfanris,");
    expect(pesan).toContain("/rani-wanda?g=tokg1xxxxxx");
    expect(pesan).toContain("pada Minggu, 6 Desember 2026");
    expect(pesan).toContain("tidak perlu memasang aplikasi");
    expect(pesan).not.toMatch(/mohon maaf/i);
  });

  it("tamu bernomor tetap langsung ke chat-nya", async () => {
    const user = pasang();
    await user.click(
      within(kartu("Ibu Lina")).getByRole("button", { name: t.waSend }),
    );
    expect(opened[0]).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
  });

  it("tanda terkirim dikirim SEBELUM pindah ke WhatsApp", async () => {
    const urutan: string[] = [];
    mark.mockImplementationOnce(async () => {
      urutan.push("tandai");
      return { status: "success" };
    });
    vi.mocked(window.open).mockImplementation(() => {
      urutan.push("buka");
      return null;
    });
    const user = pasang();
    await user.click(
      within(kartu("Dzulfanris")).getByRole("button", { name: t.waSend }),
    );
    expect(urutan).toEqual(["tandai", "buka"]);
    expect(mark).toHaveBeenCalledWith(INV, "g1");
  });
});

describe("pelacakan", () => {
  it("header progres dari data: terkirim termasuk yang dibuka/RSVP", () => {
    pasang();
    expect(screen.getByText(t.progress(2, 5, 2, 1))).toBeInTheDocument();
  });

  it("filter bawaan 'Belum dikirim'; tamu yang baru dikirim MENEMPEL sampai filter berganti", async () => {
    const user = pasang();
    expect(screen.queryByText("Ibu Niken")).toBeNull(); // sudah dibuka
    await user.click(
      within(kartu("Dzulfanris")).getByRole("button", { name: t.waSend }),
    );
    expect(screen.getByText(t.progress(3, 5, 2, 1))).toBeInTheDocument();
    // Tetap terlihat: status & "Batalkan" terjangkau di tempat yang sama.
    const row = kartu("Dzulfanris");
    expect(within(row).getByText(t.status.sent)).toBeInTheDocument();
    expect(
      within(row).getByRole("button", { name: t.undoLabel("Dzulfanris") }),
    ).toBeInTheDocument();
    // Ganti filter → antrean kerja bersih kembali.
    await user.click(screen.getByRole("button", { name: /^Semua/ }));
    await user.click(screen.getByRole("button", { name: /^Belum dikirim/ }));
    expect(screen.queryByText("Dzulfanris", { selector: "span" })).toBeNull();
  });

  it("ketukan ganda (WhatsApp lambat terbuka) TIDAK menandai tamu berikutnya", async () => {
    const user = pasang();
    const tombol = within(kartu("Dzulfanris")).getByRole("button", {
      name: t.waSend,
    });
    await user.click(tombol);
    await user.click(
      within(kartu("Dzulfanris")).getByRole("button", { name: t.waSend }),
    );
    expect(mark.mock.calls.map((c) => (c as unknown[])[1])).toEqual(["g1"]);
  });

  it("transport putus (aksi melempar) → tanda DIPERTAHANKAN + peringatan, bukan dibalik diam-diam", async () => {
    mark.mockImplementationOnce(async () => {
      throw new TypeError("Load failed");
    });
    const user = pasang();
    await user.click(
      within(kartu("Dzulfanris")).getByRole("button", { name: t.waSend }),
    );
    await act(async () => {});
    expect(
      within(kartu("Dzulfanris")).getByText(t.status.sent),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      t.markUncertain("Dzulfanris"),
    );
  });

  it("percobaan ulang yang berhasil menghapus peringatan tamu itu", async () => {
    mark.mockImplementationOnce(async () => ({ status: "error" }) as never);
    const user = pasang();
    await user.click(
      within(kartu("Dzulfanris")).getByRole("button", { name: t.waSend }),
    );
    await act(async () => {});
    expect(screen.getByRole("status")).toBeInTheDocument();
    await user.click(
      within(kartu("Dzulfanris")).getByRole("button", { name: t.waSend }),
    );
    await act(async () => {});
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("batal-tanda ditolak server → pesan khusus pembatalan, badge tetap Terkirim", async () => {
    unmark.mockImplementationOnce(async () => ({ status: "error" }) as never);
    const user = pasang();
    await user.click(screen.getByRole("button", { name: /^Semua/ }));
    await user.click(
      within(kartu("Dzulfanris")).getByRole("button", { name: t.waSend }),
    );
    await user.click(
      within(kartu("Dzulfanris")).getByRole("button", {
        name: t.undoLabel("Dzulfanris"),
      }),
    );
    await act(async () => {});
    expect(
      within(kartu("Dzulfanris")).getByText(t.status.sent),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      t.unmarkFailed("Dzulfanris"),
    );
  });

  it("'Salin pesan di daftar ini' mati bila yang terlihat hanya baris yang menempel", async () => {
    const user = pasang({ initial: [tamu("g1", "Dzulfanris")] });
    await user.click(
      within(kartu("Dzulfanris")).getByRole("button", { name: t.waSend }),
    );
    // Baris menempel (sudah ditandai) masih terlihat, tetapi daftar murni kosong.
    expect(
      screen.getByText("Dzulfanris", { selector: "span" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.copyAll })).toBeDisabled();
  });

  it("salin gagal (clipboard ditolak) → TIDAK menandai terkirim", async () => {
    const user = pasang();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn(async () => {
          throw new Error("ditolak");
        }),
      },
    });
    await user.click(
      within(kartu("Dzulfanris")).getByRole("button", { name: t.copyMsg }),
    );
    expect(mark).not.toHaveBeenCalled();
    expect(
      within(kartu("Dzulfanris")).getByText(t.status.unsent),
    ).toBeInTheDocument();
  });

  it("'Salin pesan' juga menandai terkirim, dan bisa dibatalkan", async () => {
    const user = pasang();
    await user.click(screen.getByRole("button", { name: /^Semua/ }));
    await user.click(
      within(kartu("Bpk Halkemri")).getByRole("button", { name: t.copyMsg }),
    );
    expect(clip[0]).toContain("Kepada Yth. Bpk Halkemri,");
    expect(mark).toHaveBeenCalledWith(INV, "g2");
    const row = kartu("Bpk Halkemri");
    expect(within(row).getByText(t.status.sent)).toBeInTheDocument();

    await user.click(
      within(row).getByRole("button", { name: t.undoLabel("Bpk Halkemri") }),
    );
    expect(unmark).toHaveBeenCalledWith(INV, "g2");
    expect(
      within(kartu("Bpk Halkemri")).getByText(t.status.unsent),
    ).toBeInTheDocument();
  });

  it("server menolak tanda → dikembalikan + diberitahukan, daftar tetap jujur", async () => {
    mark.mockImplementationOnce(async () => ({ status: "error" }) as never);
    const user = pasang();
    await user.click(screen.getByRole("button", { name: /^Semua/ }));
    await user.click(
      within(kartu("Dzulfanris")).getByRole("button", { name: t.waSend }),
    );
    await act(async () => {});
    expect(
      within(kartu("Dzulfanris")).getByText(t.status.unsent),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      t.markFailed("Dzulfanris"),
    );
  });

  it("status objektif tampil; 'Batalkan' hanya untuk yang sekadar ditandai", async () => {
    const user = pasang();
    await user.click(screen.getByRole("button", { name: /^Semua/ }));
    expect(
      within(kartu("Ibu Niken")).getByText(t.status.opened),
    ).toBeInTheDocument();
    expect(
      within(kartu("Pak Cecep")).getByText(t.status.attending),
    ).toBeInTheDocument();
    expect(
      within(kartu("Ibu Niken")).queryByRole("button", {
        name: /belum dikirim/,
      }),
    ).toBeNull();
  });

  it("cari menyaring nama & grup", async () => {
    const user = pasang();
    await user.click(screen.getByRole("button", { name: /^Semua/ }));
    await user.type(screen.getByPlaceholderText(t.searchPlaceholder), "buyung");
    expect(
      screen.getByText("Bpk Halkemri", { selector: "span" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Dzulfanris", { selector: "span" })).toBeNull();
  });
});

describe("mode kirim satu per satu", () => {
  it("antre tamu belum dikirim; Ya → lanjut; selesai di akhir", async () => {
    const user = pasang();
    await user.click(screen.getByRole("button", { name: t.seq.start }));
    const dlg = screen.getByRole("dialog");
    expect(within(dlg).getByText(t.seq.counter(1, 3))).toBeInTheDocument();
    expect(within(dlg).getByText("Dzulfanris")).toBeInTheDocument();

    await user.click(within(dlg).getByRole("button", { name: t.seq.send }));
    expect(opened[0]).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(
      within(dlg).getByText(t.seq.confirm("Dzulfanris")),
    ).toBeInTheDocument();
    // Fokus siap di "Ya" — kembali dari WhatsApp cukup satu ketuk.
    expect(within(dlg).getByRole("button", { name: t.seq.yes })).toHaveFocus();

    await user.click(within(dlg).getByRole("button", { name: t.seq.yes }));
    expect(within(dlg).getByText(t.seq.counter(2, 3))).toBeInTheDocument();
    expect(within(dlg).getByText("Bpk Halkemri")).toBeInTheDocument();

    await user.click(within(dlg).getByRole("button", { name: t.seq.skip }));
    await user.click(within(dlg).getByRole("button", { name: t.seq.skip }));
    expect(within(dlg).getByText(t.seq.done)).toBeInTheDocument();
  });

  it("'Belum, kirim ulang' membatalkan tanda dan tetap di tamu yang sama", async () => {
    const user = pasang();
    await user.click(screen.getByRole("button", { name: t.seq.start }));
    const dlg = screen.getByRole("dialog");
    await user.click(within(dlg).getByRole("button", { name: t.seq.send }));
    await user.click(within(dlg).getByRole("button", { name: t.seq.no }));
    expect(unmark).toHaveBeenCalledWith(INV, "g1");
    expect(within(dlg).getByText(t.seq.counter(1, 3))).toBeInTheDocument();
    expect(
      within(dlg).getByRole("button", { name: t.seq.send }),
    ).toBeInTheDocument();
  });

  it("'Lewati' sesudah membuka WhatsApp membatalkan tanda tamu itu", async () => {
    const user = pasang();
    await user.click(screen.getByRole("button", { name: t.seq.start }));
    const dlg = screen.getByRole("dialog");
    await user.click(within(dlg).getByRole("button", { name: t.seq.send }));
    await user.click(within(dlg).getByRole("button", { name: t.seq.skip }));
    expect(unmark).toHaveBeenCalledWith(INV, "g1");
    expect(within(dlg).getByText(t.seq.counter(2, 3))).toBeInTheDocument();
  });

  it("Escape / Selesai menutup", async () => {
    const user = pasang();
    await user.click(screen.getByRole("button", { name: t.seq.start }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("tanda GAGAL selama mode beruntun → peringatan terlihat DI DALAM dialog", async () => {
    mark.mockImplementationOnce(async () => ({ status: "error" }) as never);
    const user = pasang();
    await user.click(screen.getByRole("button", { name: t.seq.start }));
    const dlg = screen.getByRole("dialog");
    await user.click(within(dlg).getByRole("button", { name: t.seq.send }));
    await act(async () => {});
    expect(within(dlg).getByRole("status")).toHaveTextContent(
      t.markFailed("Dzulfanris"),
    );
  });

  const tunggu = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

  it("antrean habis → fokus di 'Selesai' (bukan hilang ke body); tutup → judul daftar (pemicu kini mati)", async () => {
    const user = pasang({ initial: [tamu("g1", "Dzulfanris")] });
    await user.click(screen.getByRole("button", { name: t.seq.start }));
    const dlg = screen.getByRole("dialog");
    await user.click(within(dlg).getByRole("button", { name: t.seq.send }));
    await user.click(within(dlg).getByRole("button", { name: t.seq.yes }));
    expect(within(dlg).getByText(t.seq.done)).toBeInTheDocument();
    const selesai = within(dlg).getByRole("button", { name: t.seq.exit });
    expect(selesai).toHaveFocus();
    await user.click(selesai);
    await tunggu();
    expect(screen.getByRole("button", { name: t.seq.start })).toBeDisabled();
    expect(
      screen.getByRole("heading", { name: t.guestListTitle }),
    ).toHaveFocus();
  });

  it("tutup saat masih ada tamu belum dikirim → fokus kembali ke tombol pemicu", async () => {
    const user = pasang({ initial: [tamu("g1", "Dzulfanris")] });
    await user.click(screen.getByRole("button", { name: t.seq.start }));
    const dlg = screen.getByRole("dialog");
    await user.click(within(dlg).getByRole("button", { name: t.seq.skip }));
    await user.click(within(dlg).getByRole("button", { name: t.seq.exit }));
    await tunggu();
    expect(screen.getByRole("button", { name: t.seq.start })).toHaveFocus();
  });

  it("antrean dari filter mana pun = tamu belum dikirim yang cocok pencarian", async () => {
    // Dulu: dari filter "Terkirim" antreannya kosong → "Tidak ada tamu yang
    // belum dikirimi" padahal masih ada.
    const user = pasang();
    await user.click(screen.getByRole("button", { name: /^Terkirim/ }));
    await user.click(screen.getByRole("button", { name: t.seq.start }));
    expect(
      within(screen.getByRole("dialog")).getByText(t.seq.counter(1, 3)),
    ).toBeInTheDocument();
  });

  it("tab dibuang saat di WhatsApp → konfirmasi tamu yang tertinggal muncul lagi saat dibuka ulang", async () => {
    sessionStorage.setItem(`sebar-menunggu:${INV}`, "g6");
    const user = pasang({
      initial: [...GUESTS, tamu("g6", "Bu Siti", { sent: true })],
    });
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByText(t.seq.confirm("Bu Siti"))).toBeInTheDocument();
    await user.click(within(dlg).getByRole("button", { name: t.seq.no }));
    expect(unmark).toHaveBeenCalledWith(INV, "g6");
    expect(sessionStorage.getItem(`sebar-menunggu:${INV}`)).toBeNull();
    // Konfirmasi pulihan satu tamu saja: "Ya" menutup, tak menyebut "semua".
    await user.click(within(dlg).getByRole("button", { name: t.seq.send }));
    await user.click(within(dlg).getByRole("button", { name: t.seq.yes }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("kunci tertinggal untuk tamu yang tak lagi bertanda → dibuang, tanpa dialog", async () => {
    sessionStorage.setItem(`sebar-menunggu:${INV}`, "g1"); // g1 belum dikirim
    pasang();
    await act(async () => {});
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(sessionStorage.getItem(`sebar-menunggu:${INV}`)).toBeNull();
  });

  it("mengirim dari dialog mengingat tamu yang menunggu; Ya melupakannya", async () => {
    const user = pasang();
    await user.click(screen.getByRole("button", { name: t.seq.start }));
    const dlg = screen.getByRole("dialog");
    await user.click(within(dlg).getByRole("button", { name: t.seq.send }));
    expect(sessionStorage.getItem(`sebar-menunggu:${INV}`)).toBe("g1");
    await user.click(within(dlg).getByRole("button", { name: t.seq.yes }));
    expect(sessionStorage.getItem(`sebar-menunggu:${INV}`)).toBeNull();
  });
});

describe("undangan umum tanpa nama", () => {
  it("tanpa nama: link polos tanpa token, sapaan 'Bapak/Ibu/Saudara/i'", async () => {
    const user = pasang();
    await user.click(screen.getByRole("button", { name: t.sendGeneral }));
    const pesan = decodeURIComponent(opened[0].split("text=")[1]);
    expect(opened[0]).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(pesan).toContain("Bapak/Ibu/Saudara/i");
    expect(pesan).toMatch(/\/rani-wanda\n/);
    expect(pesan).not.toContain("?g=");
    expect(mark).not.toHaveBeenCalled(); // tak ada tamu yang ditandai
  });

  it("dengan nama: ?to=Nama dan sapaan menyebut namanya", async () => {
    const user = pasang();
    await user.type(screen.getByLabelText(t.generalNameLabel), "Bu Siti");
    await user.click(screen.getByRole("button", { name: t.copyGeneral }));
    expect(clip[0]).toContain("Kepada Yth.\nBu Siti\n");
    expect(clip[0]).toContain("/rani-wanda?to=Bu+Siti");
  });
});

describe("template tersimpan", () => {
  it("simpan mengirim kedua template; tombol mati bila tak ada perubahan", async () => {
    const user = pasang();
    const tombol = screen.getByRole("button", { name: t.saveTemplate });
    expect(tombol).toBeDisabled();
    const ta = screen.getByLabelText(t.templateLabel);
    await user.clear(ta);
    await user.type(ta, "Halo {{nama}, buka {{link}");
    await user.click(screen.getByRole("button", { name: t.saveTemplate }));
    expect(save).toHaveBeenCalledWith(INV, {
      personal: "Halo {nama}, buka {link}",
      general: t.defaultTemplateGeneral,
    });
    expect(await screen.findByText(t.savedTemplate)).toBeInTheDocument();
  });

  it("template tanpa {link} → peringatan menyebut template MANA, simpan & kirim dikunci", async () => {
    const user = pasang();
    const ta = screen.getByLabelText(t.templateLabel);
    await user.clear(ta);
    await user.type(ta, "Halo {{nama}");
    // Pindah ke tab umum: peringatan untuk template personal tetap terlihat.
    await user.click(
      screen.getByRole("button", { name: t.templateGeneralLabel }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      t.templateNeedsLinkPersonal,
    );
    expect(screen.getByRole("button", { name: t.saveTemplate })).toBeDisabled();
    expect(
      within(kartu("Dzulfanris")).getByRole("button", { name: t.waSend }),
    ).toBeDisabled();
  });

  it("template BELUM disimpan mengunci kirim template itu saja (+ petunjuk); simpan membukanya", async () => {
    const user = pasang();
    const ta = screen.getByLabelText(t.templateLabel);
    await user.type(ta, " Salam.");
    const kirimBaris = () =>
      within(kartu("Dzulfanris")).getByRole("button", { name: t.waSend });
    expect(kirimBaris()).toBeDisabled();
    expect(screen.getByRole("button", { name: t.seq.start })).toBeDisabled();
    expect(screen.getByText(t.saveFirst)).toBeInTheDocument();
    // Template umum tak tersentuh → kartu umum tetap bisa dipakai.
    expect(
      screen.getByRole("button", { name: t.sendGeneral }),
    ).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: t.saveTemplate }));
    expect(await screen.findByText(t.savedTemplate)).toBeInTheDocument();
    expect(kirimBaris()).not.toBeDisabled();
  });

  it("template tersimpan dipakai saat halaman dibuka lagi", async () => {
    const user = pasang({
      templates: { personal: "Hai {nama} → {link}", general: null },
    });
    await user.click(
      within(kartu("Dzulfanris")).getByRole("button", { name: t.copyMsg }),
    );
    expect(clip[0]).toMatch(/^Hai Dzulfanris → http/);
  });

  it("tanpa tanggal acara → frasa pengganti, bukan '{tanggal}' mentah", async () => {
    const user = pasang({ tanggal: null });
    await user.click(
      within(kartu("Dzulfanris")).getByRole("button", { name: t.copyMsg }),
    );
    expect(clip[0]).toContain(`pada ${t.dateFallback}.`);
    expect(clip[0]).not.toContain("{tanggal}");
  });
});

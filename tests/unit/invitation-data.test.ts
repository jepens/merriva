import { describe, expect, it } from "vitest";

import { copy } from "@/lib/copy";
import { DEFAULT_SETTINGS, emptyContent } from "@/lib/validation/content";
import { buildInvitationData } from "@/server/invitation-data";

/**
 * Builder data undangan = SATU titik saringan untuk halaman publik & pratinjau
 * (DECISIONS #42). Sesi draft tanpa jam tersimpan di DB, tetapi tak boleh
 * sampai ke tema: kontrak `InvitationEventView.startAt` tetap `string`, dan
 * `events[0]` (label tanggal hero + hitung mundur di ke-10 tema) harus sesi
 * TERJADWAL pertama.
 */

function build(
  eventRows: Parameters<typeof buildInvitationData>[0]["eventRows"],
) {
  return buildInvitationData({
    slug: "andi-sinta",
    category: "wedding",
    content: emptyContent("wedding"),
    settings: DEFAULT_SETTINGS,
    eventDate: null,
    eventRows,
    mediaRows: [],
    watermark: false,
    music: null,
  });
}

const baris = (id: string, start_at: string | null, name = "Sesi") => ({
  id,
  name,
  start_at,
  end_at: null,
  venue_name: null,
  address: null,
  maps_url: null,
});

describe("buildInvitationData — jadwal", () => {
  it("sesi tanpa jam TIDAK sampai ke tema; events[0] = sesi terjadwal pertama", () => {
    const data = build([
      baris("draft", null, "Resepsi"),
      baris("akad", "2026-08-15T01:00:00Z", "Akad"),
    ]);
    expect(data.events.map((e) => e.id)).toEqual(["akad"]);
    expect(data.events[0].startAt).toBe("2026-08-15T01:00:00Z");
  });

  it("nama sesi yang dikosongkan tampil ke tamu sebagai label cadangan", () => {
    const data = build([baris("akad", "2026-08-15T01:00:00Z", "  ")]);
    expect(data.events[0].name).toBe(copy.public.eventFallbackName);
  });

  it("semua sesi belum berjam → jadwal kosong (tema memakai tanggal acara utama)", () => {
    expect(build([baris("a", null), baris("b", null)]).events).toEqual([]);
  });
});

describe("buildInvitationData — foto bernama", () => {
  /**
   * Yang disimpan di `content` adalah PREFIX 2-varian, sama seperti
   * `media.storage_path`. Tanpa `displayPath`, tema menerima URL direktori dan
   * SETIAP foto mempelai/sampul 404 — pada halaman yang tetap menjawab 200,
   * jadi tak ada monitor yang akan meneriakkannya.
   */
  function dengan(content: Record<string, unknown>) {
    return buildInvitationData({
      slug: "andi-sinta",
      category: "wedding",
      content: { ...emptyContent("wedding"), ...content },
      settings: DEFAULT_SETTINGS,
      eventDate: null,
      eventRows: [],
      mediaRows: [],
      watermark: false,
      music: null,
    });
  }

  const foto = (path: string, x = 0.5, y = 0.5, zoom = 1) => ({
    path,
    x,
    y,
    zoom,
  });

  it("memberi tema varian DISPLAY, bukan prefixnya", () => {
    const d = dengan({
      coverPhoto: foto("inv/a/foto/c1"),
      groom: { name: "A", photo: foto("inv/a/foto/g1") },
      bride: { name: "B", photo: foto("inv/a/foto/b1") },
    });

    expect(d.coverPhoto?.url).toMatch(/\/inv\/a\/foto\/c1\/1600\.webp$/);
    expect(d.groomPhoto?.url).toMatch(/\/inv\/a\/foto\/g1\/1600\.webp$/);
    expect(d.bridePhoto?.url).toMatch(/\/inv\/a\/foto\/b1\/1600\.webp$/);
  });

  it("meneruskan titik fokus & perbesaran apa adanya ke tema", () => {
    // Inti model non-destruktif: angka ini TIDAK dipanggang ke berkas, jadi ia
    // harus sampai ke tema utuh — kalau hilang di sini, penyesuaian pemilik
    // lenyap tanpa jejak dan fotonya kembali terpusat.
    const d = dengan({
      groom: { name: "A", photo: foto("inv/a/foto/g1", 0.2, 0.8, 2.5) },
    });

    expect(d.groomPhoto).toMatchObject({ x: 0.2, y: 0.8, zoom: 2.5 });
  });

  it("tanpa foto → null, supaya tema memakai fallback monogram", () => {
    const d = dengan({});
    expect(d.coverPhoto).toBeNull();
    expect(d.groomPhoto).toBeNull();
    expect(d.bridePhoto).toBeNull();
  });
});

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

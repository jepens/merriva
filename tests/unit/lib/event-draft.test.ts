import { describe, expect, it } from "vitest";

import { localToStoredUtc } from "@/lib/datetime";
import {
  isBlankEventDraft,
  isCompleteLocalDateTime,
  isScheduleComplete,
  newEventId,
} from "@/lib/event-draft";
import { isUuid } from "@/lib/id";
import { scheduledEvents, toEventDraft } from "@/lib/schedule";

describe("isCompleteLocalDateTime — satu aturan untuk editor & server (DECISIONS #42)", () => {
  it.each([
    ["2026-08-15T10:00", true],
    ["2026-08-15T10:00:30", true],
    [" 2026-08-15T10:00 ", true],
    ["1900-01-01T00:00", true],
    ["9999-12-31T23:59", true],
    ["2028-02-29T10:00", true], // kabisat
    ["", false],
    ["besok pagi", false],
    ["2026-08-15", false], // jam belum diisi
    ["2026-02-30T10:00", false], // BUKAN digeser diam-diam ke 2 Maret
    ["2027-02-29T10:00", false],
    ["2026-13-01T10:00", false],
    ["2026-08-15T24:00", false],
    ["2026-08-15T10:60", false],
    ["1899-12-31T23:59", false],
    ["0001-01-01T05:00", false], // zona → tahun 0000, ditolak Postgres
    ["+010000-01-01T00:00", false],
    ["2026-08-15T10:00+07:00", false],
    ["2026-08-15T10:00Z", false],
  ])("%j → %s", (v, ok) => {
    expect(isCompleteLocalDateTime(v)).toBe(ok);
  });

  it("nilai bukan string tak pernah dianggap lengkap", () => {
    expect(isCompleteLocalDateTime(undefined)).toBe(false);
    expect(isCompleteLocalDateTime(null)).toBe(false);
  });
});

describe("kartu sesi kosong & kelengkapan langkah Jadwal", () => {
  const berjam = { name: "Akad", startAt: "2026-08-15T08:00" };
  const tanpaJam = { name: "Resepsi", venueName: "Gedung Mawar", startAt: "" };
  const kosong = {
    name: " ",
    startAt: "",
    endAt: "",
    venueName: "",
    address: "",
    mapsUrl: "",
  };

  it("kartu kosong total (spasi pun) dianggap kosong; isian apa pun membuatnya berisi", () => {
    expect(isBlankEventDraft(kosong)).toBe(true);
    expect(isBlankEventDraft({})).toBe(true);
  });

  it.each(["name", "startAt", "endAt", "venueName", "address", "mapsUrl"])(
    "satu isian %s saja sudah membuat kartu BERISI (tak boleh dibuang)",
    (key) => {
      expect(isBlankEventDraft({ [key]: "x" })).toBe(false);
    },
  );

  it("lengkap = ada sesi berjam DAN semua sesi berisi sudah berjam", () => {
    expect(isScheduleComplete([berjam])).toBe(true);
    expect(isScheduleComplete([berjam, kosong])).toBe(true);
    // Dulu `some(startAt)` → tercentang padahal Resepsi tak akan pernah tampil.
    expect(isScheduleComplete([berjam, tanpaJam])).toBe(false);
    expect(isScheduleComplete([tanpaJam])).toBe(false);
    expect(isScheduleComplete([kosong])).toBe(false);
    expect(isScheduleComplete([])).toBe(false);
  });
});

describe("localToStoredUtc", () => {
  it("mengonversi waktu lengkap per zona (WIB/WITA/WIT)", () => {
    expect(localToStoredUtc("2026-08-15T08:00", "Asia/Jakarta")).toBe(
      "2026-08-15T01:00:00.000Z",
    );
    expect(localToStoredUtc("2026-08-15T08:00", "Asia/Makassar")).toBe(
      "2026-08-15T00:00:00.000Z",
    );
    expect(localToStoredUtc("2026-08-15T08:00", "Asia/Jayapura")).toBe(
      "2026-08-14T23:00:00.000Z",
    );
  });

  it("waktu belum lengkap/tak sah → null (sesi draft), tak pernah digeser atau dilempar", () => {
    for (const v of [
      "",
      undefined,
      "2026-02-30T10:00",
      "0001-01-01T05:00",
      "besok pagi",
    ]) {
      expect(localToStoredUtc(v, "Asia/Jakarta")).toBeNull();
    }
  });
});

describe("scheduledEvents & toEventDraft", () => {
  it("hanya sesi berjam yang lolos ke pembaca publik, urutan dipertahankan", () => {
    const rows = [
      { id: "a", start_at: null },
      { id: "b", start_at: "2026-08-15T01:00:00Z" },
      { id: "c", start_at: "" },
      { id: "d", start_at: "bukan-waktu" },
      { id: "e", start_at: "2026-08-16T01:00:00Z" },
    ];
    expect(scheduledEvents(rows).map((r) => r.id)).toEqual(["b", "e"]);
  });

  it("baris tanpa jam kembali UTUH ke editor dengan isian Mulai kosong", () => {
    expect(
      toEventDraft(
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Resepsi",
          start_at: null,
          end_at: null,
          venue_name: "Gedung Mawar",
          address: "Jl. Melati 1",
          maps_url: "https://maps.app/x",
        },
        "Asia/Jakarta",
      ),
    ).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Resepsi",
      startAt: "",
      endAt: "",
      venueName: "Gedung Mawar",
      address: "Jl. Melati 1",
      mapsUrl: "https://maps.app/x",
    });
  });

  it("baris berjam dikonversi ke waktu-lokal zona undangan", () => {
    const d = toEventDraft(
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Akad",
        start_at: "2026-08-15T01:00:00Z",
        end_at: null,
        venue_name: null,
        address: null,
        maps_url: null,
      },
      "Asia/Jakarta",
    );
    // Objek penuh: jam Selesai yang tak pernah diisi tetap kosong (tak dikarang).
    expect(d).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Akad",
      startAt: "2026-08-15T08:00",
      endAt: "",
      venueName: "",
      address: "",
      mapsUrl: "",
    });
  });
});

describe("id sesi (DECISIONS #43)", () => {
  const V4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it("id saja tak membuat kartu dianggap berisi (kartu baru tetap tak disimpan)", () => {
    expect(isBlankEventDraft({ id: newEventId() })).toBe(true);
    expect(isScheduleComplete([{ id: newEventId() }])).toBe(false);
  });

  it("id baru = UUID v4, lolos pemeriksa server, dan tak pernah berulang", () => {
    const ids = Array.from({ length: 500 }, () => newEventId());
    for (const id of ids) {
      expect(id).toMatch(V4);
      expect(isUuid(id)).toBe(true);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("tanpa randomUUID (http non-localhost) jatuh ke getRandomValues dengan bit v4/varian benar", () => {
    const polos = {
      getRandomValues: <T extends ArrayBufferView | null>(a: T) => {
        // Semua bit menyala: membuktikan bit versi & varian DIPAKSA, bukan kebetulan.
        if (a instanceof Uint8Array) a.fill(0xff);
        return a;
      },
    };
    expect(newEventId(polos)).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");

    const nol = {
      getRandomValues: <T extends ArrayBufferView | null>(a: T) => a,
    };
    expect(newEventId(nol)).toBe("00000000-0000-4000-8000-000000000000");
  });
});

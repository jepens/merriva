import { describe, expect, it } from "vitest";

import {
  buildIcs,
  googleCalendarUrl,
  type CalendarEventInput,
} from "@/lib/calendar";

// DTSTAMP deterministik untuk uji (2026-07-29T00:00:00Z).
const NOW = Date.parse("2026-07-29T00:00:00.000Z");

const akad: CalendarEventInput = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "Akad Nikah",
  startAt: "2026-11-08T02:00:00.000Z", // 09.00 WIB
  endAt: "2026-11-08T03:00:00.000Z",
  venueName: "Masjid Al-Ikhlas",
  address: "Jl. Kaliurang KM 5, Sleman",
};

/** Batalkan folding RFC 5545 (CRLF + spasi awalan) → nilai logis utuh. */
function unfold(ics: string): string {
  return ics.replace(/\r\n /g, "");
}

describe("buildIcs — struktur VCALENDAR", () => {
  it("membungkus VEVENT dengan header wajib & CRLF", () => {
    const ics = buildIcs([akad], NOW);
    expect(ics).not.toBeNull();
    const s = ics as string;
    expect(s).toContain("BEGIN:VCALENDAR\r\n");
    expect(s).toContain("VERSION:2.0\r\n");
    expect(s).toContain("PRODID:-//Merriva//Undangan//ID\r\n");
    expect(s).toContain("BEGIN:VEVENT\r\n");
    expect(s).toContain("END:VEVENT\r\n");
    expect(s.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("memakai bentuk UTC iCalendar untuk DTSTART/DTEND/DTSTAMP", () => {
    const s = buildIcs([akad], NOW) as string;
    expect(s).toContain("DTSTART:20261108T020000Z");
    expect(s).toContain("DTEND:20261108T030000Z");
    expect(s).toContain("DTSTAMP:20260729T000000Z");
  });

  it("UID = {id}@merriva.id (idempoten)", () => {
    const s = buildIcs([akad], NOW) as string;
    expect(s).toContain("UID:11111111-1111-1111-1111-111111111111@merriva.id");
  });

  it("LOCATION menggabungkan gedung + alamat", () => {
    const s = buildIcs([akad], NOW) as string;
    expect(unfold(s)).toContain(
      "LOCATION:Masjid Al-Ikhlas\\, Jl. Kaliurang KM 5\\, Sleman",
    );
  });
});

describe("buildIcs — durasi default", () => {
  it("DTEND = start + 1 jam bila endAt null", () => {
    const s = buildIcs([{ ...akad, endAt: null }], NOW) as string;
    expect(s).toContain("DTSTART:20261108T020000Z");
    expect(s).toContain("DTEND:20261108T030000Z");
  });

  it("DTEND jatuh ke +1 jam bila endAt tidak setelah startAt", () => {
    const s = buildIcs(
      [{ ...akad, endAt: "2026-11-08T02:00:00.000Z" }],
      NOW,
    ) as string;
    expect(s).toContain("DTEND:20261108T030000Z");
  });
});

describe("buildIcs — escaping TEXT (RFC 5545)", () => {
  it("meng-escape backslash, titik-koma, koma, dan baris-baru", () => {
    const s = buildIcs(
      [
        {
          id: "e1",
          title: "Akad; Resepsi, sesi \\ khusus",
          startAt: "2026-11-08T02:00:00.000Z",
          endAt: null,
          description: "Baris satu\nBaris dua",
        },
      ],
      NOW,
    ) as string;
    const u = unfold(s);
    expect(u).toContain("SUMMARY:Akad\\; Resepsi\\, sesi \\\\ khusus");
    expect(u).toContain("DESCRIPTION:Baris satu\\nBaris dua");
  });
});

describe("buildIcs — folding (RFC 5545 §3.1)", () => {
  it("memecah baris > 75 oktet dan tetap dapat di-unfold", () => {
    // Tanpa karakter yang butuh escape agar unfold == nilai asli.
    const longDesc =
      "Undangan pernikahan Rina dan Bima mohon kehadiran Bapak Ibu Saudara pada hari bahagia kami di kota Yogyakarta";
    const s = buildIcs(
      [
        {
          id: "e1",
          title: "Resepsi",
          startAt: akad.startAt,
          description: longDesc,
        },
      ],
      NOW,
    ) as string;

    // Setiap baris fisik ≤ 75 oktet.
    for (const physical of s.split("\r\n")) {
      expect(new TextEncoder().encode(physical).length).toBeLessThanOrEqual(75);
    }
    // Nilai logis utuh setelah unfold.
    expect(unfold(s)).toContain(`DESCRIPTION:${longDesc}`);
  });

  it("tidak memecah karakter multi-oktet & tetap ≤ 75 oktet", () => {
    const emojiDesc = `Perayaan ${"🎉".repeat(30)}`;
    const s = buildIcs(
      [
        {
          id: "e1",
          title: "Pesta",
          startAt: akad.startAt,
          description: emojiDesc,
        },
      ],
      NOW,
    ) as string;
    for (const physical of s.split("\r\n")) {
      expect(new TextEncoder().encode(physical).length).toBeLessThanOrEqual(75);
    }
    expect(unfold(s)).toContain(`DESCRIPTION:${emojiDesc}`);
  });
});

describe("buildIcs — multi-sesi & validasi", () => {
  it("menghasilkan satu VEVENT per sesi valid", () => {
    const s = buildIcs(
      [
        akad,
        {
          ...akad,
          id: "22222222-2222-2222-2222-222222222222",
          title: "Resepsi",
        },
      ],
      NOW,
    ) as string;
    expect(s.match(/BEGIN:VEVENT/g)?.length).toBe(2);
  });

  it("melewati sesi dengan startAt tak valid", () => {
    const s = buildIcs(
      [akad, { ...akad, id: "bad", startAt: "bukan-tanggal" }],
      NOW,
    ) as string;
    expect(s.match(/BEGIN:VEVENT/g)?.length).toBe(1);
  });

  it("null bila tak ada sesi valid", () => {
    expect(buildIcs([], NOW)).toBeNull();
    expect(
      buildIcs([{ id: "x", title: "X", startAt: "invalid" }], NOW),
    ).toBeNull();
  });
});

describe("googleCalendarUrl", () => {
  it("merakit render TEMPLATE dengan dates/text/location", () => {
    const url = googleCalendarUrl(akad) as string;
    expect(url).toContain(
      "https://calendar.google.com/calendar/render?action=TEMPLATE",
    );
    const q = new URL(url).searchParams;
    expect(q.get("text")).toBe("Akad Nikah");
    expect(q.get("dates")).toBe("20261108T020000Z/20261108T030000Z");
    expect(q.get("location")).toBe(
      "Masjid Al-Ikhlas, Jl. Kaliurang KM 5, Sleman",
    );
  });

  it("default +1 jam bila tanpa endAt", () => {
    const q = new URL(googleCalendarUrl({ ...akad, endAt: null }) as string)
      .searchParams;
    expect(q.get("dates")).toBe("20261108T020000Z/20261108T030000Z");
  });

  it("null bila startAt tak valid", () => {
    expect(
      googleCalendarUrl({ id: "x", title: "X", startAt: "nope" }),
    ).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { FIELD_LIMITS } from "@/lib/validation/content/field-limits";
import {
  corporateContentSchema,
  DEFAULT_SETTINGS,
  emptyContent,
  familyContentSchema,
  weddingContentSchema,
} from "@/lib/validation/content";
import { eventInputSchema } from "@/lib/validation/content/event";
import { saveDraftSchema } from "@/lib/validation/invitation";

/**
 * Penjaga angka batas isian. Angka ditulis HARFIAH di sini (bukan dibaca dari
 * FIELD_LIMITS) supaya mutan "ubah angka" — di konstanta maupun di skema —
 * memerah. Setiap baris diuji ke skema ASLI: tepat N diterima, N+1 ditolak di
 * path yang sama, untuk jalur DRAFT (autosave) maupun STRICT (render).
 */

type Cat = "wedding" | "corporate" | "family";

/** Tulis nilai di path bertitik; indeks array dibuat bila belum ada. */
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

const clone = <T>(v: T): T => structuredClone(v);

// Baris contoh yang LOLOS skema strict (isian wajib terisi) untuk array.
const STORY = { title: "Judul", date: "2026", narrative: "Narasi" };
const BANK = { bank: "BCA", number: "123", holder: "Rina" };
const EWALLET = { provider: "GoPay", number: "0812" };
const EVENT = { name: "Akad", startAt: "2026-12-12T08:00" };

function draftBase(cat: Cat) {
  return {
    content: {
      ...emptyContent(cat),
      story: [clone(STORY)],
      agenda: [clone(STORY)],
      wishes: [clone(STORY)],
      quote: { text: "Kutipan" },
      envelope: {
        enabled: true,
        banks: [clone(BANK)],
        ewallets: [clone(EWALLET)],
      },
    },
    settings: DEFAULT_SETTINGS,
    eventDate: "",
    events: [clone(EVENT)],
  };
}

const STRICT = {
  wedding: {
    schema: weddingContentSchema,
    base: () => ({
      category: "wedding",
      groom: { name: "Bima" },
      bride: { name: "Rina" },
      story: [clone(STORY)],
      quote: { text: "Kutipan" },
      envelope: {
        enabled: true,
        banks: [clone(BANK)],
        ewallets: [clone(EWALLET)],
      },
    }),
  },
  corporate: {
    schema: corporateContentSchema,
    base: () => ({
      category: "corporate",
      eventName: "Rapat",
      agenda: [clone(STORY)],
    }),
  },
  family: {
    schema: familyContentSchema,
    base: () => ({
      category: "family",
      eventName: "Aqiqah",
      wishes: [clone(STORY)],
    }),
  },
} as const;

// [kategori, path relatif `content` / payload, batas]
const TEKS: [Cat, string, number][] = [
  ["wedding", "content.title", 160],
  ["wedding", "content.groom.name", 120],
  ["wedding", "content.groom.nickname", 60],
  ["wedding", "content.bride.fatherName", 120],
  ["wedding", "content.bride.motherName", 120],
  ["wedding", "content.groom.childOrder", 160],
  ["wedding", "content.story.0.title", 120],
  ["wedding", "content.story.0.date", 60],
  ["wedding", "content.story.0.narrative", 2000],
  ["wedding", "content.greetingOpen", 1000],
  ["wedding", "content.greetingClose", 1000],
  ["wedding", "content.envelope.banks.0.bank", 60],
  ["wedding", "content.envelope.banks.0.number", 40],
  ["wedding", "content.envelope.banks.0.holder", 120],
  ["wedding", "content.envelope.ewallets.0.provider", 40],
  ["wedding", "content.envelope.ewallets.0.number", 40],
  ["wedding", "content.envelope.giftAddress", 300],
  ["wedding", "content.envelope.ewallets.0.holder", 120],
  ["wedding", "content.quote.text", 500],
  ["wedding", "content.quote.source", 120],
  ["corporate", "content.eventName", 160],
  ["corporate", "content.organizer", 160],
  ["corporate", "content.description", 2000],
  ["corporate", "content.pic.name", 120],
  ["corporate", "content.pic.phone", 40],
  ["corporate", "content.agenda.0.narrative", 2000],
  ["family", "content.eventName", 160],
  ["family", "content.celebrant", 120],
  ["family", "content.parents", 200],
  ["family", "content.wishes.0.narrative", 2000],
];

const DAFTAR: [Cat, string, number, unknown][] = [
  ["wedding", "content.story", 20, STORY],
  ["corporate", "content.agenda", 30, STORY],
  ["family", "content.wishes", 20, STORY],
  ["wedding", "content.envelope.banks", 6, BANK],
  ["wedding", "content.envelope.ewallets", 6, EWALLET],
];

function draftWith(cat: Cat, path: string, value: unknown) {
  const p = draftBase(cat);
  setAt(p, path, value);
  return saveDraftSchema.safeParse(p);
}

function strictWith(cat: Cat, path: string, value: unknown) {
  const { schema, base } = STRICT[cat];
  const c = base();
  setAt(c, path.replace(/^content\./, ""), value);
  return schema.safeParse(c);
}

const issuePath = (r: {
  success: boolean;
  error?: { issues: { path: PropertyKey[] }[] };
}) =>
  r.success ? [] : r.error!.issues.map((i) => i.path.map(String).join("."));

describe("batas panjang teks: tepat N diterima, N+1 ditolak di path yang sama", () => {
  it.each(TEKS)("%s %s ≤ %i (draft/autosave)", (cat, path, n) => {
    expect(draftWith(cat, path, "a".repeat(n)).success).toBe(true);
    expect(issuePath(draftWith(cat, path, "a".repeat(n + 1)))).toEqual([path]);
  });

  it.each(TEKS)("%s %s ≤ %i (strict/render)", (cat, path, n) => {
    expect(strictWith(cat, path, "a".repeat(n)).success).toBe(true);
    const rel = path.replace(/^content\./, "");
    expect(issuePath(strictWith(cat, path, "a".repeat(n + 1)))).toEqual([rel]);
  });
});

// Isian berformat: skema strict menolak "aaa…" sebagai URL/email, jadi nilai
// uji dibangkitkan SAH sepanjang tepat N (lalu N+1) agar yang teruji memang batasnya.
const FORMAT: [Cat, string, number, (n: number) => string][] = [
  [
    "wedding",
    "content.youtubeUrl",
    200,
    (n) => "https://youtu.be/" + "a".repeat(n - 17),
  ],
  [
    "wedding",
    "content.livestreamUrl",
    500,
    (n) => "https://x.id/" + "a".repeat(n - 13),
  ],
  [
    "corporate",
    "content.pic.email",
    160,
    (n) => "a".repeat(n - 8) + "@mail.id",
  ],
];

describe("batas isian berformat (URL/email) di draft maupun strict", () => {
  it.each(FORMAT)("%s %s ≤ %i", (cat, path, n, gen) => {
    expect(gen(n)).toHaveLength(n);
    expect(draftWith(cat, path, gen(n)).success).toBe(true);
    expect(issuePath(draftWith(cat, path, gen(n + 1)))).toEqual([path]);
    expect(strictWith(cat, path, gen(n)).success).toBe(true);
    const rel = path.replace(/^content\./, "");
    expect(issuePath(strictWith(cat, path, gen(n + 1)))).toEqual([rel]);
  });
});

describe("batas jumlah entri daftar", () => {
  it.each(DAFTAR)("%s %s ≤ %i entri", (cat, path, n, item) => {
    const isi = (k: number) => Array.from({ length: k }, () => clone(item));
    expect(draftWith(cat, path, isi(n)).success).toBe(true);
    expect(draftWith(cat, path, isi(n + 1)).success).toBe(false);
    expect(strictWith(cat, path, isi(n)).success).toBe(true);
    expect(strictWith(cat, path, isi(n + 1)).success).toBe(false);
  });

  it("sesi jadwal ≤ 10 (draft) dan tiap nama sesi ≤ 80", () => {
    const sesi = (k: number) => Array.from({ length: k }, () => clone(EVENT));
    expect(draftWith("wedding", "events", sesi(10)).success).toBe(true);
    expect(draftWith("wedding", "events", sesi(11)).success).toBe(false);
    expect(draftWith("wedding", "events.0.name", "a".repeat(80)).success).toBe(
      true,
    );
    expect(
      issuePath(draftWith("wedding", "events.0.name", "a".repeat(81))),
    ).toEqual(["events.0.name"]);
    expect(
      eventInputSchema.safeParse({ ...EVENT, name: "a".repeat(81) }).success,
    ).toBe(false);
  });
});

describe("konstanta FIELD_LIMITS", () => {
  it("angkanya persis seperti yang dijanjikan (ubah = keputusan sadar, catat di DECISIONS)", () => {
    expect(FIELD_LIMITS).toEqual({
      person: {
        name: 120,
        nickname: 60,
        fatherName: 120,
        motherName: 120,
        childOrder: 160,
      },
      quote: { text: 500, source: 120 },
      bank: { bank: 60, number: 40, holder: 120 },
      ewallet: { provider: 40, number: 40, holder: 120 },
      envelope: { banks: 6, ewallets: 6, giftAddress: 300 },
      storyEntry: { title: 120, date: 60, narrative: 2000 },
      common: {
        greeting: 1000,
        youtubeUrl: 200,
        livestreamUrl: 500,
        customMusicName: 120,
      },
      wedding: { title: 160, story: 20 },
      corporate: {
        eventName: 160,
        organizer: 160,
        description: 2000,
        agenda: 30,
      },
      pic: { name: 120, phone: 40, email: 160 },
      family: { eventName: 160, celebrant: 120, parents: 200, wishes: 20 },
      event: {
        name: 80,
        venueName: 160,
        address: 400,
        mapsUrl: 500,
        sessions: 10,
      },
    });
  });
});

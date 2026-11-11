import {
  draftContentSchema,
  emptyContent,
  invitationContentSchema,
  type Envelope,
  type InvitationContent,
  type LoveStoryEntry,
  type Person,
  type Photo,
  type Quote,
  type StoryEntry,
} from "@/lib/validation/content";
import type { InvitationCategory } from "@/types";

/**
 * Parse `invitations.content` menjadi bentuk RENDERABLE untuk tema (pure, tanpa
 * I/O → mudah diuji). Karena preview bisa merender DRAFT belum lengkap: coba
 * strict; bila gagal, longgarkan lalu isi field wajib dengan placeholder aman
 * (tema tetap membaca defensif). Fallback: kerangka kosong yang valid.
 */

// `photo` bukan string lagi (THEME-CONTRACT §3) — ia `{ path, x, y, zoom }`,
// jadi tak bisa ikut peta string di atasnya.
type RawPerson =
  | (Partial<Record<Exclude<keyof Person, "photo">, string>> & {
      photo?: Person["photo"];
    })
  | undefined;

function coercePerson(p: RawPerson): Person {
  return {
    name: (p?.name ?? p?.nickname ?? "").toString(),
    nickname: p?.nickname,
    fatherName: p?.fatherName,
    motherName: p?.motherName,
    childOrder: p?.childOrder,
    photo: p?.photo,
  };
}

function coerceStories(arr: unknown): StoryEntry[] {
  if (!Array.isArray(arr)) return [];
  return arr.flatMap((s) =>
    s && s.title && s.narrative
      ? [
          {
            title: String(s.title),
            date: s.date ? String(s.date) : undefined,
            narrative: String(s.narrative),
          },
        ]
      : [],
  );
}

/**
 * Love story (wedding) — sama dengan `coerceStories`, plus foto opsional
 * (#127). `photo` sudah divalidasi skema draft (`loveStoryDraftSchema`), jadi
 * cukup diteruskan; tanpa ini foto cerita draft yang belum lengkap hilang dari
 * pratinjau.
 */
/**
 * Entri cerita yang DIRENDER tema: judul DAN narasi terisi (sesudah trim).
 * Satu aturan untuk jalur render draft (`coerceLoveStories`) dan bingkai foto
 * cerita di editor (#127) — keduanya harus sepakat soal indeks entri.
 */
export function ceritaTampil(
  s: { title?: string | null; narrative?: string | null } | null | undefined,
): boolean {
  return Boolean(s?.title?.trim() && s?.narrative?.trim());
}

function coerceLoveStories(
  arr: ReadonlyArray<{
    title?: string;
    date?: string;
    narrative?: string;
    photo?: Photo;
  }>,
): LoveStoryEntry[] {
  return arr.flatMap((s) =>
    s.title && s.narrative && ceritaTampil(s)
      ? [
          {
            title: s.title,
            date: s.date || undefined,
            narrative: s.narrative,
            ...(s.photo ? { photo: s.photo } : {}),
          },
        ]
      : [],
  );
}

function coerceQuote(q: unknown): Quote | undefined {
  const obj = q as { text?: string; source?: string } | undefined;
  if (!obj?.text) return undefined;
  return { text: obj.text, source: obj.source };
}

function coerceEnvelope(e: unknown): Envelope {
  const env = e as
    | {
        enabled?: boolean;
        banks?: { bank?: string; number?: string; holder?: string }[];
        ewallets?: { provider?: string; number?: string; holder?: string }[];
        giftAddress?: string;
      }
    | undefined;
  if (!env) return { enabled: false, banks: [], ewallets: [] };
  return {
    enabled: Boolean(env.enabled),
    banks: (env.banks ?? []).flatMap((b) =>
      b?.bank && b?.number && b?.holder
        ? [{ bank: b.bank, number: b.number, holder: b.holder }]
        : [],
    ),
    ewallets: (env.ewallets ?? []).flatMap((w) =>
      w?.provider && w?.number
        ? [{ provider: w.provider, number: w.number, holder: w.holder }]
        : [],
    ),
    giftAddress: env.giftAddress,
  };
}

export function parseContentForRender(
  raw: unknown,
  category: InvitationCategory,
): InvitationContent {
  const strict = invitationContentSchema.safeParse(raw);
  if (strict.success) return strict.data;

  const draft = draftContentSchema.safeParse(raw);
  if (!draft.success) return emptyContent(category);
  const d = draft.data;

  // Field display bersama (greeting/quote/media/video/amplop) sama di semua kategori.
  const common = {
    coverPhoto: d.coverPhoto,
    greetingOpen: d.greetingOpen,
    greetingClose: d.greetingClose,
    quote: coerceQuote(d.quote),
    youtubeUrl: d.youtubeUrl,
    video: d.video,
    customMusic: d.customMusic,
    livestreamUrl: d.livestreamUrl,
    envelope: coerceEnvelope(d.envelope),
  };

  if (d.category === "wedding") {
    return {
      category: "wedding",
      title: d.title,
      groom: coercePerson(d.groom as RawPerson),
      bride: coercePerson(d.bride as RawPerson),
      story: coerceLoveStories(d.story),
      ...common,
    };
  }

  if (d.category === "corporate") {
    return {
      category: "corporate",
      eventName: d.eventName ?? "",
      organizer: d.organizer,
      description: d.description,
      logo: d.logo,
      pic: d.pic,
      agenda: coerceStories(d.agenda),
      ...common,
    };
  }

  return {
    category: "family",
    eventName: d.eventName ?? "",
    celebrant: d.celebrant,
    parents: d.parents,
    wishes: coerceStories(d.wishes),
    ...common,
  };
}

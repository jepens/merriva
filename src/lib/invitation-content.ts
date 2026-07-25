import {
  draftContentSchema,
  emptyContent,
  invitationContentSchema,
  type Envelope,
  type InvitationContent,
  type Person,
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

type RawPerson = Partial<Record<keyof Person, string>> | undefined;

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

  if (d.category === "wedding") {
    return {
      category: "wedding",
      title: d.title,
      groom: coercePerson(d.groom as RawPerson),
      bride: coercePerson(d.bride as RawPerson),
      story: coerceStories(d.story),
      coverPhoto: d.coverPhoto,
      greetingOpen: d.greetingOpen,
      greetingClose: d.greetingClose,
      quote: coerceQuote(d.quote),
      youtubeUrl: d.youtubeUrl,
      livestreamUrl: d.livestreamUrl,
      envelope: coerceEnvelope(d.envelope),
    };
  }
  // Corporate/Family belum punya editor di M1 → kerangka kosong yang valid.
  return emptyContent(category);
}

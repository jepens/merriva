import type { InvitationCategory } from "@/types";

import {
  type CorporateContent,
  type FamilyContent,
  type InvitationContent,
  type WeddingContent,
} from "./categories";
import { draftContentSchema, type DraftContent } from "./draft";
import type { Envelope } from "./shared";

export * from "./shared";
export * from "./categories";
export * from "./settings";
export * from "./event";
export * from "./draft";

/** Amplop kosong baru (referensi array segar tiap panggilan). */
function freshEnvelope(): Envelope {
  return { enabled: false, banks: [], ewallets: [] };
}

/**
 * Konten awal untuk draft baru per kategori. Field wajib diisi string kosong
 * (belum valid untuk aktivasi, tapi sah sebagai draft) — validasi penuh
 * dijalankan saat preview/aktivasi.
 */
export function emptyContent(category: InvitationCategory): InvitationContent {
  switch (category) {
    case "wedding": {
      const c: WeddingContent = {
        category: "wedding",
        groom: { name: "" },
        bride: { name: "" },
        story: [],
        envelope: freshEnvelope(),
      };
      return c;
    }
    case "corporate": {
      const c: CorporateContent = {
        category: "corporate",
        eventName: "",
        agenda: [],
        envelope: freshEnvelope(),
      };
      return c;
    }
    case "family": {
      const c: FamilyContent = {
        category: "family",
        eventName: "",
        wishes: [],
        envelope: freshEnvelope(),
      };
      return c;
    }
    default: {
      const exhaustive: never = category;
      return exhaustive;
    }
  }
}

/**
 * Konten yang dimuat ke editor dari baris `invitations.content`.
 *
 * Isi tersimpan yang TIDAK lolos skema draft — mis. narasi yang melebihi batas
 * yang kelak diturunkan — dulu diganti konten KOSONG, lalu autosave pertama
 * menimpa isi asli di database tanpa jejak (DECISIONS #41). Kini isi apa adanya
 * dibiarkan tampil: server menolak isian yang melanggar dengan pesan per isian,
 * pemilik memperbaikinya, dan tak ada yang hilang. Hanya isi yang bukan objek
 * atau berkategori lain (baris rusak) yang jatuh ke konten kosong.
 */
export function editableContent(
  raw: unknown,
  category: InvitationCategory,
): DraftContent {
  const parsed = draftContentSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const sameCategory =
    typeof raw === "object" &&
    raw !== null &&
    (raw as { category?: unknown }).category === category;
  return sameCategory
    ? (raw as DraftContent)
    : draftContentSchema.parse(emptyContent(category));
}

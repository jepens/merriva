import type { InvitationCategory } from "@/types";

import {
  type CorporateContent,
  type FamilyContent,
  type InvitationContent,
  type WeddingContent,
} from "./categories";
import type { Envelope } from "./shared";

export * from "./shared";
export * from "./categories";
export * from "./settings";
export * from "./event";

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

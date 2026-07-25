import type {
  EventDraft,
  InvitationSettings,
  WeddingDraft,
} from "@/lib/validation/content";

/** Nilai form editor undangan pernikahan (tipe draft: field boleh belum lengkap). */
export type WeddingEditorValues = {
  eventDate: string;
  content: WeddingDraft;
  settings: InvitationSettings;
  events: EventDraft[];
};

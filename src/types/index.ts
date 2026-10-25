/**
 * Literal type domain bersama, selaras dengan enum di DATA-MODEL.md.
 * Tipe struktur konten per kategori (Zod-inferred) ada di `lib/validation/content`.
 */

export type ProfileRole = "client" | "admin" | "pro";

export type ThemeTier = "standard" | "premium";

export type InvitationCategory = "wedding" | "corporate" | "family";

export type InvitationStatus =
  "draft" | "pending_payment" | "active" | "expired" | "suspended";

export type OrderStatus =
  "pending" | "paid" | "expired" | "failed" | "refunded";

export type RsvpAttendance = "yes" | "no";

export type GiftNoteType = "transfer" | "gift";

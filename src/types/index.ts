/**
 * Literal type domain bersama, selaras dengan enum di DATA-MODEL.md.
 * Tipe struktur konten per kategori (Zod-inferred) menyusul di M1.
 */

export type ProfileRole = "client" | "admin";

export type ThemeTier = "standard" | "premium";

export type InvitationCategory = "wedding" | "corporate" | "family";

export type InvitationStatus =
  "draft" | "pending_payment" | "active" | "expired" | "suspended";

export type OrderStatus =
  "pending" | "paid" | "expired" | "failed" | "refunded";

export type RsvpAttendance = "yes" | "no";

export type GiftNoteType = "transfer" | "gift";

import { z } from "zod";

/**
 * Skema RSVP + ucapan (SPEC §4.6) — satu form gabungan. Divalidasi ulang di
 * server (`submitRsvpAction`). `website` = honeypot (harus kosong; diperiksa di
 * action, bukan sebagai error field). Batas `pax` sebenarnya (alokasi tamu /
 * maks 2 tanpa token) ditegakkan di server, bukan di skema.
 */

export const RSVP_ATTENDANCE = ["yes", "no"] as const;
export type RsvpAttendance = (typeof RSVP_ATTENDANCE)[number];

const emptyToUndef = (v: unknown) =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;

export const rsvpSchema = z.object({
  slug: z.string().trim().min(1).max(80),
  guestName: z
    .string()
    .trim()
    .min(1, "Nama tidak boleh kosong")
    .max(80, "Nama terlalu panjang"),
  attendance: z.enum(RSVP_ATTENDANCE, { message: "Pilih kehadiran" }),
  pax: z.coerce
    .number()
    .int()
    .min(0, "Jumlah tamu tidak valid")
    .max(20, "Jumlah tamu terlalu banyak"),
  message: z.preprocess(
    emptyToUndef,
    z.string().max(500, "Ucapan maksimal 500 karakter").optional(),
  ),
  guestToken: z.preprocess(emptyToUndef, z.string().max(64).optional()),
  turnstileToken: z.preprocess(emptyToUndef, z.string().max(4000).optional()),
  /** Honeypot — biarkan lolos skema; action men-drop diam-diam bila terisi. */
  website: z.preprocess(emptyToUndef, z.string().max(200).optional()),
});

export type RsvpInput = z.input<typeof rsvpSchema>;
export type RsvpParsed = z.infer<typeof rsvpSchema>;

/** Satu entri dinding ucapan yang aman ditampilkan publik (nama + pesan saja). */
export interface GuestbookEntry {
  id: string;
  name: string;
  message: string;
  createdAt: string;
}

/* --------------------------------- Amplop -------------------------------- */

export const GIFT_NOTE_TYPE = ["transfer", "gift"] as const;
export type GiftNoteType = (typeof GIFT_NOTE_TYPE)[number];

/** Nominal amplop = integer IDR (tanpa float). Buang semua non-digit ("Rp
 * 100.000" / "100,000" → 100000); string kosong → undefined (opsional). */
const idrDigits = (v: unknown) => {
  if (typeof v === "number")
    return Number.isFinite(v) ? Math.trunc(v) : undefined;
  if (typeof v !== "string") return undefined;
  const digits = v.replace(/\D/g, "");
  return digits === "" ? undefined : Number(digits);
};

/**
 * Skema konfirmasi amplop/kado (SPEC §4.6) — **privat** untuk pemilik. Divalidasi
 * ulang di server (`submitGiftNoteAction`). `website` = honeypot. Nominal opsional,
 * dibatasi 1 miliar agar tak menampung angka absurd. Data ini TIDAK pernah
 * diserve ke publik.
 */
export const giftNoteSchema = z.object({
  slug: z.string().trim().min(1).max(80),
  guestName: z
    .string()
    .trim()
    .min(1, "Nama tidak boleh kosong")
    .max(80, "Nama terlalu panjang"),
  type: z.enum(GIFT_NOTE_TYPE, { message: "Pilih jenis" }),
  amount: z.preprocess(
    idrDigits,
    z
      .number()
      .int()
      .min(0)
      .max(1_000_000_000, "Nominal terlalu besar")
      .optional(),
  ),
  note: z.preprocess(
    emptyToUndef,
    z.string().max(300, "Pesan maksimal 300 karakter").optional(),
  ),
  guestToken: z.preprocess(emptyToUndef, z.string().max(64).optional()),
  turnstileToken: z.preprocess(emptyToUndef, z.string().max(4000).optional()),
  /** Honeypot — biarkan lolos skema; action men-drop diam-diam bila terisi. */
  website: z.preprocess(emptyToUndef, z.string().max(200).optional()),
});

export type GiftNoteInput = z.input<typeof giftNoteSchema>;
export type GiftNoteParsed = z.infer<typeof giftNoteSchema>;

/* ------------------------------- Moderasi -------------------------------- */

/**
 * Patch moderasi RSVP oleh pemilik (SPEC §4.6). Hanya `is_hidden` / `is_approved`
 * yang boleh diubah (selaras grant kolom DB); minimal satu field harus ada.
 * Data kiriman tamu (nama/kehadiran/pax/pesan) tidak pernah bisa ditulis ulang.
 */
export const rsvpModerationSchema = z
  .object({
    isHidden: z.boolean().optional(),
    isApproved: z.boolean().optional(),
  })
  .refine((v) => v.isHidden !== undefined || v.isApproved !== undefined, {
    message: "Tidak ada perubahan",
  });

export type RsvpModerationInput = z.infer<typeof rsvpModerationSchema>;

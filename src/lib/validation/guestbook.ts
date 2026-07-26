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

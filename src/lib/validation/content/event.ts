import { z } from "zod";

import { httpsUrlSchema } from "./shared";
import { FIELD_LIMITS as L } from "./field-limits";

/**
 * Input satu sesi acara → baris `invitation_events` (SPEC §4.4 step 3;
 * DATA-MODEL §1, ternormalisasi karena menjadi fondasi check-in Fase 2).
 *
 * `startAt`/`endAt` diterima sebagai string waktu-lokal (mis. `2026-08-15T10:00`);
 * konversi ke UTC memakai `settings.timezone` dilakukan di server action (M1.3).
 * Validasi di sini hanya memastikan waktu bisa di-parse & urutan mulai ≤ selesai.
 */

const localDateTime = z
  .string()
  .trim()
  .min(1, "Tanggal & jam wajib diisi")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Tanggal & jam tidak valid");

// Tautan peta WAJIB https (hindari mixed-content di halaman undangan https;
// selaras livestreamUrl). Kosong/null → undefined (opsional).
const optionalUrl = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  httpsUrlSchema(
    L.event.mapsUrl,
    "Tautan peta harus URL https yang valid",
  ).optional(),
);

export const eventInputSchema = z
  .object({
    name: z.string().trim().min(1, "Nama sesi wajib diisi").max(L.event.name),
    startAt: localDateTime,
    endAt: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      localDateTime.optional(),
    ),
    venueName: z.string().trim().max(L.event.venueName).optional(),
    address: z.string().trim().max(L.event.address).optional(),
    mapsUrl: optionalUrl,
  })
  .refine((e) => !e.endAt || Date.parse(e.endAt) >= Date.parse(e.startAt), {
    message: "Waktu selesai tidak boleh sebelum waktu mulai",
    path: ["endAt"],
  });

/** Daftar sesi acara (minimal 1 saat aktivasi; kosong diperbolehkan saat draft). */
export const eventListSchema = z.array(eventInputSchema).max(L.event.sessions);

export type EventInput = z.infer<typeof eventInputSchema>;

/**
 * Skema sesi DRAFT (longgar) untuk autosave — semua field opsional & format
 * tidak dipaksa (pengguna masih mengetik). Server hanya menyimpan sesi yang
 * punya `startAt` valid; validasi penuh saat aktivasi memakai `eventInputSchema`.
 * `startAt`/`endAt` = waktu-lokal (`YYYY-MM-DDTHH:mm`) di `settings.timezone`.
 */
export const eventDraftSchema = z.object({
  name: z.string().trim().max(L.event.name).optional(),
  startAt: z.string().trim().max(40).optional(),
  endAt: z.string().trim().max(40).optional(),
  venueName: z.string().trim().max(L.event.venueName).optional(),
  address: z.string().trim().max(L.event.address).optional(),
  mapsUrl: z.string().trim().max(L.event.mapsUrl).optional(),
});

export const eventDraftListSchema = z
  .array(eventDraftSchema)
  .max(L.event.sessions)
  .default([]);

export type EventDraft = z.infer<typeof eventDraftSchema>;

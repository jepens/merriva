import { z } from "zod";

/**
 * Kode order publik `MRV-XXXXXX` (SPEC §4.8).
 *
 * Alfabet & panjangnya WAJIB sama dengan `CODE_ALPHABET`/`CODE_LEN` di
 * `src/lib/order.ts` — tanpa O, 0, I, dan 1 agar tak ambigu saat diketik ulang
 * dari kuitansi. Skema ini sengaja hanya penjaga BENTUK: pemanggil menormalkan
 * dulu (`trim().toUpperCase()`) supaya kode yang disalin pelanggan dari email
 * beserta spasinya tetap diterima, tanpa menggantungkan perilaku pada versi zod.
 */
export const ORDER_CODE_RE = /^MRV-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

export const orderCodeSchema = z.string().max(16).regex(ORDER_CODE_RE);

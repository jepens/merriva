"use server";

import { copy } from "@/lib/copy";
import { reportHandledError } from "@/lib/observability";
import { checkClientRateLimit, getClientIp } from "@/lib/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";
import { settingsSchema } from "@/lib/validation/content";
import {
  giftNoteSchema,
  rsvpSchema,
  type GiftNoteInput,
  type GuestbookEntry,
  type RsvpInput,
} from "@/lib/validation/guestbook";

/**
 * RSVP + ucapan + dinding (SPEC §4.6). INSERT `rsvps` TIDAK boleh dari anon
 * (RLS: tanpa policy anon) → dilakukan via **service-role** SETELAH: honeypot →
 * rate limit per-IP → Turnstile → cek undangan AKTIF. Baca dinding juga via
 * service-role dengan filter eksplisit: hanya `is_approved && !is_hidden` +
 * ada pesan; HANYA nama+pesan (tak pernah attendance/pax/gift/kontak).
 * UI moderasi (sembunyikan/setujui) & konfirmasi amplop: halaman `/ucapan`.
 */

const RSVP_LIMIT = { max: 5, windowMs: 60_000 };
const GIFT_LIMIT = { max: 5, windowMs: 60_000 };
/**
 * Baca dinding: di-scope PER UNDANGAN dan dilonggarkan (AUDIT-2026-09-04 PER-3).
 * Nilai lama 40/menit per-/24 tanpa cakupan berarti di WiFi venue dinding ucapan
 * mengembalikan DAFTAR KOSONG secara diam-diam setelah 40 pemuatan — tamu ke-41
 * menyimpulkan belum ada yang menulis ucapan. 300 tamu x ~2 pemuatan harus muat.
 */
const READ_LIMIT = { max: 600, windowMs: 60_000 };
const PAGE_SIZE = 8;

export type RsvpResult =
  | { status: "success"; moderated: boolean }
  | {
      status: "error";
      reason?: "rate" | "captcha" | "invalid" | "closed";
      message?: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export async function submitRsvpAction(input: RsvpInput): Promise<RsvpResult> {
  const parsed = rsvpSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      reason: "invalid",
      message: copy.guestbook.form.invalid,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;

  // Honeypot: field tersembunyi terisi = bot → pura-pura sukses (silent drop).
  if (d.website) return { status: "success", moderated: false };

  // Rate limit per IP (ter-hash; tak menyimpan IP mentah).
  const rl = await checkClientRateLimit("rsvp", RSVP_LIMIT);
  if (!rl.ok) {
    return {
      status: "error",
      reason: "rate",
      message: copy.guestbook.form.rateLimited,
    };
  }

  // Turnstile (dilewati bila secret belum diset — hanya dev).
  const passed = await verifyTurnstile(d.turnstileToken, await getClientIp());
  if (!passed) {
    return {
      status: "error",
      reason: "captcha",
      message: copy.guestbook.form.captchaFailed,
    };
  }

  const admin = createSupabaseAdminClient();

  // RSVP hanya untuk undangan AKTIF.
  const { data: inv, error: invError } = await admin
    .from("invitations")
    .select("id, settings, status")
    .eq("slug", d.slug)
    .maybeSingle();
  // Galat DB ≠ "undangan tidak menerima konfirmasi" (DECISIONS #46): pesan
  // `closed` terdengar permanen, jadi tamu tak mencoba lagi dan RSVP-nya hilang.
  if (invError) {
    reportHandledError(invError, "rsvp.invitation", { slug: d.slug });
    return { status: "error", message: copy.common.error };
  }
  if (!inv || inv.status !== "active") {
    return {
      status: "error",
      reason: "closed",
      message: copy.guestbook.form.closed,
    };
  }

  // Fail-safe: bila settings gagal parse (mustahil via app, tapi defensif),
  // anggap MODERASI aktif → jangan auto-publish saat ragu.
  const moderated =
    settingsSchema.safeParse(inv.settings).data?.moderateGuestbook ?? true;

  // Tamu bertoken (opsional): kap pax = alokasi; tanpa token maks 2.
  let guestId: string | null = null;
  let paxCap = 2;
  if (d.guestToken) {
    const { data: guest, error: guestError } = await admin
      .from("guests")
      .select("id, pax_allocated")
      .eq("invitation_id", inv.id)
      .eq("token", d.guestToken)
      .maybeSingle();
    // Gagal mencari tamu → JANGAN menyimpan RSVP tak tertaut lalu melapor
    // sukses (DECISIONS #46): dulu pax dipotong ke 2, ekspor menandainya "belum
    // RSVP", dan kiriman ulang bertoken membuat baris KEDUA (unique index
    // parsial hanya berlaku saat guest_id tak null) sehingga total pax ganda.
    if (guestError) {
      reportHandledError(guestError, "rsvp.guest", { slug: d.slug });
      return { status: "error", message: copy.common.error };
    }
    if (guest) {
      guestId = guest.id;
      paxCap = guest.pax_allocated;
    }
  }
  const pax = d.attendance === "yes" ? Math.min(Math.max(d.pax, 1), paxCap) : 0;

  const row = {
    invitation_id: inv.id,
    guest_id: guestId,
    guest_name: d.guestName,
    attendance: d.attendance,
    pax,
    message: d.message ?? null,
    is_approved: !moderated,
  };

  // Tamu bertoken: kiriman ulang = UPDATE (unique partial index). Coba INSERT;
  // bila tabrakan (23505) → UPDATE baris yang ada. Tanpa token: selalu INSERT.
  const { error } = await admin.from("rsvps").insert(row);
  if (error) {
    if (guestId && error.code === "23505") {
      const { error: upErr } = await admin
        .from("rsvps")
        .update({
          guest_name: row.guest_name,
          attendance: row.attendance,
          pax: row.pax,
          message: row.message,
          is_approved: row.is_approved,
          updated_at: new Date().toISOString(),
        })
        .eq("invitation_id", inv.id)
        .eq("guest_id", guestId);
      if (upErr) return { status: "error", message: copy.common.error };
    } else {
      return { status: "error", message: copy.common.error };
    }
  }

  return { status: "success", moderated };
}

export type GiftNoteResult =
  | { status: "success" }
  | {
      status: "error";
      reason?: "rate" | "captcha" | "invalid" | "closed";
      message?: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

/**
 * Konfirmasi amplop/kado (SPEC §4.6) — **privat** untuk pemilik. Sama seperti
 * RSVP: INSERT `gift_notes` tak boleh dari anon (RLS tanpa policy anon) → via
 * **service-role** SETELAH honeypot → rate limit → Turnstile → cek undangan
 * AKTIF. Data ini TIDAK pernah diserve ke publik (hanya dashboard pemilik).
 */
export async function submitGiftNoteAction(
  input: GiftNoteInput,
): Promise<GiftNoteResult> {
  const parsed = giftNoteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      reason: "invalid",
      message: copy.guestbook.gift.invalid,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;

  // Honeypot: field tersembunyi terisi = bot → pura-pura sukses (silent drop).
  if (d.website) return { status: "success" };

  const rl = await checkClientRateLimit("gift", GIFT_LIMIT);
  if (!rl.ok) {
    return {
      status: "error",
      reason: "rate",
      message: copy.guestbook.form.rateLimited,
    };
  }

  const passed = await verifyTurnstile(d.turnstileToken, await getClientIp());
  if (!passed) {
    return {
      status: "error",
      reason: "captcha",
      message: copy.guestbook.form.captchaFailed,
    };
  }

  const admin = createSupabaseAdminClient();

  const { data: inv, error: invError } = await admin
    .from("invitations")
    .select("id, status")
    .eq("slug", d.slug)
    .maybeSingle();
  // Sama seperti RSVP (#46): galat DB bukan "tidak menerima konfirmasi".
  if (invError) {
    reportHandledError(invError, "gift.invitation", { slug: d.slug });
    return { status: "error", message: copy.common.error };
  }
  if (!inv || inv.status !== "active") {
    return {
      status: "error",
      reason: "closed",
      message: copy.guestbook.form.closed,
    };
  }

  // Tamu bertoken (opsional): pakai nama terdaftar bila cocok — jika tidak,
  // nama dari form. `gift_notes` tak menyimpan guest_id (privasi minimal).
  let guestName = d.guestName;
  if (d.guestToken) {
    const { data: guest, error: guestError } = await admin
      .from("guests")
      .select("name")
      .eq("invitation_id", inv.id)
      .eq("token", d.guestToken)
      .maybeSingle();
    // Catatan amplop tetap disimpan dengan nama dari form — tak ada data yang
    // salah tertaut (tabel ini tanpa guest_id), jadi kegagalan cukup dilaporkan.
    if (guestError) {
      reportHandledError(guestError, "gift.guest", { slug: d.slug });
    }
    if (guest?.name) guestName = guest.name;
  }

  const { error } = await admin.from("gift_notes").insert({
    invitation_id: inv.id,
    guest_name: guestName,
    type: d.type,
    amount: d.amount ?? null,
    note: d.note ?? null,
  });
  if (error) return { status: "error", message: copy.common.error };

  return { status: "success" };
}

export interface GuestbookPage {
  entries: GuestbookEntry[];
  hasMore: boolean;
  /**
   * Benar bila permintaan ditolak rate limit — BUKAN berarti dinding kosong.
   * UI wajib membedakan keduanya: "belum ada ucapan" vs "gagal memuat, coba
   * lagi". Tanpa penanda ini kegagalan tampak sebagai fakta (PER-3).
   */
  rateLimited?: boolean;
  /**
   * Benar bila bacaan GAGAL (galat DB) — juga BUKAN dinding kosong
   * (DECISIONS #46). Dulu ditelan menjadi daftar kosong: tamu membaca "Belum
   * ada ucapan" padahal ada puluhan, dan tombol "Muat lebih" hilang diam-diam.
   */
  failed?: boolean;
}

/**
 * Baca dinding ucapan publik (nama + pesan yang disetujui & tak disembunyikan).
 * Rate limit ringan agar tak diseret berlebihan. Tak pernah mengembalikan field
 * sensitif.
 */
export async function getGuestbookAction(
  slug: string,
  page = 0,
): Promise<GuestbookPage> {
  const p = Number.isInteger(page) && page >= 0 ? page : 0;
  const cleanSlug = typeof slug === "string" ? slug.trim().toLowerCase() : "";
  if (!cleanSlug) return { entries: [], hasMore: false };

  // Kunci di-scope ke undangan → satu resepsi ramai tak menghabiskan jatah
  // acara lain yang kebetulan sejaringan.
  const rl = await checkClientRateLimit("gb-read", READ_LIMIT, cleanSlug);
  if (!rl.ok) return { entries: [], hasMore: false, rateLimited: true };

  const admin = createSupabaseAdminClient();
  const { data: inv, error: invError } = await admin
    .from("invitations")
    .select("id, status")
    .eq("slug", cleanSlug)
    .maybeSingle();
  if (invError) {
    reportHandledError(invError, "guestbook.invitation", { slug: cleanSlug });
    return { entries: [], hasMore: false, failed: true };
  }
  if (!inv || inv.status !== "active") return { entries: [], hasMore: false };

  const from = p * PAGE_SIZE;
  const { data, error: rowsError } = await admin
    .from("rsvps")
    .select("id, guest_name, message, created_at")
    .eq("invitation_id", inv.id)
    .eq("is_approved", true)
    .eq("is_hidden", false)
    .not("message", "is", null)
    .neq("message", "")
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE); // ambil 1 lebih untuk deteksi hasMore

  if (rowsError) {
    reportHandledError(rowsError, "guestbook.rsvps", { slug: cleanSlug });
    return { entries: [], hasMore: false, failed: true };
  }

  const rows = data ?? [];
  const hasMore = rows.length > PAGE_SIZE;
  const entries: GuestbookEntry[] = rows.slice(0, PAGE_SIZE).map((r) => ({
    id: r.id,
    name: r.guest_name,
    message: r.message ?? "",
    createdAt: r.created_at,
  }));
  return { entries, hasMore };
}

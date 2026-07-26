"use server";

import { revalidatePath } from "next/cache";

import { copy } from "@/lib/copy";
import { isUuid, randomToken } from "@/lib/id";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  guestSchema,
  type GuestInput,
  type GuestView,
} from "@/lib/validation/guest";
import type { Database } from "@/types/database";

type GuestRow = Database["public"]["Tables"]["guests"]["Row"];

/** Batas aman satu batch impor (jauh di atas 500 target SPEC). */
const MAX_IMPORT = 2000;

function toView(r: GuestRow): GuestView {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    groupLabel: r.group_label,
    paxAllocated: r.pax_allocated,
    notes: r.notes,
    token: r.token,
    waClickedAt: r.wa_clicked_at,
    firstViewedAt: r.first_viewed_at,
  };
}

export type ImportGuestsResult =
  | {
      status: "success";
      inserted: number;
      skippedLimit: number;
      guests: GuestView[];
    }
  | { status: "error"; reason?: "auth" | "invalid"; message?: string };

/**
 * Impor tamu massal (SPEC §4.7). Pola: auth → validasi ULANG tiap baris (jangan
 * percaya klien) → token dibuat server-side → RPC `insert_guests_bulk` (1 lock +
 * 1 cek limit untuk seluruh batch) → revalidate. Baris di luar kuota dilewati DB;
 * `skippedLimit` = valid dikirim − tersisip. Tabrakan token (23505) → ulang 1×.
 */
export async function importGuestsAction(
  invitationId: string,
  inputs: GuestInput[],
): Promise<ImportGuestsResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      status: "error",
      reason: "auth",
      message: copy.auth.genericAuthError,
    };
  if (!isUuid(invitationId)) return { status: "error", reason: "invalid" };
  if (!Array.isArray(inputs) || inputs.length === 0)
    return { status: "error", reason: "invalid" };

  // Validasi ULANG di server; hanya baris valid yang diteruskan.
  const clean: {
    name: string;
    phone: string;
    group_label: string;
    pax: number;
    notes: string;
  }[] = [];
  for (const input of inputs.slice(0, MAX_IMPORT)) {
    const parsed = guestSchema.safeParse(input);
    if (!parsed.success) continue;
    const g = parsed.data;
    clean.push({
      name: g.name,
      phone: g.phone ?? "",
      group_label: g.groupLabel ?? "",
      pax: g.paxAllocated,
      notes: g.notes ?? "",
    });
  }
  if (clean.length === 0) return { status: "error", reason: "invalid" };

  let rows: GuestRow[] | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const payload = clean.map((c) => ({ ...c, token: randomToken(14) }));
    const { data, error } = await supabase.rpc("insert_guests_bulk", {
      inv_id: invitationId,
      guests: payload,
    });
    if (error) {
      if (error.code === "23505") continue; // tabrakan token → token baru
      return { status: "error", message: copy.common.error };
    }
    rows = (data as GuestRow[] | null) ?? [];
    break;
  }
  if (rows === null) return { status: "error", message: copy.common.error };

  // Set kosong bisa berarti bukan pemilik ATAU kuota sudah penuh sebelum impor.
  if (rows.length === 0) {
    const { data: own } = await supabase
      .from("invitations")
      .select("slug")
      .eq("id", invitationId)
      .maybeSingle();
    if (!own) return { status: "error", reason: "auth" };
  }

  revalidatePath(`/dashboard/undangan/${invitationId}/tamu`);
  return {
    status: "success",
    inserted: rows.length,
    skippedLimit: clean.length - rows.length,
    guests: rows.map(toView),
  };
}

export interface GuestExportRow {
  name: string;
  phone: string;
  groupLabel: string;
  paxAllocated: number;
  token: string;
  opened: boolean;
  /** "yes" | "no" | null (belum RSVP). */
  attendance: "yes" | "no" | null;
  rsvpPax: number | null;
  message: string;
}

export type ExportGuestsResult =
  | { status: "success"; rows: GuestExportRow[] }
  | { status: "error"; message?: string };

/**
 * Data ekspor tamu + status RSVP (SPEC §4.7). Auth → kepemilikan (RLS) → gabung
 * `guests` × `rsvps` (per `guest_id`). Klien membangun berkas .xlsx dari data ini
 * (write-excel-file, code-split). Nomor rekening/gift TIDAK termasuk.
 */
export async function getGuestsExportAction(
  invitationId: string,
): Promise<ExportGuestsResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: copy.auth.genericAuthError };
  if (!isUuid(invitationId)) return { status: "error" };

  const { data: inv } = await supabase
    .from("invitations")
    .select("id")
    .eq("id", invitationId)
    .maybeSingle();
  if (!inv) return { status: "error", message: copy.common.error };

  const [{ data: guestRows }, { data: rsvpRows }] = await Promise.all([
    supabase
      .from("guests")
      .select(
        "id, name, phone, group_label, pax_allocated, token, first_viewed_at",
      )
      .eq("invitation_id", inv.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("rsvps")
      .select("guest_id, attendance, pax, message")
      .eq("invitation_id", inv.id)
      .not("guest_id", "is", null),
  ]);

  const rsvpByGuest = new Map(
    (rsvpRows ?? [])
      .filter((r) => r.guest_id)
      .map((r) => [r.guest_id as string, r]),
  );

  const rows: GuestExportRow[] = (guestRows ?? []).map((g) => {
    const rsvp = rsvpByGuest.get(g.id);
    return {
      name: g.name,
      phone: g.phone ?? "",
      groupLabel: g.group_label ?? "",
      paxAllocated: g.pax_allocated,
      token: g.token,
      opened: g.first_viewed_at !== null,
      attendance: rsvp ? rsvp.attendance : null,
      rsvpPax: rsvp ? rsvp.pax : null,
      message: rsvp?.message ?? "",
    };
  });

  return { status: "success", rows };
}

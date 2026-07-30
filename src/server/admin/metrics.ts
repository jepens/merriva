import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { InvitationStatus } from "@/types";

/** Ringkasan metrik panel admin (SPEC §4.9). */
export interface AdminMetrics {
  newInvitations24h: number;
  newInvitations7d: number;
  totalInvitations: number;
  activeInvitations: number;
  /** Undangan yang pernah dibayar (active/expired/suspended). */
  convertedInvitations: number;
  /** convertedInvitations / totalInvitations, 0..1 (0 bila belum ada undangan). */
  conversionRate: number;
  /** Jumlah `orders.amount_idr` lunas pada bulan berjalan (zona WIB). Integer IDR. */
  revenueThisMonthIdr: number;
  paidOrdersThisMonth: number;
}

const WIB_OFFSET_MIN = 420; // Asia/Jakarta = UTC+7 (revenue "bulan berjalan" pakai batas WIB).
const CONVERTED_STATUSES: InvitationStatus[] = [
  "active",
  "expired",
  "suspended",
];

/** Awal bulan berjalan (wall-clock WIB) sebagai instant UTC ISO. */
function wibMonthStartIso(now: Date): string {
  const wib = new Date(now.getTime() + WIB_OFFSET_MIN * 60_000);
  const wallMs = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), 1, 0, 0, 0);
  return new Date(wallMs - WIB_OFFSET_MIN * 60_000).toISOString();
}

/**
 * Hitung metrik ringkasan lewat service_role (BYPASS RLS — halaman pemanggil
 * WAJIB sudah `requireAdmin()`). Count memakai `head:true` (tak mentransfer
 * baris); revenue menjumlah `amount_idr` order lunas bulan ini (terbatas skala
 * MVP — bisa dipindah ke RPC agregat bila volume besar).
 */
export async function getAdminMetrics(
  now: Date = new Date(),
): Promise<AdminMetrics> {
  const admin = createSupabaseAdminClient();
  const since24h = new Date(now.getTime() - 24 * 3_600_000).toISOString();
  const since7d = new Date(now.getTime() - 7 * 24 * 3_600_000).toISOString();
  const monthStart = wibMonthStartIso(now);

  const invCount = () =>
    admin.from("invitations").select("*", { count: "exact", head: true });

  const [total, active, converted, new24h, new7d, paid] = await Promise.all([
    invCount(),
    invCount().eq("status", "active"),
    invCount().in("status", CONVERTED_STATUSES),
    invCount().gte("created_at", since24h),
    invCount().gte("created_at", since7d),
    admin
      .from("orders")
      .select("amount_idr")
      .eq("status", "paid")
      .gte("paid_at", monthStart),
  ]);

  const totalInvitations = total.count ?? 0;
  const convertedInvitations = converted.count ?? 0;
  const paidRows = paid.data ?? [];

  return {
    newInvitations24h: new24h.count ?? 0,
    newInvitations7d: new7d.count ?? 0,
    totalInvitations,
    activeInvitations: active.count ?? 0,
    convertedInvitations,
    conversionRate:
      totalInvitations > 0 ? convertedInvitations / totalInvitations : 0,
    revenueThisMonthIdr: paidRows.reduce((sum, r) => sum + r.amount_idr, 0),
    paidOrdersThisMonth: paidRows.length,
  };
}

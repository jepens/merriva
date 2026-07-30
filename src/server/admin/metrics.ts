import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Ringkasan metrik panel admin (SPEC §4.9). */
export interface AdminMetrics {
  newInvitations24h: number;
  newInvitations7d: number;
  totalInvitations: number;
  activeInvitations: number;
  /** Undangan yang PERNAH dibayar/diaktifkan (`package_id` terisi & tak pernah dikosongkan). */
  convertedInvitations: number;
  /** convertedInvitations / totalInvitations, 0..1 (0 bila belum ada undangan). */
  conversionRate: number;
  /** Jumlah `orders.amount_idr` lunas pada bulan berjalan (zona WIB). Integer IDR. */
  revenueThisMonthIdr: number;
  paidOrdersThisMonth: number;
}

const WIB_OFFSET_MIN = 420; // Asia/Jakarta = UTC+7 (revenue "bulan berjalan" pakai batas WIB).

/** Awal bulan berjalan (wall-clock WIB) sebagai instant UTC ISO. */
function wibMonthStartIso(now: Date): string {
  const wib = new Date(now.getTime() + WIB_OFFSET_MIN * 60_000);
  const wallMs = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), 1, 0, 0, 0);
  return new Date(wallMs - WIB_OFFSET_MIN * 60_000).toISOString();
}

/**
 * Hitung metrik ringkasan lewat service_role (BYPASS RLS — halaman pemanggil
 * WAJIB sudah `requireAdmin()`). Count memakai `head:true` (tak mentransfer
 * baris). Revenue dijumlah DI DB (`admin_month_revenue`) → tak terkena batas
 * baris PostgREST. "Converted" = `package_id` terisi (di-set saat aktivasi &
 * tak pernah dikosongkan) → sinyal akurat "pernah dibayar" (bukan proksi status
 * yang bisa keliru bila undangan belum-dibayar di-`suspend`).
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

  const [total, active, converted, new24h, new7d, revenue] = await Promise.all([
    invCount(),
    invCount().eq("status", "active"),
    invCount().not("package_id", "is", null),
    invCount().gte("created_at", since24h),
    invCount().gte("created_at", since7d),
    admin.rpc("admin_month_revenue", { p_since: monthStart }),
  ]);

  const totalInvitations = total.count ?? 0;
  const convertedInvitations = converted.count ?? 0;
  const rev = revenue.data?.[0];

  return {
    newInvitations24h: new24h.count ?? 0,
    newInvitations7d: new7d.count ?? 0,
    totalInvitations,
    activeInvitations: active.count ?? 0,
    convertedInvitations,
    conversionRate:
      totalInvitations > 0 ? convertedInvitations / totalInvitations : 0,
    revenueThisMonthIdr: Number(rev?.total ?? 0),
    paidOrdersThisMonth: Number(rev?.cnt ?? 0),
  };
}

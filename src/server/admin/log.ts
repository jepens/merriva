import "server-only";

import { reportHandledError } from "@/lib/observability";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export interface AdminLogEntry {
  /** Verba mesin, mis. `invitation.suspend`, `order.activate_manual`. */
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  detail?: Json | null;
}

/**
 * Catat aksi admin ke `admin_logs` (audit imutabel — DATA-MODEL §1; RLS tanpa
 * UPDATE/DELETE). Ditulis lewat service_role (konsisten: semua mutasi admin
 * lewat server). **Best-effort**: kegagalan pencatatan TIDAK menggagalkan aksi
 * yang sudah berhasil (mutasi = efek utama; log = pendamping) — kegagalan
 * dilaporkan ke Sentry lewat `reportHandledError` DAN ke console. Dipanggil
 * SETELAH mutasi sukses, oleh Server Action yang sudah `requireAdmin()`.
 */
export async function logAdminAction(
  admin: AdminClient,
  adminId: string,
  entry: AdminLogEntry,
): Promise<void> {
  const { error } = await admin.from("admin_logs").insert({
    admin_id: adminId,
    action: entry.action,
    target_type: entry.targetType ?? null,
    target_id: entry.targetId ?? null,
    detail: entry.detail ?? null,
  });
  if (error) {
    // `admin_logs` imutabel (RLS tanpa UPDATE/DELETE), jadi baris yang gagal
    // ditulis hanya bisa dipulihkan MANUAL — dan itu menuntut tahu sasarannya,
    // karena itu `targetId` ikut. `entry.detail` TIDAK ikut: tipenya `Json`
    // bebas, jadi aksi admin berikutnya bisa menaruh apa saja di sana termasuk
    // email pengguna.
    //
    // `console.error` DIPERTAHANKAN di samping, bukan diganti: Sentry masih
    // no-op sampai `NEXT_PUBLIC_SENTRY_DSN` diisi (LAUNCH-CHECKLIST Fase 6),
    // jadi mengganti akan menghapus satu-satunya tujuan yang berfungsi hari ini.
    reportHandledError(error, "admin.log", {
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
    });
    console.error(
      `[admin-log] gagal mencatat "${entry.action}":`,
      error.message,
    );
  }
}

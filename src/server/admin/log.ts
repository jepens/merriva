import "server-only";

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
 * dicatat ke console agar terlihat di log server. Dipanggil SETELAH mutasi
 * sukses, oleh Server Action yang sudah `requireAdmin()`.
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
    console.error(
      `[admin-log] gagal mencatat "${entry.action}":`,
      error.message,
    );
  }
}

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { reportHandledError } from "@/lib/observability";
import { generateOrderCode } from "@/lib/order";
import type { Database } from "@/types/database";

const ORDER_CODE_RETRIES = 5;

/**
 * Aktifkan TANPA bayar untuk undangan milik akun Admin/Pro (DECISIONS #100).
 *
 * Pengganti langkah Pakasir di ketiga jalur checkout (aktivasi/perpanjangan,
 * upgrade, add-on Album Momen). RPC `activate_free_order` membuat order Rp0
 * bermetode `gratis` dan menjalankan `activate_paid_order` dalam SATU
 * transaksi, jadi hasilnya identik dengan aktivasi berbayar dan tak pernah
 * menyisakan order yatim. Pemilik & peran diperiksa ulang di RPC.
 *
 * Revalidasi `/dashboard` + halaman publik dilakukan DI SINI, satu tempat:
 * tanpa itu tamu tetap melihat versi lama (mis. watermark Basic setelah
 * upgrade) sampai ISR kedaluwarsa. Pemanggil cukup menambah path halamannya.
 *
 * `false` = gagal; sudah dilaporkan di sini.
 */
export async function aktifkanGratis(
  admin: SupabaseClient<Database>,
  input: {
    invitationId: string;
    packageId: string;
    purpose: "purchase" | "upgrade";
    actorId: string;
  },
): Promise<boolean> {
  for (let attempt = 0; attempt < ORDER_CODE_RETRIES; attempt += 1) {
    const { data, error } = await admin.rpc("activate_free_order", {
      p_invitation_id: input.invitationId,
      p_package_id: input.packageId,
      p_purpose: input.purpose,
      p_order_code: generateOrderCode(),
      p_actor_id: input.actorId,
    });
    if (error) {
      reportHandledError(error, "payment.gratis", {
        invitationId: input.invitationId,
      });
      return false;
    }
    const row = data?.[0];
    if (row?.result === "order_code_conflict") continue;
    if (row?.result !== "activated") {
      // `not_allowed` di sini berarti server action dan RPC berbeda pendapat
      // soal siapa yang bebas bayar — bug, bukan keadaan pengguna.
      reportHandledError(
        new Error(`activate_free_order: hasil ${row?.result ?? "kosong"}`),
        "payment.gratis.result",
        { invitationId: input.invitationId },
      );
      return false;
    }
    revalidatePath("/dashboard");
    if (row.slug) revalidatePath(`/${row.slug}`);
    return true;
  }
  return false;
}

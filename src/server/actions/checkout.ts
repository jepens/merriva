"use server";

import { revalidatePath } from "next/cache";

import { copy } from "@/lib/copy";
import { appUrl } from "@/lib/env";
import { isUuid } from "@/lib/id";
import { generateOrderCode } from "@/lib/order";
import { getPaymentGateway } from "@/lib/payment";
import { isDraftSlug } from "@/lib/slug";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { packageCodeSchema } from "@/lib/validation/checkout";

/**
 * Hasil checkout: URL Pakasir untuk di-redirect klien, atau error ter-lokalisasi.
 */
export type CheckoutState =
  { status: "redirect"; url: string } | { status: "error"; message?: string };

// Status undangan yang boleh memulai pembayaran: draft (aktivasi pertama),
// expired (perpanjangan), atau pending_payment (ulangi bayar). Bukan `active`
// (sudah dibayar) / `suspended` (masalah konten → tak bisa self-service).
const PAYABLE_STATUSES = new Set(["draft", "expired", "pending_payment"]);

const ORDER_CODE_RETRIES = 5;

/**
 * Buat order & payment link Pakasir (SPEC §4.8 Flow A langkah 6). Pola wajib:
 * **auth → cek kepemilikan → validasi → operasi (service_role) → revalidate**.
 *
 * KEAMANAN: order & transisi lifecycle undangan HANYA lewat service_role — RLS
 * `orders_admin_insert` + kolom lifecycle `invitations` (status/…) dicabut dari
 * `authenticated` (migrasi v1 §6b) sehingga klien TAK BISA meng-aktifkan sendiri
 * tanpa bayar. Nominal diambil dari `packages` di server (bukan dari klien).
 * Undangan tetap belum publik: `draft` → `pending_payment`; aktivasi nyata hanya
 * saat webhook terverifikasi (M3.2). Perpanjangan (`expired`) tak mengubah status
 * agar halaman publik tetap menampilkan notis "kedaluwarsa" hingga lunas.
 */
export async function createCheckoutAction(
  invitationId: string,
  packageCode: string,
): Promise<CheckoutState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: copy.auth.genericAuthError };
  if (!isUuid(invitationId)) return { status: "error" };

  const parsedCode = packageCodeSchema.safeParse(packageCode);
  if (!parsedCode.success) return { status: "error" };
  const code = parsedCode.data;

  // Kepemilikan + status (RLS membatasi ke baris milik pemanggil).
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, status, slug")
    .eq("id", invitationId)
    .maybeSingle();
  if (!inv) return { status: "error" };
  if (!PAYABLE_STATUSES.has(inv.status)) {
    return { status: "error", message: copy.checkout.notPayable };
  }
  // Slug masih placeholder `draft-…` → alamat publik akan 404 & TERKUNCI setelah
  // aktif (saveSlug hanya saat `draft`). Wajib atur alamat dulu (backstop server).
  if (isDraftSlug(inv.slug)) {
    return { status: "error", message: copy.checkout.setSlugFirst };
  }

  // Harga otoritatif dari DB (jangan percaya nominal klien).
  const { data: pkg } = await supabase
    .from("packages")
    .select("id, price_idr")
    .eq("code", code)
    .eq("is_active", true)
    .eq("kind", "invitation") // checkout undangan tak boleh pakai kode add-on
    .maybeSingle();
  if (!pkg)
    return { status: "error", message: copy.checkout.packageUnavailable };

  // Order + payment link hanya lewat service_role.
  const admin = createSupabaseAdminClient();
  let orderCode = "";
  let created = false;
  for (let attempt = 0; attempt < ORDER_CODE_RETRIES; attempt += 1) {
    orderCode = generateOrderCode();
    const { error } = await admin.from("orders").insert({
      user_id: user.id,
      invitation_id: invitationId,
      package_id: pkg.id,
      amount_idr: pkg.price_idr,
      status: "pending",
      order_code: orderCode,
    });
    if (!error) {
      created = true;
      break;
    }
    if (error.code !== "23505")
      return { status: "error", message: copy.common.error };
    // 23505 pada order_code → kode bentrok, coba lagi dengan kode baru.
  }
  if (!created) return { status: "error", message: copy.common.error };

  // draft → pending_payment (no-op untuk expired/pending → guard status).
  await admin
    .from("invitations")
    .update({ status: "pending_payment" })
    .eq("id", invitationId)
    .eq("status", "draft");

  revalidatePath("/dashboard");

  // Pakasir mengembalikan klien ke halaman "cek status pembayaran" (M3.3): bila
  // ia kembali sebelum webhook tiba, poller mem-verifikasi via `transactiondetail`
  // dan mengaktifkan (jalur OTORITATIF kedua, pendamping webhook M3.2).
  const url = getPaymentGateway().createPaymentLink({
    orderCode,
    amountIdr: pkg.price_idr,
    redirectUrl: `${appUrl}/dashboard/undangan/${invitationId}/bayar`,
  });
  return { status: "redirect", url };
}

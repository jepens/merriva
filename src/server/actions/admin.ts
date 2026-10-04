"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isUuid } from "@/lib/id";
import { reportHandledError } from "@/lib/observability";
import { generateOrderCode } from "@/lib/order";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  adminActivateSchema,
  adminChangeOwnerSchema,
  adminExtendSchema,
  adminRefundSchema,
  adminSuspendSchema,
} from "@/lib/validation/admin";
import { orderCodeSchema } from "@/lib/validation/order";
import {
  notifyOrderPaid,
  sendReinstatedNotice,
  sendSuspendedNotice,
} from "@/server/email/notify";
import { requireAdmin } from "@/server/guards/auth";

/**
 * Aksi lifecycle admin (SPEC §4.9). Pola wajib: **auth(admin) → validasi Zod →
 * operasi (RPC service_role, atomik + audit dalam-transaksi) → revalidate**.
 * Umpan balik lewat `redirect(?msg=)` yang dibaca halaman detail (tool internal;
 * cukup tanpa state klien). `requireAdmin()` diulang di SETIAP action — Server
 * Action = endpoint yang bisa dipanggil langsung (bukan hanya lewat layout).
 */

const LIST = "/admin/undangan";
const ORDERS = "/admin/order";
const ORDER_CODE_RETRIES = 5;

function detail(id: string, msg: string): never {
  redirect(`${LIST}/${id}?msg=${msg}`);
}

function orders(msg: string): never {
  redirect(`${ORDERS}?msg=${msg}`);
}

/** Revalidate tampilan terdampak: publik (ISR), dashboard pemilik, panel admin. */
function revalidateAfter(slug: string | null | undefined) {
  if (slug) revalidatePath(`/${slug}`);
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  revalidatePath(LIST);
}

/** Aktivasi manual (bayar di luar sistem) — hasil identik dgn aktivasi bayar. */
export async function adminActivateInvitationAction(
  invitationId: string,
  formData: FormData,
): Promise<never> {
  const adminUser = await requireAdmin();
  if (!isUuid(invitationId)) redirect(LIST);

  const parsed = adminActivateSchema.safeParse({
    packageCode: formData.get("packageCode"),
  });
  if (!parsed.success) detail(invitationId, "activate_invalid");

  const admin = createSupabaseAdminClient();
  const { data: pkg } = await admin
    .from("packages")
    .select("id")
    .eq("code", parsed.data.packageCode)
    .eq("is_active", true)
    .eq("kind", "invitation") // aktivasi manual hanya paket undangan
    .maybeSingle();
  if (!pkg) detail(invitationId, "activate_pkg");

  let result: string | undefined;
  let slug: string | null = null;
  // Kodenya di-hoist, bukan dipakai inline: `admin_activate_invitation`
  // mengembalikan `(result, slug)` SAJA, jadi kode order yang baru saja dibuat
  // terbuang begitu loop selesai — dan tanpa kode itu tak ada kuitansi yang bisa
  // dikirim. Sesudah loop, isinya adalah percobaan TERAKHIR, yaitu percobaan yang
  // sama yang menghasilkan `result`/`slug`.
  let orderCode: string | null = null;
  for (let attempt = 0; attempt < ORDER_CODE_RETRIES; attempt += 1) {
    orderCode = generateOrderCode();
    const { data, error } = await admin.rpc("admin_activate_invitation", {
      p_invitation_id: invitationId,
      p_package_id: pkg.id,
      p_admin_id: adminUser.id,
      p_order_code: orderCode,
    });
    if (error) {
      // Aktivasi manual berarti uang SUDAH diterima di luar sistem
      // (docblock aksi ini). Gagalnya sama mahalnya dengan gagalnya webhook.
      reportHandledError(error, "admin.activate", { invitationId });
      detail(invitationId, "activate_failed");
    }
    const row = data?.[0];
    slug = row?.slug ?? null;
    result = row?.result;
    if (result !== "order_code_conflict") break;
  }

  revalidateAfter(slug);
  // Kuitansi untuk pembayar di luar sistem (transfer bank). Sampai sini merekalah
  // satu-satunya pelanggan yang membayar PENUH dan tak menerima bukti apa pun:
  // webhook, poller, dan cron semuanya mengirim kuitansi — jalur manual tidak.
  //
  // Gerbangnya `activated` SAJA, tidak menumpang cabang di bawahnya. Secara
  // analitis `already_paid` tak terjangkau di sini (RPC baru saja meng-`insert`
  // order `pending` ber-kode segar dalam transaksi yang sama), tetapi
  // ketakterjangkauan itu properti implementasi RPC, bukan kontraknya — webhook
  // dan poller pun memisahkan gerbang emailnya dengan cara yang sama.
  //
  // `await`, bukan `void`: `detail()` memanggil `redirect()` yang melempar
  // `NEXT_REDIRECT`, responsnya langsung dikirim, dan promise yang menggantung
  // bisa mati bersama request-nya. SESUDAH `revalidateAfter`, agar tak pernah ada
  // kuitansi untuk aktivasi yang cache-nya belum disegarkan. Tanpa try/catch:
  // `notifyOrderPaid` sudah best-effort di dalam dan tak pernah melempar,
  // sementara `catch` di sekitar `detail()` justru akan menelan `NEXT_REDIRECT`
  // dan menjebak admin di halaman tanpa umpan balik.
  if (result === "activated") {
    const kuitansi = orderCode
      ? await notifyOrderPaid(admin, orderCode)
      : "nodata";
    // Undangan SUDAH aktif; yang gagal hanya kuitansinya — karena itu pesannya
    // tetap "aktif", bukan "gagal". Admin perlu tahu agar bisa mengabari
    // pelanggan sendiri, termasuk pada kasus yang paling mudah terlewat:
    // undangan tanpa pemilik (akun sudah dihapus) menghasilkan order ber-
    // `user_id` NULL, dan untuk itu `notifyOrderPaid` memang diam by design.
    detail(
      invitationId,
      kuitansi === "sent" ? "activate_ok" : "activate_ok_no_email",
    );
  }
  if (result === "already_paid") detail(invitationId, "activate_ok");
  if (result === "draft_slug") detail(invitationId, "activate_draft_slug");
  if (result === "not_payable") detail(invitationId, "activate_not_payable");
  if (result === "package_unavailable") detail(invitationId, "activate_pkg");
  // Fallthrough: hasil RPC yang tak dikenal, ATAU `order_code_conflict` yang
  // bertahan setelah seluruh percobaan kode habis. Keduanya tak punya pesan
  // sendiri dan karenanya tak terbedakan di layar admin.
  reportHandledError(
    new Error(
      `admin_activate_invitation: hasil tak dikenal: ${result ?? "kosong"}`,
    ),
    "admin.activate.unknown-result",
    { invitationId },
  );
  detail(invitationId, "activate_failed");
}

/** Perpanjang masa aktif N bulan. */
export async function adminExtendInvitationAction(
  invitationId: string,
  formData: FormData,
): Promise<never> {
  const adminUser = await requireAdmin();
  if (!isUuid(invitationId)) redirect(LIST);

  const parsed = adminExtendSchema.safeParse({
    months: formData.get("months"),
  });
  if (!parsed.success) detail(invitationId, "extend_invalid");

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_extend_invitation", {
    p_invitation_id: invitationId,
    p_months: parsed.data.months,
    p_admin_id: adminUser.id,
  });
  if (error) {
    reportHandledError(error, "admin.extend", { invitationId });
    detail(invitationId, "extend_failed");
  }

  const row = data?.[0];
  revalidateAfter(row?.slug);
  if (row?.result === "extended") detail(invitationId, "extend_ok");
  if (row?.result === "not_extendable") {
    detail(invitationId, "extend_not_extendable");
  }
  if (row?.result === "invalid_months") detail(invitationId, "extend_invalid");
  reportHandledError(
    new Error(
      `admin_extend_invitation: hasil tak dikenal: ${row?.result ?? "kosong"}`,
    ),
    "admin.extend.unknown-result",
    { invitationId },
  );
  detail(invitationId, "extend_failed");
}

/** Suspend (konten bermasalah) → halaman publik menampilkan notis. */
export async function adminSuspendInvitationAction(
  invitationId: string,
  formData: FormData,
): Promise<never> {
  const adminUser = await requireAdmin();
  if (!isUuid(invitationId)) redirect(LIST);

  const parsed = adminSuspendSchema.safeParse({
    reason: formData.get("reason"),
    publicReason: formData.get("publicReason") ?? undefined,
  });
  if (!parsed.success) detail(invitationId, "suspend_invalid");

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_suspend_invitation", {
    p_invitation_id: invitationId,
    p_admin_id: adminUser.id,
    p_reason: parsed.data.reason,
    p_public_reason: parsed.data.publicReason,
  });
  if (error) {
    reportHandledError(error, "admin.suspend", { invitationId });
    detail(invitationId, "suspend_failed");
  }

  const row = data?.[0];
  revalidateAfter(row?.slug);
  // Penangguhan adalah satu-satunya tindakan PENEGAKAN di produk ini, dan sampai
  // sini ia berlangsung tanpa sepatah kata pun kepada pemiliknya: halaman
  // publiknya berubah, dan pemilik mengetahuinya dari tamunya sendiri.
  //
  // Hanya pada transisi `suspended`. `already_suspended` berarti emailnya sudah
  // pernah dikirim — mengirim ulang untuk klik kedua admin akan terbaca sebagai
  // penangguhan kedua. `parsed.data.publicReason` yang dikirim, BUKAN
  // `parsed.data.reason`: yang terakhir itu catatan internal.
  if (row?.result === "suspended") {
    const kabar = await sendSuspendedNotice(
      admin,
      invitationId,
      parsed.data.publicReason,
    );
    detail(
      invitationId,
      kabar === "sent" ? "suspend_ok" : "suspend_ok_no_email",
    );
  }
  if (row?.result === "already_suspended") detail(invitationId, "suspend_ok");
  detail(invitationId, "suspend_failed");
}

/**
 * Tandai order lunas sebagai REFUND dan cabut layanan yang dibeli
 * (AUDIT-2026-10-01 A3).
 *
 * Uangnya TIDAK bergerak di sini: `PaymentGateway` tak punya `refundTransaction`
 * dan pengembalian dilakukan di dashboard Pakasir. Yang dikerjakan aksi ini
 * adalah bagian yang selama ini hilang — tanpanya order tetap `paid` dan
 * undangan tetap aktif, sehingga pelanggan mendapat uang kembali DAN layanan,
 * dan laporan admin berhenti cocok dengan mutasi rekening.
 */
export async function adminRefundOrderAction(
  orderCode: string,
  formData: FormData,
): Promise<never> {
  const adminUser = await requireAdmin();

  const code = orderCode.trim().toUpperCase();
  if (!orderCodeSchema.safeParse(code).success) orders("refund_failed");

  const parsed = adminRefundSchema.safeParse({
    reason: formData.get("reason"),
  });
  if (!parsed.success) orders("refund_invalid");

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_refund_order", {
    p_order_code: code,
    p_admin_id: adminUser.id,
    p_reason: parsed.data.reason,
  });
  if (error) {
    // Refund mendampingi perpindahan uang NYATA di dashboard Pakasir. Admin
    // yang membaca "gagal" akan memutuskan berdasarkan bacaan itu.
    // `parsed.data.reason` sengaja TIDAK ikut: teks bebas isian admin, bisa
    // memuat nama atau alamat email pelanggan.
    reportHandledError(error, "admin.refund", { orderCode: code });
    orders("refund_failed");
  }

  const row = data?.[0];
  revalidateAfter(row?.slug);
  revalidatePath(ORDERS);

  if (row?.result === "refunded_revoked") orders("refund_ok_revoked");
  if (row?.result === "refunded_still_paid") orders("refund_ok_still_paid");
  if (row?.result === "refunded_album_archived") orders("refund_ok_album");
  // B3. Tanpa cabang ini refund upgrade BERHASIL di DB tetapi admin melihat
  // "gagal" — lalu mencoba lagi, mendapat "hanya order Lunas yang bisa
  // direfund", dan menyimpulkan refundnya tak pernah terjadi. Pada aksi yang
  // mendampingi perpindahan uang nyata di dashboard Pakasir, pesan yang salah
  // itu berisiko refund ganda.
  if (row?.result === "refunded_downgraded") orders("refund_ok_downgraded");
  if (row?.result === "not_found") orders("refund_not_found");
  // RPC mengembalikan 'not_paid:<status>' agar jejaknya jelas di log server.
  if (row?.result?.startsWith("not_paid")) orders("refund_not_paid");
  // Cabang PALING berharga di berkas ini: inilah yang akan menangkap hasil RPC
  // baru yang belum dipetakan. `refunded_downgraded` (B3) pernah jatuh ke sini
  // dan terbaca "gagal" oleh admin padahal refundnya BERHASIL — dengan risiko
  // refund ganda manual di dashboard Pakasir. `error` null di titik ini, jadi
  // pesannya dirakit sendiri; tanpa itu laporannya hanya "unknown error".
  reportHandledError(
    new Error(
      `admin_refund_order: hasil tak dikenal: ${row?.result ?? "kosong"}`,
    ),
    "admin.refund.unknown-result",
    { orderCode: code },
  );
  orders("refund_failed");
}

/** Reinstate (batalkan suspend) → status dipulihkan dari active_until. */
export async function adminReinstateInvitationAction(
  invitationId: string,
  _formData?: FormData,
): Promise<never> {
  const adminUser = await requireAdmin();
  if (!isUuid(invitationId)) redirect(LIST);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_reinstate_invitation", {
    p_invitation_id: invitationId,
    p_admin_id: adminUser.id,
  });
  if (error) {
    reportHandledError(error, "admin.reinstate", { invitationId });
    detail(invitationId, "reinstate_failed");
  }

  const row = data?.[0];
  revalidateAfter(row?.slug);
  // Pasangan wajib dari email penangguhan: pemilik yang bandingnya DITERIMA tak
  // boleh dibiarkan menebak. `new_status` dari RPC yang menentukan isinya —
  // reinstate memulihkan status dari `active_until`, jadi undangan yang masa
  // aktifnya sudah lewat menjadi `expired` dan BELUM tampil; mengabarkan "tampil
  // kembali" di kasus itu adalah keterangan yang salah.
  if (row?.result === "reinstated") {
    const kabar = await sendReinstatedNotice(
      admin,
      invitationId,
      row.new_status === "active",
    );
    detail(
      invitationId,
      kabar === "sent" ? "reinstate_ok" : "reinstate_ok_no_email",
    );
  }
  if (row?.result === "not_suspended") {
    detail(invitationId, "reinstate_not_suspended");
  }
  reportHandledError(
    new Error(
      `admin_reinstate_invitation: hasil tak dikenal: ${row?.result ?? "kosong"}`,
    ),
    "admin.reinstate.unknown-result",
    { invitationId },
  );
  detail(invitationId, "reinstate_failed");
}

/** Ganti kepemilikan (klien jasa EO) — undangan + order pindah ke user baru. */
export async function adminChangeOwnerAction(
  invitationId: string,
  formData: FormData,
): Promise<never> {
  const adminUser = await requireAdmin();
  if (!isUuid(invitationId)) redirect(LIST);

  const parsed = adminChangeOwnerSchema.safeParse({
    newUserId: formData.get("newUserId"),
  });
  if (!parsed.success) detail(invitationId, "owner_invalid");

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_change_owner", {
    p_invitation_id: invitationId,
    p_new_user_id: parsed.data.newUserId,
    p_admin_id: adminUser.id,
  });
  if (error) {
    reportHandledError(error, "admin.change-owner", { invitationId });
    detail(invitationId, "owner_failed");
  }

  const result = data?.[0]?.result;
  revalidateAfter(null);
  if (result === "changed" || result === "noop")
    detail(invitationId, "owner_ok");
  if (result === "user_not_found") detail(invitationId, "owner_user_not_found");
  reportHandledError(
    new Error(`admin_change_owner: hasil tak dikenal: ${result ?? "kosong"}`),
    "admin.change-owner.unknown-result",
    { invitationId },
  );
  detail(invitationId, "owner_failed");
}

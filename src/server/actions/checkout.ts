"use server";

import { revalidatePath } from "next/cache";

import {
  activationReadiness,
  fetchReadinessEvents,
} from "@/lib/activation-readiness";
import { copy } from "@/lib/copy";
import { PAYABLE_STATUSES } from "@/lib/invitation-status";
import { appUrl } from "@/lib/env";
import { isUuid } from "@/lib/id";
import { packageAllowsTheme, resolveLimits } from "@/lib/limits";
import { merchantIdentityReady } from "@/lib/merchant";
import { reportHandledError } from "@/lib/observability";
import { generateOrderCode } from "@/lib/order";
import { MASA_BERLAKU_QR_MS } from "@/lib/payment/binderpay";
import { isPaymentExempt } from "@/server/guards/auth";
import { aktifkanGratis } from "@/server/payment/gratis";
import { terbitkanLink } from "@/server/payment/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { packageCodeSchema } from "@/lib/validation/checkout";

/**
 * Hasil checkout: URL Pakasir untuk di-redirect klien, atau error ter-lokalisasi.
 */
export type CheckoutState =
  | { status: "redirect"; url: string }
  | {
      status: "error";
      message?: string;
      /**
       * `readiness` = syarat yang bisa diperbaiki pemilik belum terpenuhi (#44).
       * Halaman aktivasi yang terbuka sudah basi (mis. jadwal dikosongkan di tab
       * lain), jadi klien me-refresh-nya agar daftar syarat + tautan perbaikan
       * tampil menggantikan pemilih paket.
       */
      reason?: "readiness";
    };

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

  // Identitas pelaku usaha WAJIB tampil SEBELUM pembayaran (PP 80/2019,
  // Permendag 31/2020). Selama `merchant.name`/`address` kosong, `/syarat` dan
  // `/refund` merender bagian itu KOSONG dengan anggun — tanpa galat, tanpa
  // tanda. Gerbang ini membuat kelalaian itu mustahil ikut terbit: lebih baik
  // tombol bayar mati daripada menerima uang tanpa identitas, yang juga rutin
  // membuat aggregator menangguhkan akun merchant setelah uang pelanggan masuk.
  // Hanya di PRODUCTION — dev & test tetap bisa menelusuri alur pembayaran.
  if (process.env.NODE_ENV === "production" && !merchantIdentityReady()) {
    reportHandledError(
      new Error(
        "identitas pelaku usaha belum diisi (copy.marketing.legal.merchant) — checkout ditutup",
      ),
      "checkout.merchant-identity",
    );
    return { status: "error", message: copy.checkout.merchantMissing };
  }

  const parsedCode = packageCodeSchema.safeParse(packageCode);
  if (!parsedCode.success) return { status: "error" };
  const code = parsedCode.data;

  // Kepemilikan + status (RLS membatasi ke baris milik pemanggil — KECUALI
  // admin, yang melihat semua undangan; lihat cabang bebas-bayar di bawah).
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, status, slug, purged_at, user_id, theme_id")
    .eq("id", invitationId)
    .maybeSingle();
  if (!inv) return { status: "error" };
  // Kerangka pasca-retensi: foto/tamu/ucapan SUDAH dihapus permanen dan tak
  // bisa dikembalikan. Baris begini disembunyikan dari dashboard, tetapi URL
  // aktivasinya masih bisa dibuka dari tautan lama — jangan biarkan pemilik
  // membayar perpanjangan untuk undangan yang isinya sudah tiada.
  if (inv.purged_at) {
    return { status: "error", message: copy.checkout.notPayable };
  }
  if (!PAYABLE_STATUSES.has(inv.status)) {
    return { status: "error", message: copy.checkout.notPayable };
  }
  // Syarat yang bisa diperbaiki pemilik (SPEC §4.8 langkah 0, DECISIONS #44) —
  // fungsi yang SAMA dengan daftar syarat di halaman aktivasi, jadi penahan ini
  // hanya bekerja bila halaman itu dilewati (tautan lama, klien dirakit ulang):
  //  - slug masih `draft-…` → alamat publik 404 & TERKUNCI setelah aktif;
  //  - belum ada sesi berjam → tamu tak tahu kapan acaranya (#42: sesi tanpa
  //    jam tak pernah tampil).
  // Berlaku untuk SEMUA pembayaran (aktivasi, bayar ulang, perpanjangan). Galat
  // query jadwal → gagal-tertutup: jangan buka pembayaran yang tak terverifikasi.
  // Aktivasi SESUDAH bayar (webhook/poller) & aktivasi manual admin tak memeriksa
  // ini — uang yang sudah masuk tak boleh tertahan.
  const { data: eventRows, error: eventsError } = await fetchReadinessEvents(
    supabase,
    inv.id,
  );
  if (eventsError) return { status: "error", message: copy.common.error };
  const [blocker] = activationReadiness(inv, eventRows ?? []).blockers;
  if (blocker === "slug") {
    return {
      status: "error",
      message: copy.checkout.setSlugFirst,
      reason: "readiness",
    };
  }
  if (blocker === "schedule") {
    return {
      status: "error",
      message: copy.checkout.scheduleFirst,
      reason: "readiness",
    };
  }

  // Harga otoritatif dari DB (jangan percaya nominal klien).
  const { data: pkg } = await supabase
    .from("packages")
    .select("id, price_idr, limits")
    .eq("code", code)
    .eq("is_active", true)
    .eq("kind", "invitation") // checkout undangan tak boleh pakai kode add-on
    .maybeSingle();
  if (!pkg)
    return { status: "error", message: copy.checkout.packageUnavailable };

  // Order + payment link hanya lewat service_role.
  const admin = createSupabaseAdminClient();

  // Tema bertier premium wajib paket ber-`all_themes` (DECISIONS #116, SPEC
  // §4.8 langkah 0). Pemilih paket sudah menonaktifkannya; ini penegaknya bila
  // halaman itu dilewati. Dibaca lewat service_role: `themes_select_public`
  // menyembunyikan tema NONAKTIF dari pelanggan, dan tema premium yang
  // dinonaktifkan sesudah dipakai draft akan terbaca "tak ada" → lolos dengan
  // Basic. FK menjamin barisnya ada, jadi galat ATAU baris kosong →
  // gagal-tertutup.
  const { data: tema, error: temaError } = await admin
    .from("themes")
    .select("tier")
    .eq("id", inv.theme_id)
    .maybeSingle();
  if (temaError || !tema) {
    return { status: "error", message: copy.common.error };
  }
  if (!packageAllowsTheme(resolveLimits(pkg.limits), tema.tier)) {
    return { status: "error", message: copy.checkout.premiumThemeRequired };
  }

  // Admin & Pro tak pernah ditagih (DECISIONS #100): yang dilewati HANYA
  // pembayarannya — semua syarat di atas (status, purge, alamat, jadwal, paket)
  // tetap berlaku. Hanya untuk undangan MILIK sendiri: undangan pelanggan
  // digratiskan lewat aktivasi manual ber-audit di panel admin.
  //
  // Sengaja SEBELUM pemakaian-ulang order `pending` di bawah: pemilik yang
  // sempat membuka Pakasir sebelum menjadi Pro tak boleh tertahan 24 jam
  // menunggu cron. Order lamanya tetap menggantung sampai cron
  // mengedaluwarsakannya (risiko yang diterima — DECISIONS #100).
  if (inv.user_id === user.id && (await isPaymentExempt(supabase, user.id))) {
    const ok = await aktifkanGratis(admin, {
      invitationId,
      packageId: pkg.id,
      purpose: "purchase",
      actorId: user.id,
    });
    if (!ok) return { status: "error", message: copy.common.error };
    return { status: "redirect", url: "/dashboard" };
  }

  // Order PENDING untuk paket yang SAMA dipakai ulang, bukan ditimpa order baru
  // (AUDIT-2026-10-01 A3). Penahan ini sudah ada di jalur add-on tetapi tak
  // pernah dipasang di sini, sehingga klik-ganda atau "bayar lagi" setelah
  // meninggalkan halaman Pakasir menghasilkan dua order untuk satu undangan —
  // penyebab utama pembayaran ganda, yang justru jadi kasus refund yang
  // dijanjikan kebijakan. Nominalnya diambil dari ORDER, bukan harga paket saat
  // ini: Pakasir menagih sesuai order yang sudah dibuat, dan harga bisa berubah
  // di antara dua percobaan.
  //
  // `purpose = 'purchase'` WAJIB ada di filter ini (B3). Order upgrade memakai
  // paket tujuan yang SAMA (`premium`) tetapi nominalnya hanya SELISIH harga:
  // tanpa filter ini, pemilik yang punya order upgrade menggantung lalu
  // mengaktifkan/memperpanjang undangan akan dipakaikan ulang order Rp100.000
  // itu dan mendapat masa aktif penuh dengan membayar selisih. Gerbangnya
  // dua arah — `findPendingUpgradeOrder` memfilter ke sisi sebaliknya.
  //
  // Yang dipakai ulang hanya order pending TERBARU, dan hanya bila paketnya
  // sama: /bayar selalu menampilkan order TERBARU undangan, jadi memakai ulang
  // order paket yang sama tetapi lebih tua membuat /bayar menampilkan QR paket
  // LAIN (Basic → Premium → Basic menampilkan QR Premium).
  const halamanBayar = `${appUrl}/dashboard/undangan/${invitationId}/bayar`;
  const { data: terbaru, error: pendingErr } = await admin
    .from("orders")
    .select(
      "order_code, amount_idr, package_id, txn_id, qr_content, created_at",
    )
    .eq("invitation_id", invitationId)
    .eq("status", "pending")
    .eq("purpose", "purchase")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pendingErr) {
    // Gagal-tertutup: tanpa jawaban, penahan pembayaran-ganda di atas lenyap
    // diam-diam — setiap klik menjadi order baru.
    reportHandledError(pendingErr, "checkout.pending-lookup", {
      invitationId,
    });
    return { status: "error", message: copy.common.error };
  }
  const pending = terbaru?.package_id === pkg.id ? terbaru : null;
  if (pending?.qr_content) {
    // BinderPay: QR-nya sudah tersimpan dan halaman bayar KITA yang
    // menampilkannya. Gateway tak dipanggil lagi — BinderPay menolak QR kedua
    // untuk nomor order yang sama (HTTP 500). QR yang sudah mati tak dipakai
    // ulang: alurnya jatuh ke pembuatan order baru di bawah, dan order lama
    // ditutup cron tanpa QR yang masih bisa dibayar.
    if (Date.parse(pending.created_at) + MASA_BERLAKU_QR_MS > Date.now()) {
      return { status: "redirect", url: halamanBayar };
    }
  } else if (pending?.txn_id) {
    // Pakasir: `find-or-create` berkunci `order_code`, jadi memanggilnya ulang
    // mengembalikan transaksi yang SAMA. Order TANPA `txn_id` sengaja tak
    // dipakai ulang — di BinderPay membuat ulang ditolak, dan pelanggan memang
    // tak pernah melihat link-nya; cron yang menutupnya (DECISIONS #101).
    const link = await terbitkanLink(admin, {
      orderCode: pending.order_code,
      amountIdr: pending.amount_idr,
      redirectUrl: halamanBayar,
    });
    if (!link) return { status: "error", message: copy.checkout.linkFailed };
    return { status: "redirect", url: link };
  }

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
      // Eksplisit meski kolomnya ber-default: jenis order adalah bagian dari
      // kontrak jalur uang, bukan detail skema yang boleh diam-diam berubah.
      purpose: "purchase",
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
  // ia kembali sebelum webhook tiba, poller mem-verifikasi status transaksi OTORITATIF
  // dan mengaktifkan (jalur OTORITATIF kedua, pendamping webhook M3.2).
  const url = await terbitkanLink(admin, {
    orderCode,
    amountIdr: pkg.price_idr,
    redirectUrl: halamanBayar,
  });
  // Order sudah ter-insert. Gagal menerbitkan link TIDAK mengunci pelanggan:
  // order tanpa `txn_id` tak dipakai ulang, jadi percobaan berikutnya membuat
  // order baru (Pakasir dengan `txn_id`: `find-or-create` mengembalikan
  // transaksi yang sama).
  if (!url) return { status: "error", message: copy.checkout.linkFailed };
  return { status: "redirect", url };
}

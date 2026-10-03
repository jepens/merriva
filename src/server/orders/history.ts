import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { dataOrThrow } from "@/lib/supabase/result";
import type { Database } from "@/types/database";

/**
 * Riwayat pesanan pelanggan (AUDIT-2026-10-01 A4).
 *
 * Modul server BIASA (tanpa `"use server"`) — alasan identik dengan
 * `src/server/momen/orders.ts`: setiap ekspor di berkas ber-`"use server"`
 * menjadi endpoint Server Action, dan helper yang menerima klien Supabase
 * sebagai argumen tidak boleh terekspos begitu.
 */

type Client = SupabaseClient<Database>;
type OrderStatus = Database["public"]["Enums"]["order_status"];
type InvitationStatus = Database["public"]["Enums"]["invitation_status"];

export const ORDER_HISTORY_PAGE_SIZE = 20;

/**
 * Kolom yang boleh dibaca pelanggan — disebut EKSPLISIT, dan `select("*")`
 * DILARANG di modul ini.
 *
 * Alasannya bukan gaya: pencabutan hak per-kolom di migrasi awal hanya menyentuh
 * `profiles`, `invitations`, dan `rsvps` — tabel `orders` TERLEWAT, sehingga
 * grant SELECT `authenticated` masih mencakup SELURUH kolomnya. `raw_notification`
 * berisi payload mentah Pakasir pada jalur webhook dan
 * `{"source":"admin_manual","admin_id":"<uuid admin>"}` pada aktivasi manual.
 */
const ORDER_COLUMNS =
  "order_code, status, amount_idr, payment_method, created_at, paid_at, invitation_id, package_id, purpose";

export type OrderKind = "invitation" | "addon_momen";

/**
 * Jenis ORDER, terpisah dari jenis PAKET (AUDIT-2026-10-01 B3).
 *
 * Order upgrade memakai paket undangan biasa, jadi `packages.kind` sendirian
 * akan melabelinya "Paket undangan" dan — lebih buruk — membuat kuitansinya
 * mencantumkan "Masa aktif dibeli: 6 bulan" untuk pembayaran yang tidak membeli
 * masa aktif sama sekali. Pada dokumen bukti pembayaran itu bukan label yang
 * kurang tepat, itu keterangan yang salah.
 */
export type OrderPurpose = "purchase" | "upgrade";

export interface OrderRecord {
  orderCode: string;
  status: OrderStatus;
  amountIdr: number;
  paymentMethod: string | null;
  createdAt: string;
  paidAt: string | null;
  invitationId: string;
  packageId: string;
  purpose: OrderPurpose;
}

export interface OrderView extends OrderRecord {
  packageName: string | null;
  packageKind: OrderKind | null;
  packageDurationMonths: number | null;
  invitationSlug: string | null;
  invitationStatus: InvitationStatus | null;
  invitationActiveUntil: string | null;
  invitationPurged: boolean;
  /**
   * Paket undangan SAAT INI. Dibandingkan dengan `packageId` order untuk
   * mengenali upgrade yang sudah dibayar tetapi paketnya tak pernah naik
   * (RPC `held`) — satu-satunya tempat pelanggan bisa melihat uang yang
   * tertahan itu, karena undangannya tetap `active` sehingga kartu "pembayaran
   * masuk, undangan belum aktif" tak akan pernah menyalakannya.
   */
  invitationPackageId: string | null;
}

/** `packages.kind` bertipe `string` di tipe DB → disempitkan sebelum dipakai. */
function toOrderKind(raw: string | null | undefined): OrderKind | null {
  return raw === "invitation" || raw === "addon_momen" ? raw : null;
}

/**
 * `orders.purpose` bertipe `string` di tipe DB → disempitkan.
 *
 * Nilai tak dikenal jatuh ke `"purchase"`, BUKAN `"upgrade"`: bila kelak ada
 * jenis order baru, salah melabelinya sebagai pembelian biasa hanya membuat
 * labelnya kurang tepat — salah melabelinya sebagai upgrade akan MENYEMBUNYIKAN
 * masa aktif yang benar-benar dibeli dari kuitansinya.
 */
function toOrderPurpose(raw: string | null | undefined): OrderPurpose {
  return raw === "upgrade" ? "upgrade" : "purchase";
}

type OrderRow = {
  order_code: string;
  status: OrderStatus;
  amount_idr: number;
  payment_method: string | null;
  created_at: string;
  paid_at: string | null;
  invitation_id: string;
  package_id: string;
  purpose: string;
};

function toRecord(r: OrderRow): OrderRecord {
  return {
    orderCode: r.order_code,
    status: r.status,
    amountIdr: r.amount_idr,
    paymentMethod: r.payment_method,
    createdAt: r.created_at,
    paidAt: r.paid_at,
    invitationId: r.invitation_id,
    packageId: r.package_id,
    purpose: toOrderPurpose(r.purpose),
  };
}

/**
 * Satu halaman order milik `userId`, terbaru dulu.
 *
 * `.eq("user_id", …)` ditulis EKSPLISIT meskipun `orders_select` sudah
 * membatasi per pemilik: halaman tanpa segmen `[id]` mengikuti pola yang sama
 * dengan daftar undangan, supaya RLS bukan satu-satunya pertahanan bila kelak
 * kliennya ditukar.
 *
 * Mengambil PAGE_SIZE+1 baris untuk mengetahui adanya halaman berikutnya tanpa
 * `{ count: "exact" }` — COUNT penuh tiap request tak sepadan untuk jumlah
 * order per akun yang sedikit.
 */
export async function fetchOwnOrderPage(
  supabase: Client,
  userId: string,
  page: number,
): Promise<{ rows: OrderRecord[]; hasNext: boolean }> {
  const from = (Math.max(1, page) - 1) * ORDER_HISTORY_PAGE_SIZE;
  const res = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, from + ORDER_HISTORY_PAGE_SIZE);

  const raw = (dataOrThrow(res, "orders (riwayat pesanan)") ??
    []) as unknown as OrderRow[];
  const hasNext = raw.length > ORDER_HISTORY_PAGE_SIZE;
  return {
    rows: raw.slice(0, ORDER_HISTORY_PAGE_SIZE).map(toRecord),
    hasNext,
  };
}

/**
 * Satu order milik `userId` berdasarkan kode publiknya.
 *
 * `null` untuk kode yang tak ada MAUPUN milik orang lain — pemanggil menjawab
 * `notFound()` pada keduanya, sehingga tak ada beda perilaku yang bisa dipakai
 * menebak kode order pelanggan lain.
 */
export async function fetchOwnOrderByCode(
  supabase: Client,
  userId: string,
  orderCode: string,
): Promise<OrderRecord | null> {
  const res = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("order_code", orderCode)
    .eq("user_id", userId)
    .maybeSingle();
  const row = dataOrThrow(
    res,
    "orders (kuitansi)",
  ) as unknown as OrderRow | null;
  return row ? toRecord(row) : null;
}

/**
 * Lengkapi order dengan nama paket & undangannya.
 *
 * Undangan dibaca dengan klien SESI (RLS pemilik) + filter eksplisit; paket
 * dibaca dengan klien service_role karena `packages_select_public` =
 * `using (is_active or is_admin())` → paket yang DINONAKTIFKAN saat pemilik
 * mengganti harga mengembalikan NULL SECARA SENYAP bagi pemilik, sehingga
 * riwayat lama kehilangan nama paket DAN kehilangan `kind` (add-on jadi salah
 * label). Preseden & alasan identik: `src/server/momen/orders.ts`.
 *
 * Tabel `orders` TIDAK PERNAH disentuh klien admin di sini — satu kelalaian
 * `.eq("user_id", …)` di jalur itu akan membocorkan order seluruh pelanggan.
 */
export async function attachRefs(
  supabase: Client,
  admin: Client,
  userId: string,
  records: readonly OrderRecord[],
): Promise<OrderView[]> {
  if (records.length === 0) return [];

  const invIds = [...new Set(records.map((r) => r.invitationId))];
  const pkgIds = [...new Set(records.map((r) => r.packageId))];

  const invRes = await supabase
    .from("invitations")
    .select("id, slug, status, active_until, purged_at, package_id")
    .eq("user_id", userId)
    .in("id", invIds);
  const invRows = dataOrThrow(invRes, "invitations (riwayat pesanan)") ?? [];

  const pkgRes = await admin
    .from("packages")
    .select("id, name, kind, duration_months")
    .in("id", pkgIds);
  const pkgRows = dataOrThrow(pkgRes, "packages (riwayat pesanan)") ?? [];

  const invById = new Map(invRows.map((i) => [i.id, i]));
  const pkgById = new Map(pkgRows.map((p) => [p.id, p]));

  return records.map((r) => {
    const inv = invById.get(r.invitationId);
    const pkg = pkgById.get(r.packageId);
    return {
      ...r,
      packageName: pkg?.name ?? null,
      packageKind: toOrderKind(pkg?.kind),
      packageDurationMonths: pkg?.duration_months ?? null,
      invitationSlug: inv?.slug ?? null,
      invitationStatus: inv?.status ?? null,
      invitationActiveUntil: inv?.active_until ?? null,
      invitationPurged: Boolean(inv?.purged_at),
      invitationPackageId: inv?.package_id ?? null,
    };
  });
}

/**
 * Label jenis pesanan — dari `packages.kind` + `orders.purpose`, tak pernah dari
 * nominal: paket `premium` dan `momen_50` sama-sama Rp199.000.
 *
 * `purpose` diperiksa LEBIH DULU karena order upgrade memakai paket undangan
 * biasa; tanpa itu ia akan terbaca sama dengan aktivasi.
 */
export function orderKindLabel(
  kind: OrderKind | null,
  purpose: OrderPurpose,
  c: {
    kindInvitation: string;
    kindAddonMomen: string;
    kindUpgrade: string;
    kindUnknown: string;
  },
): string {
  if (purpose === "upgrade") return c.kindUpgrade;
  if (kind === "invitation") return c.kindInvitation;
  if (kind === "addon_momen") return c.kindAddonMomen;
  return c.kindUnknown;
}

/**
 * true bila order ini benar-benar MEMBELI masa aktif undangan.
 *
 * Penentu tampilnya baris "Masa aktif dibeli" dan "Aktif hingga" pada kuitansi
 * & riwayat. Add-on tidak membelinya (album ikut retensi undangan) dan upgrade
 * juga tidak (hanya menukar paket untuk sisa masa aktif yang sama) — keduanya
 * akan mencantumkan `duration_months` paketnya bila dinilai dari `kind` saja.
 */
/**
 * Halaman tempat pelanggan bisa MELANJUTKAN pembayaran order `pending`.
 *
 * Ketiga jenis order punya permukaan status sendiri, dan mengirim pelanggan ke
 * permukaan yang salah bukan sekadar tak nyaman: `/bayar` berkunci pada status
 * UNDANGAN dan langsung menyatakan "Pembayaran berhasil! Undangan Anda kini
 * aktif" bila undangannya `active` — tepat keadaan setiap pembeli upgrade dan
 * add-on. Layar sukses untuk pembayaran yang belum terjadi.
 *
 * Link Pakasir-nya sendiri TIDAK dibangun ulang di pemanggil: `getPaymentGateway()`
 * MELEMPAR bila slug proyek kosong, dan itu akan mematikan seluruh halaman
 * riwayat.
 */
export function pendingPaymentPath(
  invitationId: string,
  kind: OrderKind | null,
  purpose: OrderPurpose,
): string {
  const base = `/dashboard/undangan/${invitationId}`;
  if (purpose === "upgrade") return `${base}/upgrade`;
  if (kind === "addon_momen") return `${base}/momen`;
  return `${base}/bayar`;
}

export function buysActivePeriod(
  kind: OrderKind | null,
  purpose: OrderPurpose,
): boolean {
  return kind === "invitation" && purpose === "purchase";
}

import "server-only";

import QRCode from "qrcode";

import { wibDateTime } from "@/lib/admin/display";
import { MASA_BERLAKU_QR_MS } from "@/lib/payment/binderpay";

/** QR QRIS siap dirender di halaman bayar kita (DECISIONS #99). */
export interface QrisSiapBayar {
  /** `data:image/png;base64,…` */
  png: string;
  /** Batas berlaku, sudah diformat WIB. */
  berlakuSampai: string;
}

/**
 * QR order yang MASIH bisa dibayar — `null` bila order bukan `pending`, tak
 * punya QR (Pakasir: halaman bayarnya hosted), atau QR-nya sudah mati.
 *
 * PNG, bukan SVG: pelanggan yang membuka dashboard dari HP menyimpan gambarnya
 * lalu memindainya dari galeri aplikasi e-wallet/m-banking, dan aplikasi itu
 * tak membaca SVG.
 *
 * Batas berlaku dihitung dari `created_at` + `MASA_BERLAKU_QR_MS` — konstanta
 * yang SAMA dengan yang dikirim driver, dan sedikit lebih awal dari QR
 * sebenarnya (QR dibuat sesaat setelah order), jadi halaman tak pernah
 * menampilkan QR yang sudah mati.
 */
export async function qrisUntukOrder(
  order: { status: string; qr_content: string | null; created_at: string },
  sekarangMs: number,
): Promise<QrisSiapBayar | null> {
  if (order.status !== "pending" || !order.qr_content) return null;
  const mati = Date.parse(order.created_at) + MASA_BERLAKU_QR_MS;
  if (!(mati > sekarangMs)) return null;
  const png = await QRCode.toDataURL(order.qr_content, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
  });
  return { png, berlakuSampai: wibDateTime(new Date(mati).toISOString()) };
}

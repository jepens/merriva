import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getPaymentGateway } from "@/lib/payment";
import type { CreatePaymentLinkInput } from "@/lib/payment/types";
import { reportHandledError } from "@/lib/observability";
import type { Database } from "@/types/database";

/**
 * Terbitkan link pembayaran DAN simpan `txn_id` ke baris order
 * (AUDIT-2026-10-13, Pakasir API v2).
 *
 * Satu tempat untuk keempat jalur checkout (undangan, perpanjangan, upgrade,
 * add-on Album Momen), karena urutannya adalah invarian keamanan dan bukan
 * selera:
 *
 *   1. panggil gateway (bisa GAGAL — v2 menuntut panggilan jaringan),
 *   2. TULIS `txn_id` ke baris order,
 *   3. BARU arahkan pelanggan.
 *
 * Jangan pernah mengarahkan pelanggan ke link yang rujukannya belum tersimpan:
 * status transaksi v2 berkunci `txn_id`, jadi pembayaran atas transaksi yang
 * `txn_id`-nya tak pernah kita simpan tidak bisa diverifikasi — pelanggan
 * membayar dan tak mendapat apa pun.
 *
 * `null` = gagal; pemanggil menampilkan galat dan TIDAK mengarahkan. Kegagalannya
 * dilaporkan di sini supaya tak ada pemanggil yang lupa.
 */
export async function terbitkanLink(
  admin: SupabaseClient<Database>,
  input: CreatePaymentLinkInput,
): Promise<string | null> {
  let hasil;
  try {
    hasil = await getPaymentGateway().createPaymentLink(input);
  } catch (err) {
    // JALUR UANG: kegagalan penerbitan link tak boleh senyap. Tanpa sinyal ini,
    // Pakasir yang menolak (atau plafon 2/detik yang terlampaui) hanya tampak
    // sebagai pelanggan yang "tak bisa bayar".
    reportHandledError(err, "payment.create-link", {
      orderCode: input.orderCode,
    });
    return null;
  }

  const { error } = await admin
    .from("orders")
    .update({ txn_id: hasil.txnId })
    .eq("order_code", input.orderCode);
  if (error) {
    // Transaksi SUDAH ada di Pakasir tetapi rujukannya gagal tersimpan. JANGAN
    // arahkan: pembayaran atasnya tak akan bisa diverifikasi. Percobaan ulang
    // aman — `find-or-create` mengembalikan `txn_id` yang sama.
    reportHandledError(error, "payment.create-link.persist", {
      orderCode: input.orderCode,
    });
    return null;
  }
  return hasil.url;
}

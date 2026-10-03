import type { InvitationStatus } from "@/types";

/**
 * Ajakan aksi aktivasi per status undangan — SATU sumber kebenaran untuk
 * dashboard (kartu undangan) dan bar pratinjau pemilik, supaya keduanya tak
 * pernah menawarkan tujuan yang berbeda untuk status yang sama.
 *
 * Sengaja TIDAK dipakai sebagai gerbang pembayaran: `createCheckoutAction`
 * memegang daftar status yang boleh membayar sendiri (gerbang uang tak boleh
 * ikut berubah hanya karena label UI diubah). `tests/unit/lib/invitation-status
 * .test.ts` menjaga kedua daftar itu tetap selaras.
 */
export type ActivationCta = "activate" | "pay" | "renew";

/** Status → CTA. `null` = tak ada aksi aktivasi yang masuk akal. */
const ACTIVATION_CTA: Record<InvitationStatus, ActivationCta | null> = {
  draft: "activate",
  pending_payment: "pay",
  expired: "renew",
  // Sudah dibayar — halaman aktivasi mengalihkan ke dashboard.
  active: null,
  // Masalah konten → tak bisa diselesaikan sendiri (halaman aktivasi 404).
  suspended: null,
};

/**
 * `purgedAt` tak null = kerangka pasca-retensi: foto, tamu, dan ucapan sudah
 * dihapus permanen (cron `purge-expired`). Menawarkan perpanjangan di sini
 * berarti mengajak pemilik MEMBAYAR untuk undangan kosong yang isinya tak bisa
 * dikembalikan — dashboard pun menyembunyikan baris seperti itu.
 */
export function activationCtaFor(
  status: InvitationStatus,
  purgedAt: string | null = null,
): ActivationCta | null {
  if (purgedAt) return null;
  return ACTIVATION_CTA[status];
}

/**
 * Status yang boleh MEMULAI PEMBAYARAN (`createCheckoutAction`): draft
 * (aktivasi pertama), expired (perpanjangan), pending_payment (ulangi bayar).
 * Bukan `active` (sudah dibayar) / `suspended` (masalah konten → tak bisa
 * self-service).
 *
 * Sengaja daftar TERPISAH dari `ACTIVATION_CTA`, bukan turunannya: menambah
 * label CTA tak boleh diam-diam melebarkan gerbang uang. Keduanya dijaga tetap
 * selaras oleh test, bukan oleh kode.
 */
export const PAYABLE_STATUSES: ReadonlySet<InvitationStatus> = new Set([
  "draft",
  "expired",
  "pending_payment",
]);

/**
 * Status yang boleh membayar UPGRADE paket (AUDIT-2026-10-01 B3): HANYA
 * `active`.
 *
 * Daftar ini sengaja TERPISAH dari `PAYABLE_STATUSES`, dan keduanya WAJIB tak
 * beririsan. Itu bukan kerapian — itu gerbang uang: kedua jalur menagih nominal
 * BERBEDA untuk paket yang sama (harga penuh vs selisih harga), jadi satu status
 * yang masuk ke keduanya berarti pelanggan bisa memilih jalur yang lebih murah
 * untuk hasil yang sama. `draft`/`pending_payment` belum pernah membayar apa pun
 * sehingga tak ada yang bisa dikreditkan sebagai selisih; `expired` harus
 * memperpanjang karena Premium tanpa masa aktif tak bernilai; `suspended` tak
 * bisa diselesaikan sendiri. Dijaga test, bukan oleh kode.
 */
export const UPGRADABLE_STATUSES: ReadonlySet<InvitationStatus> = new Set([
  "active",
]);

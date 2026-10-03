import { describe, expect, it } from "vitest";

import {
  activationCtaFor,
  PAYABLE_STATUSES,
  UPGRADABLE_STATUSES,
  type ActivationCta,
} from "@/lib/invitation-status";
import { copy } from "@/lib/copy";
import type { InvitationStatus } from "@/types";

const SEMUA_STATUS: InvitationStatus[] = [
  "draft",
  "pending_payment",
  "active",
  "expired",
  "suspended",
];

describe("CTA aktivasi per status undangan", () => {
  it("memetakan status yang bisa dibayar ke ajakan yang benar", () => {
    expect(activationCtaFor("draft")).toBe("activate");
    expect(activationCtaFor("pending_payment")).toBe("pay");
    expect(activationCtaFor("expired")).toBe("renew");
  });

  it("TIDAK menawarkan aktivasi untuk active & suspended", () => {
    // `/aktifkan` mengalihkan `active` ke dashboard dan menolak `suspended`
    // (notFound) → menawarkan CTA di sana = memancing pemilik ke jalan buntu.
    expect(activationCtaFor("active")).toBeNull();
    expect(activationCtaFor("suspended")).toBeNull();
  });

  it("himpunan ber-CTA sama persis dengan gerbang pembayaran", () => {
    // Menjaga dua daftar yang sengaja dipisah tetap selaras: menambah label CTA
    // tak boleh melebarkan gerbang uang, dan status yang bisa dibayar tak boleh
    // kehilangan jalan masuknya di UI.
    const berCta = SEMUA_STATUS.filter((s) => activationCtaFor(s) !== null);
    expect([...berCta].sort()).toEqual([...PAYABLE_STATUSES].sort());
  });

  it("undangan yang datanya sudah dihapus permanen TIDAK ditawari perpanjangan", () => {
    // `purged_at` = foto/tamu/ucapan sudah dihapus cron retensi. Menawarkan
    // bayar di sini berarti menjual kembali undangan yang isinya tiada.
    const purged = "2026-01-05T00:00:00.000Z";
    for (const status of SEMUA_STATUS) {
      expect(activationCtaFor(status, purged)).toBeNull();
    }
    // Tanpa purged, status yang sama tetap menawarkan perpanjangan.
    expect(activationCtaFor("expired", null)).toBe("renew");
  });

  it("gerbang upgrade dan gerbang pembayaran TIDAK PERNAH beririsan", () => {
    // Invarian UANG, bukan kerapian (AUDIT-2026-10-01 B3): kedua jalur menagih
    // nominal berbeda untuk paket yang sama — harga penuh vs selisih harga.
    // Satu status yang masuk ke keduanya berarti pelanggan bisa memilih jalur
    // yang lebih murah untuk hasil yang sama: `active` di `PAYABLE_STATUSES`
    // akan menagih dua kali, dan `expired`/`draft` di `UPGRADABLE_STATUSES`
    // akan menjual masa aktif penuh seharga selisihnya.
    const irisan = [...UPGRADABLE_STATUSES].filter((s) =>
      PAYABLE_STATUSES.has(s),
    );
    expect(irisan).toEqual([]);
  });

  it("hanya undangan yang masa aktifnya berjalan boleh di-upgrade", () => {
    expect([...UPGRADABLE_STATUSES]).toEqual(["active"]);
    // `expired` sengaja DI LUAR: Premium tanpa masa aktif tak bernilai, dan
    // perpanjangan sudah menjadi jalannya (harga penuh + periode baru).
    expect(UPGRADABLE_STATUSES.has("expired")).toBe(false);
    expect(UPGRADABLE_STATUSES.has("draft")).toBe(false);
    expect(UPGRADABLE_STATUSES.has("suspended")).toBe(false);
  });

  it("label CTA persis seperti yang dijanjikan & cukup pendek untuk bar 360px", () => {
    const label: Record<ActivationCta, string> = copy.preview.activateCta;
    expect(label).toEqual({
      activate: "Aktifkan",
      pay: "Bayar",
      renew: "Perpanjang",
    });
    // Alasan tertulis di copy.ts: bar pratinjau harus tetap muat di ponsel.
    for (const teks of Object.values(label)) {
      expect(teks.length).toBeLessThanOrEqual(12);
    }
  });
});

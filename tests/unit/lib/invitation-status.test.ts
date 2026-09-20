import { describe, expect, it } from "vitest";

import {
  activationCtaFor,
  PAYABLE_STATUSES,
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

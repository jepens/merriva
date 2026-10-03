import { describe, expect, it } from "vitest";

import { CRON_JOBS, hitungHealth } from "@/server/cron/status";

/**
 * Kesehatan scheduled job (AUDIT-2026-10-01).
 *
 * Yang dijaga di sini bukan "job gagal terdeteksi" — itu bagian mudah — tetapi
 * **job yang BERHENTI JALAN sama sekali**. Cron yang dihapus dari panel
 * Easypanel, salah ketik perintahnya, atau mati setelah redeploy tidak mengirim
 * galat apa pun; ia hanya diam. Sebelum ini tak ada satu pun cara mengetahuinya,
 * padahal `purge-expired` memegang retensi UU PDP dan `expire-orders` memegang
 * rekonsiliasi pembayaran.
 */

const JAM = 3_600_000;
const NOW = Date.parse("2026-10-04T12:00:00.000Z");

const baris = (umurJam: number, ok = true) => ({
  last_run_at: new Date(NOW - umurJam * JAM).toISOString(),
  ok,
});

describe("hitungHealth", () => {
  it("tak ada barisnya → BELUM PERNAH jalan, bukan dianggap sehat", () => {
    // Job yang belum pernah dipasang di panel Easypanel sama berbahayanya
    // dengan job yang mati — dan inilah keadaan setiap job hari pertama.
    expect(hitungHealth(undefined, "purge-expired", NOW)).toBe("belum-pernah");
  });

  it("baru saja jalan dan sukses → sehat", () => {
    expect(hitungHealth(baris(0.5), "expire-orders", NOW)).toBe("ok");
    expect(hitungHealth(baris(2), "purge-expired", NOW)).toBe("ok");
  });

  it("jalan tapi gagal → gagal, bukan sehat", () => {
    expect(hitungHealth(baris(1, false), "purge-expired", NOW)).toBe("gagal");
  });

  it("melewati DUA kali jadwalnya → basi", () => {
    // expire-orders dijadwalkan tiap jam.
    expect(hitungHealth(baris(3), "expire-orders", NOW)).toBe("basi");
    // purge-expired harian → basi setelah 48 jam.
    expect(hitungHealth(baris(49), "purge-expired", NOW)).toBe("basi");
  });

  it("satu kali lewat jadwal BELUM dianggap basi", () => {
    // Jitter penjadwal atau redeploy yang kebetulan bertepatan tak boleh
    // memerahkan panel — alarm yang terlalu sering berakhir diabaikan.
    expect(hitungHealth(baris(1.5), "expire-orders", NOW)).toBe("ok");
    expect(hitungHealth(baris(30), "purge-expired", NOW)).toBe("ok");
  });

  it("basi MENGALAHKAN sukses terakhir — job mati tak boleh tampak hijau", () => {
    // Inti temuannya: `ok: true` dari jalan terakhir yang berhasil TIGA hari
    // lalu tidak berarti job itu masih hidup.
    expect(hitungHealth(baris(100, true), "purge-expired", NOW)).toBe("basi");
  });

  it("ambang per-job mengikuti jadwalnya masing-masing", () => {
    // 3 jam: basi untuk job per-jam, sehat untuk job harian.
    expect(hitungHealth(baris(3), "expire-orders", NOW)).toBe("basi");
    expect(hitungHealth(baris(3), "expiry-reminders", NOW)).toBe("ok");
  });

  it("keempat job terdaftar — tak ada yang luput dari panel", () => {
    expect([...CRON_JOBS].sort()).toEqual([
      "expire-invitations",
      "expire-orders",
      "expiry-reminders",
      "purge-expired",
    ]);
  });
});

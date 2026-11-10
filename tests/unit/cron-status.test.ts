import { describe, expect, it } from "vitest";

import { CRON_JOBS, hitungHealth } from "@/server/cron/status";

/**
 * Kesehatan scheduled job (AUDIT-2026-10-01).
 *
 * Yang dijaga di sini bukan "job gagal terdeteksi" — itu bagian mudah — tetapi
 * **job yang BERHENTI JALAN sama sekali**. Cron yang dihapus dari crontab
 * host, salah ketik perintahnya, atau hilang saat VPS dibangun ulang tidak mengirim
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
    // Job yang belum pernah dipasang di crontab host sama berbahayanya
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
    // purge-expired tiap 12 jam (ia juga mengirim peringatan pra-purge, B7) →
    // basi setelah 24 jam. expire-invitations harian → basi setelah 48 jam.
    expect(hitungHealth(baris(25), "purge-expired", NOW)).toBe("basi");
    expect(hitungHealth(baris(49), "expire-invitations", NOW)).toBe("basi");
  });

  it("satu kali lewat jadwal BELUM dianggap basi", () => {
    // Jitter penjadwal atau redeploy yang kebetulan bertepatan tak boleh
    // memerahkan panel — alarm yang terlalu sering berakhir diabaikan.
    expect(hitungHealth(baris(1.5), "expire-orders", NOW)).toBe("ok");
    expect(hitungHealth(baris(30), "expire-invitations", NOW)).toBe("ok");
  });

  it("basi MENGALAHKAN sukses terakhir — job mati tak boleh tampak hijau", () => {
    // Inti temuannya: `ok: true` dari jalan terakhir yang berhasil TIGA hari
    // lalu tidak berarti job itu masih hidup.
    expect(hitungHealth(baris(100, true), "purge-expired", NOW)).toBe("basi");
  });

  it("ambang per-job mengikuti jadwalnya masing-masing", () => {
    // 3 jam: basi untuk job per-jam, sehat untuk job ber-kadens 12/24 jam.
    expect(hitungHealth(baris(3), "expire-orders", NOW)).toBe("basi");
    expect(hitungHealth(baris(3), "expiry-reminders", NOW)).toBe("ok");
  });

  it("expiry-reminders dijadwalkan 12 jam — SAMA alasannya dgn purge-expired", () => {
    // Angka ini pernah 24 di sini sementara docstring route-nya menuntut ≤12
    // jam, dan LAUNCH-CHECKLIST menulis "harian": pemilik yang mengikuti
    // checklist memasang kadens yang kode sendiri sebut berisiko pengingat
    // ganda. "Tandai hanya saat terkirim" bersifat at-least-once, dan satu-
    // satunya penjaga kirim-ganda adalah `idempotencyKey` Resend yang hanya
    // berlaku 24 jam.
    expect(hitungHealth(baris(20), "expiry-reminders", NOW)).toBe("ok");
    expect(hitungHealth(baris(25), "expiry-reminders", NOW)).toBe("basi");
  });

  it("purge-expired dijadwalkan 12 jam, bukan 24 — ia juga mengirim email", () => {
    // Job ini kini mengirim peringatan pra-purge (B7), dan `idempotencyKey`
    // Resend hanya berlaku 24 jam: kadens di bawah itu mencegah peringatan
    // ganda bila penandaan gagal setelah email terkirim. Angka ini HARUS sama
    // dengan perintah cron di crontab host (LAUNCH-CHECKLIST Fase 3) —
    // kalau tidak, panel admin menuduh job yang sehat.
    expect(hitungHealth(baris(20), "purge-expired", NOW)).toBe("ok");
    expect(hitungHealth(baris(25), "purge-expired", NOW)).toBe("basi");
  });

  it("kelima job terdaftar — tak ada yang luput dari panel", () => {
    expect([...CRON_JOBS].sort()).toEqual([
      "backup-media",
      "expire-invitations",
      "expire-orders",
      "expiry-reminders",
      "purge-expired",
    ]);
  });

  it("backup-media harian: basi setelah dua snapshot terlewat (48 jam)", () => {
    // DECISIONS #117 — snapshot 20:30 UTC. Satu malam yang tersendat (redeploy,
    // gangguan R2) belum alarm; dua malam berturut-turut sudah.
    expect(hitungHealth(baris(47), "backup-media", NOW)).toBe("ok");
    expect(hitungHealth(baris(49), "backup-media", NOW)).toBe("basi");
  });
});

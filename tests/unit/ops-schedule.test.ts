import { describe, expect, it } from "vitest";

import { CRON_JOBS, hitungHealth } from "@/server/cron/status";

// Modul `.mjs` polos — sengaja JS, bukan TS, supaya `node scripts/ops-verify.mjs`
// bisa dijalankan tanpa langkah build (pola yang sama dengan `theme-scaffold.mjs`).
import { FAKTOR_BASI, JADWAL_JAM } from "@/../scripts/ops-schedule.mjs";

/**
 * `pnpm ops:verify` menilai cron BASI dengan jadwalnya sendiri, sedangkan panel
 * admin memakai `JADWAL_JAM` di `src/server/cron/status.ts` yang private di
 * modul `server-only`. Dua salinan angka yang sama akan menyimpang pada hari
 * salah satunya diubah — dan menyimpangnya SENYAP di kedua arah: verifikator
 * yang terlalu longgar membiarkan cron mati tanpa suara, yang terlalu ketat
 * memerahkan job sehat sampai orang berhenti mempercayainya.
 *
 * Test ini tidak membandingkan salinan dengan salinan. Ia menanyai
 * `hitungHealth` yang SESUNGGUHNYA di tepi ambangnya, jadi yang diuji adalah
 * perilaku yang dipakai panel — bukan konstanta yang kebetulan sama.
 */

const NOW = Date.parse("2026-10-15T00:00:00Z");
const JAM = 3_600_000;

/** Baris `cron_runs` yang terakhir jalan `umurJam` jam lalu, sukses. */
function baris(umurJam: number) {
  return { last_run_at: new Date(NOW - umurJam * JAM).toISOString(), ok: true };
}

describe("jadwal ops:verify sejalan dengan panel admin", () => {
  it("nama job-nya sama persis — tak ada yang luput atau berlebih", () => {
    expect(Object.keys(JADWAL_JAM).sort()).toEqual([...CRON_JOBS].sort());
  });

  it.each(CRON_JOBS)("%s: ambang basi di kedua sisi sama", (name) => {
    const jam = (JADWAL_JAM as Record<string, number>)[name];
    expect(jam).toBeGreaterThan(0);

    const ambang = jam * FAKTOR_BASI;

    // Sedikit DI BAWAH ambang masih sehat...
    expect(hitungHealth(baris(ambang - 0.5), name, NOW)).toBe("ok");
    // ...sedikit DI ATAS ambang sudah basi.
    expect(hitungHealth(baris(ambang + 0.5), name, NOW)).toBe("basi");
  });

  it("FAKTOR_BASI benar-benar 2x, bukan angka lain yang kebetulan lolos", () => {
    // Bila panel kelak memakai 3x sementara skrip tetap 2x, `it.each` di atas
    // masih bisa lolos untuk job berjadwal pendek karena pembulatan jam. Butir
    // ini mengunci faktornya lewat job berjadwal TERPANJANG, tempat selisih
    // 2x vs 3x paling lebar.
    const terpanjang = CRON_JOBS.reduce((a, b) =>
      (JADWAL_JAM as Record<string, number>)[a] >=
      (JADWAL_JAM as Record<string, number>)[b]
        ? a
        : b,
    );
    const jam = (JADWAL_JAM as Record<string, number>)[terpanjang];

    // Tepat di antara 2x dan 3x: basi menurut aturan 2x, sehat menurut 3x.
    expect(hitungHealth(baris(jam * 2.5), terpanjang, NOW)).toBe("basi");
    expect(FAKTOR_BASI).toBe(2);
  });
});

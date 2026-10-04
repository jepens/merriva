import { describe, expect, it } from "vitest";

import {
  bolehPurge,
  daysUntilPurge,
  dueWithinIso,
  purgeDueMs,
  retentionCutoffIso,
  tahapPeringatan,
} from "@/server/cron/retention";

/**
 * Aritmetika retensi + penjadwalan peringatan pra-purge (AUDIT-2026-10-01 B7).
 *
 * Yang dijaga di sini bukan tanggalnya, melainkan DUA JANJI yang saling tarik:
 *  - data pribadi tak boleh dihapus permanen tanpa peringatan yang terkirim
 *    (`/syarat`, `/privasi`);
 *  - tetapi pipeline email yang rusak tak boleh menahan kewajiban retensi
 *    selamanya — menyimpan data melewati batas adalah pelanggaran yang
 *    berlawanan arah. Karena itu ada `backstop`.
 */

const hari = (iso: string) => new Date(iso);

describe("aritmetika cutoff", () => {
  it("cutoff = 6 bulan kalender sebelum now (UTC)", () => {
    expect(retentionCutoffIso(hari("2027-01-15T00:00:00.000Z"))).toBe(
      "2026-07-15T00:00:00.000Z",
    );
  });

  it("`dueWithinIso` memakai fungsi cutoff yang SAMA, digeser ke depan", () => {
    // Inti rancangannya: peringatan dan purge mustahil bergeser satu terhadap
    // yang lain karena keduanya memakai satu garis yang sama.
    const now = hari("2027-01-15T00:00:00.000Z");
    expect(dueWithinIso(now, 0)).toBe(retentionCutoffIso(now));
    expect(dueWithinIso(now, 30)).toBe(
      retentionCutoffIso(hari("2027-02-14T00:00:00.000Z")),
    );
  });

  it("tanggal purge TIDAK dihitung dengan menambah 6 bulan — penjumlahan tak simetris", () => {
    // 31 Agustus − 6 bulan meluber ke 3 Maret; 3 Maret + 6 bulan = 3 September,
    // bukan 31 Agustus. `purgeDueMs` MENCARI hari pertama yang jatuh tempo
    // menurut fungsi cutoff, bukan menebaknya lewat penjumlahan.
    const au = "2026-08-31T00:00:00.000Z";
    const due = purgeDueMs(au);
    expect(due).not.toBeNull();
    // Hari itu benar-benar jatuh tempo…
    expect(
      Date.parse(retentionCutoffIso(new Date(due as number))),
    ).toBeGreaterThan(Date.parse(au));
    // …dan sehari sebelumnya BELUM.
    expect(
      Date.parse(retentionCutoffIso(new Date((due as number) - 86_400_000))),
    ).toBeLessThanOrEqual(Date.parse(au));
  });

  it("sisa hari minimal 1 — tak pernah berbunyi `0 hari lagi`", () => {
    const au = "2026-01-01T00:00:00.000Z";
    const due = purgeDueMs(au) as number;
    expect(daysUntilPurge(au, due)).toBe(1);
    expect(daysUntilPurge(au, due + 10 * 86_400_000)).toBe(1);
    expect(daysUntilPurge(au, due - 7 * 86_400_000)).toBe(7);
  });
});

describe("tahap peringatan", () => {
  const now = hari("2027-01-15T00:00:00.000Z");
  /** Jatuh tempo persis `d` hari lagi (sedikit di dalam ambangnya). */
  const jatuhTempoDalam = (d: number) =>
    new Date(Date.parse(dueWithinIso(now, d)) - 60_000).toISOString();

  const baris = (
    au: string,
    w: string | null = null,
    f: string | null = null,
  ) => ({
    active_until: au,
    purge_warned_at: w,
    purge_final_warned_at: f,
  });

  it("masih jauh dari jatuh tempo → belum diperingatkan sama sekali", () => {
    expect(tahapPeringatan(baris(jatuhTempoDalam(90)), now)).toBeNull();
  });

  it("masuk jendela 30 hari → peringatan pertama", () => {
    expect(tahapPeringatan(baris(jatuhTempoDalam(25)), now)).toBe("first");
  });

  it("masuk jendela 7 hari → peringatan FINAL, bukan yang pertama", () => {
    // Baris yang masuk antrean terlambat (cron mati beberapa hari, atau rilis
    // pertama fitur ini) tak boleh menerima "30 hari lagi" padahal sisanya 3.
    expect(tahapPeringatan(baris(jatuhTempoDalam(3)), now)).toBe("final");
  });

  it("satu run tak pernah mengirim DUA email untuk baris yang sama", () => {
    // Baris di jendela final yang belum pernah diperingatkan sama sekali hanya
    // menghasilkan `final` — bukan `first` lalu `final`.
    const r = baris(jatuhTempoDalam(3));
    expect(tahapPeringatan(r, now)).toBe("final");
    const sesudah = { ...r, purge_final_warned_at: now.toISOString() };
    expect(tahapPeringatan(sesudah, now)).toBeNull();
  });

  it("penanda siklus BERJALAN membungkam; penanda siklus LAMA tidak", () => {
    const au = jatuhTempoDalam(25);
    // Ditulis SESUDAH active_until → siklus ini, sudah diperingatkan.
    const segar = new Date(Date.parse(au) + 86_400_000).toISOString();
    expect(tahapPeringatan(baris(au, segar), now)).toBeNull();
    // Ditulis SEBELUM active_until → sisa siklus lama; perpanjangan memajukan
    // `active_until` sehingga penanda lama otomatis basi, TANPA satu pun RPC
    // perlu me-resetnya (DECISIONS #65: reset yang harus diingat membusuk).
    const basi = new Date(Date.parse(au) - 86_400_000).toISOString();
    expect(tahapPeringatan(baris(au, basi), now)).toBe("first");
  });

  it("penanda PERTAMA tak membungkam peringatan FINAL", () => {
    const au = jatuhTempoDalam(3);
    const segar = new Date(Date.parse(au) + 86_400_000).toISOString();
    // Sudah dapat H-30 di siklus ini, tetapi H-7 belum → tetap kirim.
    expect(tahapPeringatan(baris(au, segar, null), now)).toBe("final");
  });

  it("`active_until` tak terbaca → diam, bukan menebak", () => {
    expect(tahapPeringatan(baris("bukan tanggal"), now)).toBeNull();
  });
});

describe("gerbang purge", () => {
  const now = hari("2027-01-15T00:00:00.000Z");
  const jatuhTempoDalam = (d: number) =>
    new Date(Date.parse(dueWithinIso(now, d)) - 60_000).toISOString();

  it("belum pernah diperingatkan → TUNGGU, jangan hapus", () => {
    // Janji `/syarat` & `/privasi`: tak ada penghapusan permanen tanpa
    // peringatan lebih dulu.
    const au = jatuhTempoDalam(-1);
    expect(
      bolehPurge({ active_until: au, purge_final_warned_at: null }, now),
    ).toBe("tunggu-peringatan");
  });

  it("baru saja diperingatkan → TUNGGU, beri waktu menindaklanjuti", () => {
    const au = jatuhTempoDalam(-1);
    const kemarin = new Date(now.getTime() - 86_400_000).toISOString();
    expect(
      bolehPurge({ active_until: au, purge_final_warned_at: kemarin }, now),
    ).toBe("tunggu-peringatan");
  });

  it("peringatan final sudah lewat jedanya → HAPUS", () => {
    const au = jatuhTempoDalam(-10);
    const lama = new Date(now.getTime() - 8 * 86_400_000).toISOString();
    expect(
      bolehPurge({ active_until: au, purge_final_warned_at: lama }, now),
    ).toBe("ya");
  });

  it("penanda dari siklus LAMA tak dihitung sebagai peringatan", () => {
    // Kalau tidak, satu peringatan dari siklus sebelumnya akan meloloskan
    // penghapusan siklus ini — peringatan untuk penghapusan yang tak pernah
    // terjadi.
    const au = jatuhTempoDalam(-1);
    const sebelumSiklus = new Date(Date.parse(au) - 86_400_000).toISOString();
    expect(
      bolehPurge(
        { active_until: au, purge_final_warned_at: sebelumSiklus },
        now,
      ),
    ).toBe("tunggu-peringatan");
  });

  it("jauh lewat jatuh tempo → BACKSTOP, retensi tak boleh tertahan selamanya", () => {
    // Pipeline email rusak tak boleh menahan kewajiban UU PDP. Menyimpan data
    // melewati batas adalah pelanggaran yang berlawanan arah.
    const au = jatuhTempoDalam(-30);
    expect(
      bolehPurge({ active_until: au, purge_final_warned_at: null }, now),
    ).toBe("backstop");
  });

  it("`active_until` tak terbaca → backstop, jangan tertahan tanpa batas", () => {
    expect(
      bolehPurge(
        { active_until: "bukan tanggal", purge_final_warned_at: null },
        now,
      ),
    ).toBe("backstop");
  });
});

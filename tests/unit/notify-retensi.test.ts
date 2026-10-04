import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `sendPurgeWarning` + `sendExpiredNotice` — dua email siklus retensi
 * (AUDIT-2026-10-01 B7).
 *
 * `cron-retention.test.ts` menguji aritmetikanya; yang diuji DI SINI adalah
 * lapisan di atasnya, tempat angka berubah menjadi email:
 *
 *  - dua email menyebut SATU tanggal purge. "Data dihapus 19 April" di notis
 *    kedaluwarsa dan "19 April" di peringatan pra-purge harus berasal dari
 *    perhitungan yang sama, bukan dari dua tanggal yang kebetulan dekat;
 *  - tanggal ditampilkan dalam zona Asia/Jakarta. Pemilik di WIB yang dibacakan
 *    tanggal UTC akan membaca tenggat yang salah satu hari;
 *  - `idempotencyKey` membedakan hal yang HARUS dikirim dua kali (tahap H-30 vs
 *    H-7; siklus kedaluwarsa yang berbeda) — kunci yang sama membuat Resend
 *    menelan kiriman kedua tanpa galat apa pun;
 *  - telemetri tak pernah memuat alamat email, nama pemilik, atau `slug`.
 *
 * `sendPurgeWarning` sendiri belum punya test saat fiturnya dirilis — berkas ini
 * juga menutup celah itu.
 */

const { sendTransactionalEmail, reportHandledError } = vi.hoisted(() => ({
  sendTransactionalEmail: vi.fn(),
  reportHandledError: vi.fn(),
}));
vi.mock("@/lib/email/send", () => ({ sendTransactionalEmail }));
vi.mock("@/lib/observability", () => ({ reportHandledError }));

import { copy } from "@/lib/copy";
import { sendExpiredNotice, sendPurgeWarning } from "@/server/email/notify";

const USER = "55555555-5555-4555-8555-555555555555";
const INV = "44444444-4444-4444-8444-444444444444";
const EMAIL = "pemilik@contoh.test";
const NAMA = "Andi Prasetyo";
const SLUG = "andi-sinta";
/** 18 Okt 2026 07.00 WIB — sengaja bukan tengah malam UTC. */
const AKTIF_SAMPAI = "2026-10-18T00:00:00.000Z";

interface Keadaan {
  profiles: { data: unknown; error: unknown };
  auth: { data: unknown; error: unknown };
}

let k: Keadaan;

function adminClient() {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.maybeSingle = () => Promise.resolve(k.profiles);
  return {
    from: vi.fn(() => chain),
    auth: { admin: { getUserById: vi.fn(() => Promise.resolve(k.auth)) } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  k = {
    profiles: { data: { full_name: NAMA }, error: null },
    auth: { data: { user: { email: EMAIL } }, error: null },
  };
  sendTransactionalEmail.mockResolvedValue({ status: "sent", id: "em_1" });
});

const kiriman = () => sendTransactionalEmail.mock.calls[0]?.[0];
const laporan = () => reportHandledError.mock.calls;

const NOW = Date.parse("2027-04-12T00:00:00.000Z");

const peringatkan = (final = false, now = NOW, activeUntil = AKTIF_SAMPAI) =>
  sendPurgeWarning(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adminClient() as any,
    { id: INV, slug: SLUG, user_id: USER, active_until: activeUntil, final },
    now,
  );

const kabarkanKedaluwarsa = (activeUntil = AKTIF_SAMPAI) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendExpiredNotice(adminClient() as any, {
    id: INV,
    slug: SLUG,
    user_id: USER,
    active_until: activeUntil,
  });

describe("satu tanggal purge untuk dua email", () => {
  it("notis kedaluwarsa dan peringatan pra-purge menyebut tanggal yang SAMA", async () => {
    // Keduanya memanggil `purgeDueMs`. Bila salah satu kelak dihitung dengan
    // `active_until + 6 bulan`, test ini yang jatuh — penjumlahan TIDAK simetris
    // dengan pengurangan yang dipakai purge (DECISIONS #67).
    await kabarkanKedaluwarsa();
    const notis = kiriman()?.text as string;
    sendTransactionalEmail.mockClear();
    await peringatkan(false);
    const warning = kiriman()?.text as string;

    const tanggal = /(\d{1,2} \w+ 2027)/.exec(warning)?.[1];
    expect(tanggal).toBeTruthy();
    expect(notis).toContain(tanggal as string);
  });

  it("tanggal dibacakan dalam WIB, bukan UTC", async () => {
    // 17.30 UTC = 00.30 WIB hari BERIKUTNYA. Tanpa `timeZone: "Asia/Jakarta"`
    // pemilik membaca tenggat yang salah satu hari.
    await kabarkanKedaluwarsa("2026-10-18T17:30:00.000Z");
    expect(kiriman()?.text).toContain("19 Oktober 2026");
  });

  it("notis kedaluwarsa memakai tanggal berakhirnya, bukan hari ini", async () => {
    await kabarkanKedaluwarsa();
    expect(kiriman()?.text).toContain("18 Oktober 2026");
  });
});

describe("sendPurgeWarning", () => {
  it("tahap pertama dan tahap final memakai idempotencyKey BERBEDA", async () => {
    // Kunci yang sama = Resend menelan peringatan H-7 karena H-30 sudah memakai
    // kuncinya, tanpa satu pun galat yang terlihat.
    await peringatkan(false);
    const pertama = kiriman()?.idempotencyKey;
    sendTransactionalEmail.mockClear();
    await peringatkan(true);
    expect(kiriman()?.idempotencyKey).not.toBe(pertama);
  });

  it("subjek mengikuti SISA HARI, bukan nama tahapnya", async () => {
    // Properti yang disengaja: "H-30" dan "H-7" adalah nama tahap, bukan isi
    // email. Baris yang masuk antrean terlambat — cron mati beberapa hari, atau
    // rilis pertama fitur ini — tak boleh mengaku "30 hari" saat sisanya tiga.
    // Karena itu tahap `first` dengan sisa 3 hari berbunyi "3 hari", dan dua
    // tahap dengan sisa hari yang sama memang bersubjek identik.
    await peringatkan(false, Date.parse("2027-04-16T00:00:00.000Z"));
    expect(kiriman()?.subject).toContain("3 hari lagi");

    sendTransactionalEmail.mockClear();
    await peringatkan(false, Date.parse("2027-03-01T00:00:00.000Z"));
    expect(kiriman()?.subject).toContain("49 hari lagi");
  });

  it("tahap final mengubah URUTAN tombol dan penutupnya", async () => {
    // Yang dibedakan `final` bukan subjeknya melainkan jalan keluar yang
    // didahulukan: pada H-30 memperpanjang masih wajar dipikirkan, pada H-7
    // menyelamatkan datanya jauh lebih realistis daripada memutuskan membeli.
    const w = copy.email.purgeWarning;
    await peringatkan(false);
    const pertama = kiriman()?.html as string;
    sendTransactionalEmail.mockClear();
    await peringatkan(true);
    const final = kiriman()?.html as string;

    // Yang diperiksa URUTANNYA, bukan gayanya: menebak selector tombol dari
    // HTML inline rapuh, sedangkan "mana yang disebut lebih dulu" adalah
    // persis keputusan yang sedang dijaga.
    // KEDUA label wajib ada lebih dulu. Tanpa cek itu `indexOf` yang
    // mengembalikan -1 membuat perbandingannya kebetulan menjawab benar —
    // dan email yang kehilangan salah satu jalan keluar lolos sebagai lulus.
    const duluan = (html: string) => {
      const a = html.indexOf(w.ctaPerpanjang);
      const b = html.indexOf(w.ctaUnduh);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeGreaterThanOrEqual(0);
      return a < b ? "perpanjang" : "unduh";
    };
    expect(duluan(pertama)).toBe("perpanjang");
    expect(duluan(final)).toBe("unduh");
    expect(pertama).toContain(w.outroPertama);
    expect(final).toContain(w.outroFinal);
  });

  it("menyebut sisa hari yang sebenarnya, tak pernah `0 hari`", async () => {
    // `now` di sini SUDAH lewat tanggal purge (12 April vs 19 April 2027 → 7
    // hari). Baris yang masuk antrean terlambat tak boleh berbunyi "0 hari lagi".
    await peringatkan(true);
    expect(kiriman()?.subject).not.toContain("0 hari");
    expect(kiriman()?.text).not.toContain("0 hari");
  });

  it("pemilik tanpa alamat email → `nodata`, tak ada yang dikirim", async () => {
    k.auth = { data: { user: {} }, error: null };
    expect(await peringatkan()).toBe("nodata");
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("Resend gagal → `error`, dilaporkan dengan id UNDANGAN saja", async () => {
    sendTransactionalEmail.mockResolvedValue({
      status: "error",
      code: "rate_limit_exceeded",
      statusCode: 429,
    });

    expect(await peringatkan()).toBe("error");

    const [err, area, extra] = laporan()[0];
    expect((err as Error).message).toBe("resend:rate_limit_exceeded");
    expect(area).toBe("email.purge-warning");
    expect(extra).toMatchObject({ invitationId: INV, statusCode: 429 });
  });

  it("lemparan tak terduga → `error`, bukan melempar keluar", async () => {
    sendTransactionalEmail.mockRejectedValue(new Error("jaringan putus"));
    await expect(peringatkan()).resolves.toBe("error");
  });
});

describe("sendExpiredNotice", () => {
  it("subjek menyebut slug undangannya", async () => {
    await kabarkanKedaluwarsa();
    expect(kiriman()?.subject).toBe(copy.email.expired.subject(SLUG));
  });

  it("siklus berbeda → idempotencyKey berbeda", async () => {
    // Undangan yang diperpanjang lalu kedaluwarsa lagi BERHAK atas notis kedua.
    // `active_until` bergeser maju setiap perpanjangan, jadi ia penanda siklus
    // yang sudah tersedia tanpa kolom tambahan.
    await kabarkanKedaluwarsa();
    const siklus1 = kiriman()?.idempotencyKey;
    sendTransactionalEmail.mockClear();
    await kabarkanKedaluwarsa("2027-10-18T00:00:00.000Z");
    expect(kiriman()?.idempotencyKey).not.toBe(siklus1);
  });

  it("mengatakan apa yang DILIHAT TAMU sekarang", async () => {
    // Fakta paling mengagetkan bagi pemilik, dan sebelum B7 ia harus
    // menemukannya sendiri — atau dikabari tamunya.
    await kabarkanKedaluwarsa();
    expect(kiriman()?.text).toContain("Tamu");
  });

  it("menegaskan datanya masih tersimpan — ini BUKAN email penghapusan", async () => {
    await kabarkanKedaluwarsa();
    const text = kiriman()?.text as string;
    expect(text).toContain("tetap tersimpan");
    expect(text).not.toContain("dihapus permanen");
  });

  it("pemilik tanpa alamat email → `nodata`, tanpa laporan palsu", async () => {
    k.auth = { data: { user: {} }, error: null };
    expect(await kabarkanKedaluwarsa()).toBe("nodata");
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("pencarian akun gagal → `nodata`, TETAPI dilaporkan", async () => {
    k.auth = { data: null, error: { message: "auth down" } };
    expect(await kabarkanKedaluwarsa()).toBe("nodata");
    expect(laporan()[0]?.[1]).toBe("email.expired-notice");
  });

  it("Resend gagal → `error` dengan kode galatnya", async () => {
    sendTransactionalEmail.mockResolvedValue({
      status: "error",
      code: "validation_error",
      statusCode: 422,
    });

    expect(await kabarkanKedaluwarsa()).toBe("error");

    const [err, area, extra] = laporan()[0];
    expect((err as Error).message).toBe("resend:validation_error");
    expect(area).toBe("email.expired-notice");
    expect(extra).toMatchObject({ invitationId: INV });
  });

  it("lemparan tak terduga → `error`, cron tetap jalan", async () => {
    sendTransactionalEmail.mockRejectedValue(new Error("jaringan putus"));
    await expect(kabarkanKedaluwarsa()).resolves.toBe("error");
  });
});

describe("tak ada PII di telemetri", () => {
  it.each([
    ["peringatan pra-purge", () => peringatkan()],
    ["notis kedaluwarsa", () => kabarkanKedaluwarsa()],
  ])("%s: alamat email, nama, dan slug tak pernah ikut", async (_n, kirim) => {
    sendTransactionalEmail.mockResolvedValue({
      status: "error",
      code: "validation_error",
      statusCode: 422,
    });

    await kirim();

    const jejak = JSON.stringify(laporan());
    expect(jejak).not.toContain(EMAIL);
    expect(jejak).not.toContain(NAMA);
    expect(jejak).not.toContain(SLUG);
  });
});

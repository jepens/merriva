import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `sendSuspendedNotice` + `sendReinstatedNotice` (AUDIT-2026-10-01 B7,
 * DECISIONS #68).
 *
 * Penangguhan adalah satu-satunya tindakan PENEGAKAN di produk ini. Sampai B7 ia
 * berlangsung tanpa sepatah kata pun kepada pemiliknya: halaman publiknya berubah,
 * dan pemilik mengetahuinya dari tamunya sendiri.
 *
 * Yang dijaga di sini — dan urutannya mencerminkan bobotnya:
 *  1. CATATAN INTERNAL TAK PERNAH IKUT. Kolom `reason` ditulis admin untuk admin
 *     dan wajar memuat nama pelapor atau nomor pihak ketiga. Fungsi ini bahkan
 *     tak diberi aksesnya — ia hanya menerima alasan publik sebagai argumen;
 *  2. jalur banding selalu dicetak, termasuk saat alasannya tak ditulis.
 *     Penangguhan tanpa cara membantahnya bukan moderasi;
 *  3. pencabutan penangguhan mengabarkan keadaan yang BENAR: reinstate memulihkan
 *     status dari `active_until`, jadi undangan yang masa aktifnya sudah lewat
 *     tidak langsung tampil lagi.
 */

const { sendTransactionalEmail, reportHandledError } = vi.hoisted(() => ({
  sendTransactionalEmail: vi.fn(),
  reportHandledError: vi.fn(),
}));
vi.mock("@/lib/email/send", () => ({ sendTransactionalEmail }));
vi.mock("@/lib/observability", () => ({ reportHandledError }));

import { copy } from "@/lib/copy";
import {
  sendReinstatedNotice,
  sendSuspendedNotice,
} from "@/server/email/notify";

const USER = "55555555-5555-4555-8555-555555555555";
const INV = "44444444-4444-4444-8444-444444444444";
const EMAIL = "pemilik@contoh.test";
const NAMA = "Andi Prasetyo";
const SLUG = "andi-sinta";
const NOW = Date.parse("2026-10-05T10:00:00.000Z");

/** Teks yang HARUS tetap di dalam tembok admin. */
const INTERNAL = "dilaporkan 3 orang, cek nomor 0812-9999-1111";
const PUBLIK = "Undangan memuat materi yang melanggar ketentuan kami.";

interface Keadaan {
  invitations: { data: unknown; error: unknown };
  profiles: { data: unknown; error: unknown };
  auth: { data: unknown; error: unknown };
}

let k: Keadaan;

function adminClient() {
  const from = (table: string) => {
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.maybeSingle = () =>
      Promise.resolve(table === "invitations" ? k.invitations : k.profiles);
    return chain;
  };
  return {
    from: vi.fn(from),
    auth: { admin: { getUserById: vi.fn(() => Promise.resolve(k.auth)) } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  k = {
    invitations: { data: { slug: SLUG, user_id: USER }, error: null },
    profiles: { data: { full_name: NAMA }, error: null },
    auth: { data: { user: { email: EMAIL } }, error: null },
  };
  sendTransactionalEmail.mockResolvedValue({ status: "sent", id: "em_1" });
});

const kiriman = () => sendTransactionalEmail.mock.calls[0]?.[0];
const laporan = () => reportHandledError.mock.calls;

const tangguhkan = (publicReason: string | null = PUBLIK) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendSuspendedNotice(adminClient() as any, INV, publicReason, NOW);

const pulihkan = (tampilKembali = true) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendReinstatedNotice(adminClient() as any, INV, tampilKembali, NOW);

describe("catatan internal tak bisa ikut", () => {
  it("email memuat alasan PUBLIK, bukan catatan internal", async () => {
    await tangguhkan(PUBLIK);
    const { text, html } = kiriman();
    expect(text).toContain(PUBLIK);
    expect(text).not.toContain(INTERNAL);
    expect(html).not.toContain("0812");
  });

  it("fungsinya tak pernah membaca `admin_logs`", async () => {
    // Pengaman struktural, bukan kehati-hatian: catatan internal tersimpan di
    // `admin_logs.detail`, dan satu-satunya cara teks itu sampai ke pelanggan
    // adalah bila kode ini membacanya. Ia tidak.
    const client = adminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await sendSuspendedNotice(client as any, INV, PUBLIK, NOW);
    const tabel = client.from.mock.calls.map((c) => c[0]);
    expect(tabel).not.toContain("admin_logs");
    expect(tabel).toEqual(["invitations", "profiles"]);
  });
});

describe("jalur banding selalu ada", () => {
  it.each([
    ["alasan ditulis", PUBLIK],
    ["alasan kosong", null],
    ["alasan hanya spasi", "   "],
  ])("%s → alamat banding tercetak di HTML DAN teks", async (_n, alasan) => {
    // Keduanya diperiksa: pelanggan membaca versi HTML, dan bagian banding yang
    // hilang dari HTML saja tak akan terlihat oleh test yang hanya membaca teks.
    await tangguhkan(alasan);
    expect(kiriman()?.text).toContain(copy.support.email);
    expect(kiriman()?.html).toContain(copy.support.email);
    expect(kiriman()?.html).toContain(copy.email.suspended.bandingJudul);
  });

  it("alasan hanya spasi diperlakukan sebagai TIDAK ADA alasan", async () => {
    // Zod sudah menormalkan `"   "` → null lewat `.trim()`, tetapi templatnya
    // juga menjaganya sendiri: ia dipanggil langsung oleh pengirim email, bukan
    // hanya lewat form admin.
    await tangguhkan("   ");
    const text = kiriman()?.text as string;
    expect(text).toContain(copy.email.suspended.alasanKosong);
    expect(text).not.toMatch(/Alasan penangguhan:\s*$/m);
  });

  it("alasan kosong → teks pengganti, bukan bagian yang hilang", async () => {
    // Bagian "Alasan penangguhan" yang kosong akan terbaca seperti email rusak,
    // dan email rusak pada tindakan penegakan menghapus kepercayaan yang
    // dibutuhkan untuk mengajukan banding.
    await tangguhkan(null);
    const text = kiriman()?.text as string;
    expect(text).toContain(copy.email.suspended.alasanJudul);
    expect(text).toContain(copy.email.suspended.alasanKosong);
  });

  it("menegaskan data dan masa aktif tidak dipotong", async () => {
    await tangguhkan();
    expect(kiriman()?.text).toContain(copy.email.suspended.dataAman);
  });

  it("alasan pelanggan DI-ESCAPE di HTML", async () => {
    // Teks bebas isian admin masuk ke dokumen HTML.
    await tangguhkan('<img src=x onerror="alert(1)">');
    const html = kiriman()?.html as string;
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });
});

describe("pencabutan penangguhan", () => {
  it("pulih ke aktif → mengabarkan undangan tampil kembali", async () => {
    await pulihkan(true);
    expect(kiriman()?.text).toContain(copy.email.reinstated.tampil(SLUG));
  });

  it("pulih ke kedaluwarsa → TIDAK mengaku tampil kembali", async () => {
    // Reinstate memulihkan status dari `active_until`. Mengatakan "tampil
    // kembali" untuk undangan yang jadi `expired` adalah keterangan yang salah,
    // dan pemilik akan membuka tautannya lalu menyimpulkan kami berbohong.
    await pulihkan(false);
    const text = kiriman()?.text as string;
    expect(text).toContain(copy.email.reinstated.belumTampil(SLUG));
    expect(text).not.toContain(copy.email.reinstated.tampil(SLUG));
  });

  it("CTA mengikuti keadaan: lihat undangan vs perpanjang", async () => {
    await pulihkan(true);
    expect(kiriman()?.text).toContain(copy.email.reinstated.ctaView);
    sendTransactionalEmail.mockClear();
    await pulihkan(false);
    expect(kiriman()?.text).toContain(copy.email.reinstated.ctaRenew);
  });
});

describe("pencarian pemilik", () => {
  it.each([
    ["penangguhan", () => tangguhkan()],
    ["pencabutan", () => pulihkan()],
  ])("%s: undangan tanpa pemilik → `nodata`, TANPA laporan", async (_n, f) => {
    // Akun dihapus (A6) meninggalkan kerangka undangan ber-`user_id` NULL. Tak
    // ada alamat tujuan, dan itu bukan galat.
    k.invitations = { data: { slug: SLUG, user_id: null }, error: null };
    expect(await f()).toBe("nodata");
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("undangan hilang → `nodata` DAN dilaporkan: barisnya baru saja diubah", async () => {
    k.invitations = { data: null, error: null };
    expect(await tangguhkan()).toBe("nodata");
    expect(laporan()[0]?.[1]).toBe("email.suspended");
  });

  it("pemilik tanpa alamat email → `nodata`", async () => {
    k.auth = { data: { user: {} }, error: null };
    expect(await tangguhkan()).toBe("nodata");
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("nama pemilik tak terbaca → tetap dikirim, sapaan jatuh ke `Halo,`", async () => {
    k.profiles = { data: null, error: null };
    expect(await tangguhkan()).toBe("sent");
    expect(kiriman()?.text).toContain("Halo,");
  });
});

describe("idempotency & kegagalan", () => {
  it("klik ganda dalam menit yang sama → kunci sama", async () => {
    await tangguhkan();
    const a = kiriman()?.idempotencyKey;
    sendTransactionalEmail.mockClear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await sendSuspendedNotice(adminClient() as any, INV, PUBLIK, NOW + 5_000);
    expect(kiriman()?.idempotencyKey).toBe(a);
  });

  it("penangguhan berikutnya (menit lain) → kunci berbeda", async () => {
    // Ditangguhkan → dipulihkan → ditangguhkan lagi berhak atas email kedua.
    await tangguhkan();
    const a = kiriman()?.idempotencyKey;
    sendTransactionalEmail.mockClear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await sendSuspendedNotice(adminClient() as any, INV, PUBLIK, NOW + 120_000);
    expect(kiriman()?.idempotencyKey).not.toBe(a);
  });

  it("penangguhan dan pencabutan memakai kunci berbeda", async () => {
    await tangguhkan();
    const a = kiriman()?.idempotencyKey;
    sendTransactionalEmail.mockClear();
    await pulihkan();
    expect(kiriman()?.idempotencyKey).not.toBe(a);
  });

  it.each([
    ["email.suspended", () => tangguhkan()],
    ["email.reinstated", () => pulihkan()],
  ])("Resend gagal pada %s → `error` + kode galatnya", async (area, f) => {
    sendTransactionalEmail.mockResolvedValue({
      status: "error",
      code: "rate_limit_exceeded",
      statusCode: 429,
    });

    expect(await f()).toBe("error");

    const [err, a, extra] = laporan()[0];
    expect((err as Error).message).toBe("resend:rate_limit_exceeded");
    expect(a).toBe(area);
    expect(extra).toMatchObject({ invitationId: INV, statusCode: 429 });
  });

  it.each([
    ["penangguhan", () => tangguhkan()],
    ["pencabutan", () => pulihkan()],
  ])(
    "%s: lemparan tak terduga → `error`, bukan melempar keluar",
    async (_n, f) => {
      // Aksi admin tak boleh gagal karena email: undangannya SUDAH ditangguhkan.
      sendTransactionalEmail.mockRejectedValue(new Error("jaringan putus"));
      await expect(f()).resolves.toBe("error");
    },
  );
});

describe("tak ada PII di telemetri", () => {
  it.each([
    ["penangguhan", () => tangguhkan()],
    ["pencabutan", () => pulihkan()],
  ])("%s: email, nama, slug, dan alasan tak pernah ikut", async (_n, f) => {
    sendTransactionalEmail.mockResolvedValue({
      status: "error",
      code: "validation_error",
      statusCode: 422,
    });

    await f();

    const jejak = JSON.stringify(laporan());
    expect(jejak).not.toContain(EMAIL);
    expect(jejak).not.toContain(NAMA);
    expect(jejak).not.toContain(SLUG);
    expect(jejak).not.toContain(PUBLIK);
  });
});

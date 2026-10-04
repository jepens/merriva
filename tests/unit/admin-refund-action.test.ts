import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `adminRefundOrderAction` (AUDIT-2026-10-01 A3).
 *
 * Enum `order_status` sudah memuat 'refunded' sejak migrasi awal, tetapi tak
 * ada satu baris kode pun yang pernah menulisnya: /admin/order read-only dan
 * `PaymentGateway` tak punya `refundTransaction`. Akibatnya refund yang
 * disetujui dikerjakan di luar sistem — order tetap 'paid', undangan tetap
 * aktif, jadi pelanggan mendapat uang kembali DAN layanan, dan laporan admin
 * berhenti cocok dengan mutasi rekening.
 *
 * Uangnya memang tetap digerakkan di dashboard Pakasir. Yang diuji di sini
 * adalah bagian yang selama ini hilang: pencatatan + pencabutan layanan.
 */

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { requireAdmin } = vi.hoisted(() => ({
  requireAdmin: vi.fn(async () => ({ id: "admin-1" })),
}));
vi.mock("@/server/guards/auth", () => ({ requireAdmin }));

const { reportHandledError } = vi.hoisted(() => ({
  reportHandledError: vi.fn(),
}));
vi.mock("@/lib/observability", () => ({ reportHandledError }));

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ rpc }),
}));

import { adminRefundOrderAction } from "@/server/actions/admin";

const KODE = "MRV-8F3K2Q";

function form(reason = "pembayaran ganda"): FormData {
  const fd = new FormData();
  fd.set("reason", reason);
  return fd;
}

/** Menjalankan aksi dan mengembalikan tujuan redirect-nya. */
async function jalankan(kode = KODE, fd = form()): Promise<string> {
  try {
    await adminRefundOrderAction(kode, fd);
  } catch (e) {
    return String((e as Error).message).replace("REDIRECT ", "");
  }
  throw new Error("aksi tidak me-redirect");
}

function hasil(result: string) {
  rpc.mockResolvedValue({
    data: [{ result, slug: "andi-sinta" }],
    error: null,
  });
}

beforeEach(() => {
  redirect.mockClear();
  requireAdmin.mockClear();
  reportHandledError.mockClear();
  rpc.mockReset();
  hasil("refunded_revoked");
});

describe("gerbang sebelum RPC", () => {
  it("selalu memeriksa peran admin", async () => {
    await jalankan();
    expect(requireAdmin).toHaveBeenCalledTimes(1);
  });

  it("kode order berbentuk salah → tak pernah menyentuh RPC", async () => {
    const to = await jalankan("bukan-kode");
    expect(to).toContain("refund_failed");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("alasan kosong → ditolak tanpa menyentuh RPC", async () => {
    // Alasan masuk `admin_logs` dan jadi satu-satunya penjelasan kenapa uang
    // bergerak di luar sistem.
    const to = await jalankan(KODE, form("   "));
    expect(to).toContain("refund_invalid");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("kode dinormalkan sebelum dikirim ke RPC", async () => {
    await jalankan(`  ${KODE.toLowerCase()}  `);
    expect(rpc).toHaveBeenCalledWith("admin_refund_order", {
      p_order_code: KODE,
      p_admin_id: "admin-1",
      p_reason: "pembayaran ganda",
    });
  });
});

describe("pemetaan hasil RPC", () => {
  it("undangan dicabut → pesan yang menyebut pencabutannya", async () => {
    hasil("refunded_revoked");
    expect(await jalankan()).toContain("refund_ok_revoked");
  });

  it("refund UPGRADE → pesan sukses yang menyebut penurunan paket, BUKAN gagal", async () => {
    // Ditemukan dengan membaca pemetaan ini setelah cabang `refunded_downgraded`
    // ditambahkan ke RPC (B3): hasil baru yang tak dipetakan jatuh ke
    // `refund_failed`, jadi refundnya BERHASIL di DB sementara admin membaca
    // "gagal". Percobaan kedua menjawab "hanya order Lunas yang bisa direfund",
    // yang terbaca seolah refundnya tak pernah terjadi — dan uang sungguhan
    // dipindahkan manual di dashboard Pakasir berdasarkan bacaan itu.
    hasil("refunded_downgraded");
    expect(await jalankan()).toContain("refund_ok_downgraded");
  });

  it("masih ada order lunas lain → undangan TIDAK dicabut, dan dikatakan", async () => {
    // Pelanggan yang membayar aktivasi lalu memperpanjang, dan hanya salah
    // satunya direfund, tak boleh kehilangan keduanya. Admin harus TAHU itu.
    hasil("refunded_still_paid");
    expect(await jalankan()).toContain("refund_ok_still_paid");
  });

  it("order add-on → album diarsipkan, undangan tak disentuh", async () => {
    hasil("refunded_album_archived");
    expect(await jalankan()).toContain("refund_ok_album");
  });

  it("order tak ada → pesan khusus, bukan 'gagal' generik", async () => {
    hasil("not_found");
    expect(await jalankan()).toContain("refund_not_found");
  });

  it("order belum lunas → ditolak dengan pesannya sendiri", async () => {
    // RPC mengembalikan 'not_paid:<status>' agar statusnya ikut terjejak.
    hasil("not_paid:pending");
    expect(await jalankan()).toContain("refund_not_paid");
  });

  it("hasil tak dikenal → gagal, bukan diam-diam dianggap berhasil", async () => {
    hasil("sesuatu_yang_baru");
    expect(await jalankan()).toContain("refund_failed");
  });

  it("galat RPC → gagal, DAN galat aslinya dilaporkan", async () => {
    const galat = { message: "boom", code: "57014" };
    rpc.mockResolvedValue({ data: null, error: galat });

    expect(await jalankan()).toContain("refund_failed");

    expect(reportHandledError).toHaveBeenCalledWith(galat, "admin.refund", {
      orderCode: KODE,
    });
  });

  it("hasil RPC TAK DIKENAL dilaporkan — inilah detektor bug seperti B3", async () => {
    // `refunded_downgraded` pernah jatuh ke cabang ini dan terbaca "gagal" oleh
    // admin padahal refundnya BERHASIL di DB. Pada aksi yang mendampingi
    // perpindahan uang nyata di dashboard Pakasir, pesan salah itu berisiko
    // refund ganda. TypeScript tak bisa menangkapnya: `result` bertipe `string`.
    hasil("sesuatu_yang_belum_pernah_ada");

    expect(await jalankan()).toContain("refund_failed");

    const [err, area, extra] = reportHandledError.mock.calls[0];
    expect((err as Error).message).toContain("sesuatu_yang_belum_pernah_ada");
    expect(area).toBe("admin.refund.unknown-result");
    expect(extra).toMatchObject({ orderCode: KODE });
  });

  it("alasan refund TIDAK ikut ke telemetri", async () => {
    // Teks bebas isian admin — bisa memuat nama atau alamat email pelanggan.
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    await jalankan(KODE, form("pelanggan budi@contoh.test minta refund"));

    expect(JSON.stringify(reportHandledError.mock.calls)).not.toContain(
      "budi@contoh.test",
    );
  });
});

describe("revalidasi", () => {
  it("halaman undangan publik ikut di-revalidate (ISR)", async () => {
    const { revalidatePath } = await import("next/cache");

    await jalankan();

    // Tanpa ini, undangan yang sudah dicabut tetap tersaji dari cache ISR
    // kepada tamu — pelanggan dapat uangnya kembali dan tamunya tetap melihat
    // undangan aktif.
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/andi-sinta");
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/admin/order");
  });
});

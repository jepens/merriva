import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Order `pending` yang tak punya `txn_id` adalah order yang LINK-nya gagal
 * terbit: `terbitkanLink` (src/server/payment/link.ts) mengembalikan `null` dan
 * pemanggilnya tak pernah mengarahkan pelanggan ke mana pun. Jadi tak ada uang
 * yang bisa hilang di sana — tetapi statusnya yang abadi punya harga sendiri.
 *
 * Pass 2 cron dulu hanya MENGHITUNGNYA lalu `continue`, sehingga barisnya tetap
 * `pending` selamanya. Penahan "jangan buat order kedua" di jalur add-on Album
 * Momen (`findPendingMomenOrder`) dan di jalur upgrade tidak punya batas umur,
 * dan tak satu pun permukaan UI bisa membatalkan order pending. Akibatnya satu
 * galat jaringan Pakasir mengunci pembelian untuk undangan itu secara permanen,
 * sementara halaman kelola terus menampilkan "menunggu pembayaran" atas
 * transaksi yang tak pernah ada.
 *
 * Yang dijaga di sini: order tanpa `txn_id` DI-EXPIRE, tanpa menyentuh Pakasir,
 * dan jalur verifikasi normal TIDAK ikut tertelan.
 */

const { refs } = vi.hoisted(() => ({
  refs: {
    stale: [] as Array<{
      order_code: string;
      amount_idr: number;
      txn_id: string | null;
    }>,
    rpcHasil: "expired" as string,
    rpcPanggilan: [] as Array<{ nama: string; args: unknown }>,
    stats: null as Record<string, number> | null,
  },
}));

vi.mock("@/server/cron/auth", () => ({ isAuthorizedCron: () => true }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/observability", () => ({ reportHandledError: vi.fn() }));
vi.mock("@/server/email/notify", () => ({ notifyOrderPaid: vi.fn() }));
vi.mock("@/server/cron/record", () => ({
  recordCronRun: vi.fn(
    async (_nama: string, _ok: boolean, stats: Record<string, number>) => {
      refs.stats = stats;
    },
  ),
}));

const verifyAndActivate = vi.fn(async () => ({
  kind: "ok" as const,
  result: "held" as const,
  slug: null,
}));
vi.mock("@/server/payment/reconcile", () => ({
  verifyAndActivate: (...a: unknown[]) =>
    (verifyAndActivate as unknown as (...x: unknown[]) => unknown)(...a),
}));

const cancelTransaction = vi.fn(async () => undefined);
vi.mock("@/lib/payment", () => ({
  getPaymentGateway: () => ({ cancelTransaction }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from() {
      // Pass 1 (rekonsiliasi muda) memanggil `.not("txn_id", "is", null)`;
      // pass 2 tidak. Itu satu-satunya pembeda bentuk kueri keduanya.
      let pakaiNot = false;
      const chain: Record<string, unknown> = {};
      for (const op of ["select", "eq", "lt", "gte", "order"]) {
        chain[op] = () => chain;
      }
      chain.not = () => {
        pakaiNot = true;
        return chain;
      };
      chain.limit = () =>
        Promise.resolve(
          pakaiNot
            ? { data: [], error: null }
            : { data: refs.stale, error: null },
        );
      return chain;
    },
    rpc(nama: string, args: unknown) {
      refs.rpcPanggilan.push({ nama, args });
      return Promise.resolve({
        data: [{ result: refs.rpcHasil }],
        error: null,
      });
    },
  }),
}));

import { POST } from "@/app/api/cron/expire-orders/route";

function jalankan() {
  return POST(new Request("https://merriva.id/api/cron/expire-orders"));
}

beforeEach(() => {
  refs.stale = [];
  refs.rpcHasil = "expired";
  refs.rpcPanggilan = [];
  refs.stats = null;
  verifyAndActivate.mockClear();
  cancelTransaction.mockClear();
});

describe("pass 2 — order pending tanpa txn_id", () => {
  it("di-expire, bukan ditinggalkan pending selamanya", async () => {
    refs.stale = [{ order_code: "MRV-AAAA", amount_idr: 199000, txn_id: null }];

    const body = (await (await jalankan()).json()) as Record<string, number>;

    expect(refs.rpcPanggilan).toEqual([
      { nama: "expire_pending_order", args: { p_order_code: "MRV-AAAA" } },
    ]);
    expect(body.expired).toBe(1);
    // Angka diagnostiknya tetap hidup: ia mengukur seberapa sering penerbitan
    // link gagal, dan itu pertanyaan yang berbeda dari "berapa yang dibatalkan".
    expect(body.tanpaTxn).toBe(1);
    expect(refs.stats?.expired).toBe(1);
  });

  it("tidak menyentuh Pakasir sama sekali", async () => {
    refs.stale = [{ order_code: "MRV-AAAA", amount_idr: 199000, txn_id: null }];

    await jalankan();

    // Tak ada transaksi yang bisa DINAMAI untuk diverifikasi atau dibatalkan —
    // memanggil gateway di sini hanya membakar plafon 2 permintaan/detik yang
    // dipakai bersama poller pelanggan.
    expect(verifyAndActivate).not.toHaveBeenCalled();
    expect(cancelTransaction).not.toHaveBeenCalled();
  });

  it("order yang keburu lunas saat dikunci TIDAK dihitung expired", async () => {
    // RPC mengunci baris lalu memeriksa ulang `status = 'pending'`. Bila webhook
    // mengaktifkannya lebih dulu, jawabannya `not_pending` dan aktivasi menang.
    refs.stale = [{ order_code: "MRV-AAAA", amount_idr: 199000, txn_id: null }];
    refs.rpcHasil = "not_pending";

    const body = (await (await jalankan()).json()) as Record<string, number>;

    expect(body.expired).toBe(0);
    expect(body.tanpaTxn).toBe(1);
  });

  it("order BER-txn_id tetap lewat verifikasi, bukan ikut dibuang", async () => {
    // Pembeda yang menentukan: tanpa ini, cabang baru bisa menelan seluruh pass
    // 2 dan test di atas tetap hijau.
    refs.stale = [{ order_code: "MRV-BBBB", amount_idr: 99000, txn_id: "T-9" }];

    const body = (await (await jalankan()).json()) as Record<string, number>;

    expect(verifyAndActivate).toHaveBeenCalledTimes(1);
    expect(refs.rpcPanggilan).toEqual([]);
    expect(body.tanpaTxn).toBe(0);
    expect(body.keptPaid).toBe(1);
  });
});

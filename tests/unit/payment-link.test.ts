import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `terbitkanLink` — urutan terbitkan → SIMPAN `txn_id` → baru arahkan
 * (AUDIT-2026-10-13, DECISIONS #72).
 *
 * Urutan ini adalah invarian keamanan, bukan selera. Sejak Pakasir API v2, status
 * transaksi berkunci `txn_id`: pembayaran atas transaksi yang `txn_id`-nya tak
 * pernah kita simpan TIDAK BISA DIVERIFIKASI, dan tanpa verifikasi tak ada
 * aktivasi. Mengarahkan pelanggan sebelum rujukannya tersimpan berarti
 * mengizinkan keadaan "pelanggan membayar, kita tak bisa membuktikannya".
 */

const { createPaymentLink } = vi.hoisted(() => ({
  createPaymentLink: vi.fn(
    async (_input: { orderCode: string; amountIdr: number }) => ({
      url: "https://app.pakasir.com/pay-v2/abc?redirect=x",
      txnId: "abc",
    }),
  ),
}));
vi.mock("@/lib/payment", () => ({
  getPaymentGateway: () => ({ createPaymentLink }),
}));

const { reportHandledError } = vi.hoisted(() => ({
  reportHandledError: vi.fn(),
}));
vi.mock("@/lib/observability", () => ({ reportHandledError }));

import { terbitkanLink } from "@/server/payment/link";

const ORDER = "MRV-8F3K2Q";

/** Klien admin palsu yang MEREKAM update dan bisa dibuat gagal. */
function adminClient(gagal = false) {
  const jejak: { txn_id?: string | null; order_code?: string }[] = [];
  const client = {
    jejak,
    from: vi.fn(() => {
      const chain: Record<string, unknown> = {};
      chain.update = (v: { txn_id?: string | null }) => {
        jejak.push({ txn_id: v.txn_id });
        return chain;
      };
      chain.eq = (_k: string, v: string) => {
        jejak[jejak.length - 1].order_code = v;
        return Promise.resolve(
          gagal ? { error: { message: "DB mati" } } : { error: null },
        );
      };
      return chain;
    }),
  };
  return client;
}

const input = {
  orderCode: ORDER,
  amountIdr: 99000,
  redirectUrl: "https://merriva.id/dashboard/undangan/x/bayar",
};

beforeEach(() => {
  vi.clearAllMocks();
  createPaymentLink.mockResolvedValue({
    url: "https://app.pakasir.com/pay-v2/abc?redirect=x",
    txnId: "abc",
  });
});

describe("jalur sukses", () => {
  it("mengembalikan URL dan MENYIMPAN txn_id ke order yang benar", async () => {
    const admin = adminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const url = await terbitkanLink(admin as any, input);
    expect(url).toBe("https://app.pakasir.com/pay-v2/abc?redirect=x");
    expect(admin.jejak).toEqual([{ txn_id: "abc", order_code: ORDER }]);
  });

  it("menulis ke tabel `orders`", async () => {
    const admin = adminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await terbitkanLink(admin as any, input);
    expect(admin.from).toHaveBeenCalledWith("orders");
  });

  it("tak ada laporan galat saat semuanya lancar", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await terbitkanLink(adminClient() as any, input);
    expect(reportHandledError).not.toHaveBeenCalled();
  });
});

describe("gateway gagal", () => {
  it("null, TANPA menulis apa pun ke order", async () => {
    createPaymentLink.mockRejectedValue(new Error("HTTP 429 Rate limit"));
    const admin = adminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await terbitkanLink(admin as any, input)).toBeNull();
    expect(admin.jejak).toEqual([]);
  });

  it("dilaporkan dengan orderCode — jalur uang tak boleh senyap", async () => {
    // Tanpa sinyal ini, Pakasir yang menolak (atau plafon 2/detik yang
    // terlampaui) hanya tampak sebagai pelanggan yang "tak bisa bayar".
    createPaymentLink.mockRejectedValue(new Error("HTTP 429"));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await terbitkanLink(adminClient() as any, input);
    const [, area, extra] = reportHandledError.mock.calls[0];
    expect(area).toBe("payment.create-link");
    expect(extra).toMatchObject({ orderCode: ORDER });
  });
});

describe("penyimpanan txn_id gagal — kasus yang paling mudah salah", () => {
  it("null MESKI link sudah terbit, dan dilaporkan terpisah", async () => {
    // Transaksi SUDAH ada di Pakasir, tetapi rujukannya tak tersimpan.
    // Mengembalikan URL di sini akan mengarahkan pelanggan ke pembayaran yang
    // kelak tak bisa diverifikasi — tepatnya keadaan yang urutan ini cegah.
    // Percobaan ulang aman: find-or-create mengembalikan txn_id yang sama.
    const admin = adminClient(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await terbitkanLink(admin as any, input)).toBeNull();
    expect(reportHandledError.mock.calls[0][1]).toBe(
      "payment.create-link.persist",
    );
  });

  it("area laporannya BERBEDA dari kegagalan gateway", async () => {
    // Dua kegagalan ini menuntut tindakan berbeda: satu berarti Pakasir/plafon,
    // satu berarti DB kita. Menyatukannya membuat keduanya tak terdiagnosis.
    createPaymentLink.mockRejectedValue(new Error("x"));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await terbitkanLink(adminClient() as any, input);
    const areaGateway = reportHandledError.mock.calls[0][1];
    reportHandledError.mockClear();
    createPaymentLink.mockResolvedValue({
      url: "https://x.test",
      txnId: "abc",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await terbitkanLink(adminClient(true) as any, input);
    expect(reportHandledError.mock.calls[0][1]).not.toBe(areaGateway);
  });
});

describe("input diteruskan apa adanya", () => {
  it("nominal & redirect tak diubah di jalan", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await terbitkanLink(adminClient() as any, input);
    expect(createPaymentLink).toHaveBeenCalledWith(input);
  });
});

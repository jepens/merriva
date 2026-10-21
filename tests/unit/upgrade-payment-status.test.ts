import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Jalur aktivasi OTORITATIF KEDUA untuk upgrade paket (AUDIT-2026-10-01 B3).
 *
 * Ia harus ada karena `checkPaymentStatusAction` berhenti di status UNDANGAN
 * `active` — dan undangan pembeli upgrade SELALU `active`. Tanpa poll ini,
 * aktivasi upgrade bergantung penuh pada webhook Pakasir yang tanpa signature.
 *
 * Invarian yang dijaga:
 *  - poll SAJA tak pernah cukup: aktivasi hanya lewat `verifyAndActivate`
 *    (yang memanggil `transactiondetail` OTORITATIF);
 *  - kondisi berhenti = paket undangan SUDAH sama dengan paket tujuan DAN
 *    order-nya lunas — bukan salah satunya saja;
 *  - `held` (paket tak ditukar) → `review`, bukan `active`: uang sudah masuk;
 *  - bukan pemilik → tak ada rekonsiliasi sama sekali;
 *  - kuitansi hanya pada transisi `activated`.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/request-ip", () => ({
  checkClientRateLimit: () =>
    Promise.resolve({ ok: true, remaining: 9, retryAfterMs: 0 }),
}));

const { verifyAndActivate, notifyOrderPaid, findLatestUpgradeOrder } =
  vi.hoisted(() => ({
    verifyAndActivate: vi.fn(),
    notifyOrderPaid: vi.fn(() => Promise.resolve()),
    findLatestUpgradeOrder: vi.fn(),
  }));
vi.mock("@/server/payment/reconcile", () => ({ verifyAndActivate }));
vi.mock("@/server/email/notify", () => ({ notifyOrderPaid }));
vi.mock("@/server/upgrade/orders", () => ({ findLatestUpgradeOrder }));

const { refs } = vi.hoisted(() => ({
  refs: { server: null as unknown, admin: null as unknown },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => Promise.resolve(refs.server),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => refs.admin,
}));

import { checkUpgradePaymentStatusAction } from "@/server/actions/upgrade-payment-status";

const INV = "44444444-4444-4444-8444-444444444444";
const PKG_BASIC = "pkg-basic";
const PKG_PREMIUM = "pkg-premium";

/** Klien RLS palsu: `inv` null = bukan pemilik / tak ada baris. */
function serverClient(inv: unknown) {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.maybeSingle = () => Promise.resolve({ data: inv, error: null });
  return {
    from: () => chain,
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
  };
}

const PENDING = {
  orderCode: "MRV-UPG1",
  amountIdr: 100000,
  status: "pending",
  txnId: "TXN-UPG1",
  packageId: PKG_PREMIUM,
  packageName: "Premium",
};

beforeEach(() => {
  vi.clearAllMocks();
  // Undangan masih di paket lama → upgrade belum terjadi.
  refs.server = serverClient({
    id: INV,
    slug: "andi-sinta",
    package_id: PKG_BASIC,
  });
  refs.admin = {};
  findLatestUpgradeOrder.mockResolvedValue(PENDING);
});

describe("checkUpgradePaymentStatusAction — kondisi berhenti", () => {
  it("paket sudah menjadi paket tujuan DAN order lunas → active, tanpa panggil Pakasir", async () => {
    refs.server = serverClient({
      id: INV,
      slug: "andi-sinta",
      package_id: PKG_PREMIUM,
    });
    findLatestUpgradeOrder.mockResolvedValue({ ...PENDING, status: "paid" });

    const res = await checkUpgradePaymentStatusAction(INV);

    expect(res).toEqual({ status: "active" });
    expect(verifyAndActivate).not.toHaveBeenCalled();
  });

  it("paket sudah sama TETAPI order belum lunas → tetap merekonsiliasi", async () => {
    // Inti penahannya: pemilik yang kedaluwarsa lalu MEMPERPANJANG dengan
    // Premium sementara order upgrade lamanya masih `pending` tak boleh melihat
    // layar "upgrade selesai" untuk pembayaran yang belum pernah terjadi.
    refs.server = serverClient({
      id: INV,
      slug: "andi-sinta",
      package_id: PKG_PREMIUM,
    });
    verifyAndActivate.mockResolvedValue({ kind: "not_confirmed" });

    const res = await checkUpgradePaymentStatusAction(INV);

    expect(res).toEqual({ status: "pending" });
    expect(verifyAndActivate).toHaveBeenCalledTimes(1);
  });

  it("order lunas tetapi paket TAK ditukar → review, bukan active", async () => {
    // Hasil `held` di RPC: undangan kedaluwarsa/ditangguhkan saat pembayaran
    // berjalan. Uang sudah masuk → butuh manusia, bukan layar sukses.
    findLatestUpgradeOrder.mockResolvedValue({ ...PENDING, status: "paid" });

    const res = await checkUpgradePaymentStatusAction(INV);

    expect(res).toEqual({ status: "review" });
    expect(verifyAndActivate).not.toHaveBeenCalled();
  });

  it("tak ada order upgrade → none, tanpa rekonsiliasi", async () => {
    findLatestUpgradeOrder.mockResolvedValue(null);

    const res = await checkUpgradePaymentStatusAction(INV);

    expect(res).toEqual({ status: "none" });
    expect(verifyAndActivate).not.toHaveBeenCalled();
  });

  it("order kedaluwarsa/gagal/refund → expired, poll berhenti", async () => {
    for (const status of ["expired", "failed", "refunded"]) {
      vi.clearAllMocks();
      findLatestUpgradeOrder.mockResolvedValue({ ...PENDING, status });
      const res = await checkUpgradePaymentStatusAction(INV);
      expect(res).toEqual({ status: "expired" });
      expect(verifyAndActivate).not.toHaveBeenCalled();
    }
  });

  it("bukan pemilik (RLS 0 baris) → error, tanpa rekonsiliasi", async () => {
    refs.server = serverClient(null);

    const res = await checkUpgradePaymentStatusAction(INV);

    expect(res).toEqual({ status: "error" });
    expect(verifyAndActivate).not.toHaveBeenCalled();
  });

  it("id bukan UUID → error tanpa menyentuh apa pun", async () => {
    const res = await checkUpgradePaymentStatusAction("bukan-uuid");

    expect(res).toEqual({ status: "error" });
    expect(findLatestUpgradeOrder).not.toHaveBeenCalled();
  });
});

describe("checkUpgradePaymentStatusAction — hasil verifikasi otoritatif", () => {
  it("activated → active + kuitansi sekali", async () => {
    verifyAndActivate.mockResolvedValue({
      kind: "ok",
      result: "activated",
      slug: "andi-sinta",
    });

    const res = await checkUpgradePaymentStatusAction(INV);

    expect(res).toEqual({ status: "active" });
    expect(notifyOrderPaid).toHaveBeenCalledTimes(1);
  });

  it("held → review, TANPA kuitansi", async () => {
    verifyAndActivate.mockResolvedValue({ kind: "ok", result: "held" });

    const res = await checkUpgradePaymentStatusAction(INV);

    expect(res).toEqual({ status: "review" });
    expect(notifyOrderPaid).not.toHaveBeenCalled();
  });

  it("already_paid → pending (keadaan paket yang memutuskan), TANPA kuitansi kedua", async () => {
    // Webhook sudah memprosesnya lebih dulu. Kuitansi dikirim SEKALI pada
    // transisi `activated`, jadi di sini tak boleh ada kiriman kedua.
    verifyAndActivate.mockResolvedValue({
      kind: "ok",
      result: "already_paid",
      slug: "andi-sinta",
    });

    const res = await checkUpgradePaymentStatusAction(INV);

    expect(res).toEqual({ status: "pending" });
    expect(notifyOrderPaid).not.toHaveBeenCalled();
  });

  it("belum terkonfirmasi lunas → pending, TIDAK mengaktifkan", async () => {
    verifyAndActivate.mockResolvedValue({ kind: "not_confirmed" });

    const res = await checkUpgradePaymentStatusAction(INV);

    expect(res).toEqual({ status: "pending" });
    expect(notifyOrderPaid).not.toHaveBeenCalled();
  });

  it("kegagalan transien (jaringan/RPC) → pending, klien terus poll", async () => {
    for (const kind of ["verify_error", "rpc_error"]) {
      vi.clearAllMocks();
      verifyAndActivate.mockResolvedValue({ kind });
      const res = await checkUpgradePaymentStatusAction(INV);
      expect(res).toEqual({ status: "pending" });
      expect(notifyOrderPaid).not.toHaveBeenCalled();
    }
  });

  it("amount tak cocok → error, bukan pending", async () => {
    verifyAndActivate.mockResolvedValue({ kind: "mismatch" });

    const res = await checkUpgradePaymentStatusAction(INV);

    expect(res).toEqual({ status: "error" });
  });

  it("nominal yang diverifikasi adalah SELISIH dari order, bukan harga paket", async () => {
    verifyAndActivate.mockResolvedValue({
      kind: "ok",
      result: "activated",
      slug: "andi-sinta",
    });

    await checkUpgradePaymentStatusAction(INV);

    // `txn_id` ada di fixture DAN di assertion di bawah. Sebelum ini keduanya
    // tak menyebutnya, dan `toHaveBeenCalledWith` mencocokkan objek TEPAT —
    // jadi assertion itu bukan sekadar melewatkan bug, ia MENOLAK
    // perbaikannya: menambahkan txn_id akan memerahkannya.
    expect(verifyAndActivate).toHaveBeenCalledWith(expect.anything(), {
      order_code: "MRV-UPG1",
      amount_idr: 100000,
      txn_id: "TXN-UPG1",
    });
  });
});

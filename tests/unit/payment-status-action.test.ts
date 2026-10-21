import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `checkPaymentStatusAction` — jalur aktivasi OTORITATIF KEDUA undangan
 * (pendamping webhook), tanpa test sampai AUDIT-2026-09-04 KUA-9.
 *
 * Invarian terpenting: **poll saja tak pernah cukup untuk mengaktifkan**.
 * Aktivasi hanya lewat inti bersama `verifyAndActivate` yang memanggil
 * `transactiondetail` OTORITATIF; "belum lunas", amount tak cocok, dan kegagalan
 * transien TIDAK BOLEH mengaktifkan apa pun. Rate limit sengaja bersifat
 * transien-lembut (`pending`) agar klien terus poll, bukan gagal keras.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { checkClientRateLimit } = vi.hoisted(() => ({
  checkClientRateLimit: vi.fn(() =>
    Promise.resolve({ ok: true, remaining: 9, retryAfterMs: 0 }),
  ),
}));
vi.mock("@/lib/request-ip", () => ({ checkClientRateLimit }));

const { verifyAndActivate, notifyOrderPaid } = vi.hoisted(() => ({
  verifyAndActivate: vi.fn(),
  notifyOrderPaid: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/server/payment/reconcile", () => ({ verifyAndActivate }));
vi.mock("@/server/email/notify", () => ({ notifyOrderPaid }));

const { refs } = vi.hoisted(() => ({
  refs: { server: null as unknown, admin: null as unknown },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => Promise.resolve(refs.server),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => refs.admin,
}));

import { checkPaymentStatusAction } from "@/server/actions/payment-status";

const INV = "44444444-4444-4444-8444-444444444444";
const SLUG = "andi-sinta";

function makeClient(data: Record<string, unknown>, user = true) {
  const chain = (table: string) => {
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "limit"]) c[m] = () => c;
    c.maybeSingle = () =>
      Promise.resolve({ data: data[table] ?? null, error: null });
    return c;
  };
  return {
    from: (t: string) => chain(t),
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: user ? { id: "u1" } : null } }),
    },
  };
}

const PENDING_ORDER = {
  order_code: "MRV-1",
  amount_idr: 299000,
  status: "pending",
  txn_id: "TXN-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  checkClientRateLimit.mockResolvedValue({
    ok: true,
    remaining: 9,
    retryAfterMs: 0,
  });
  refs.admin = makeClient({});
});

describe("checkPaymentStatusAction — kondisi berhenti", () => {
  it("undangan sudah aktif → active + slug, TIDAK memanggil Pakasir", async () => {
    refs.server = makeClient({
      invitations: { id: INV, slug: SLUG, status: "active" },
    });

    const res = await checkPaymentStatusAction(INV);

    expect(res).toEqual({ status: "active", slug: SLUG });
    expect(verifyAndActivate).not.toHaveBeenCalled();
  });

  it("ditangguhkan admin → review, tak merekonsiliasi", async () => {
    refs.server = makeClient({
      invitations: { id: INV, slug: SLUG, status: "suspended" },
    });

    expect(await checkPaymentStatusAction(INV)).toEqual({ status: "review" });
    expect(verifyAndActivate).not.toHaveBeenCalled();
  });

  it("bukan pemilik (RLS 0 baris) → error, tak merekonsiliasi", async () => {
    refs.server = makeClient({ invitations: null });

    expect(await checkPaymentStatusAction(INV)).toEqual({ status: "error" });
    expect(verifyAndActivate).not.toHaveBeenCalled();
  });

  it("tak ada order → none", async () => {
    refs.server = makeClient({
      invitations: { id: INV, slug: SLUG, status: "draft" },
      orders: null,
    });

    expect(await checkPaymentStatusAction(INV)).toEqual({ status: "none" });
  });

  it("order paid tetapi undangan belum aktif → review (ditahan/anomali)", async () => {
    refs.server = makeClient({
      invitations: { id: INV, slug: SLUG, status: "draft" },
      orders: { ...PENDING_ORDER, status: "paid" },
    });

    expect(await checkPaymentStatusAction(INV)).toEqual({ status: "review" });
    expect(verifyAndActivate).not.toHaveBeenCalled();
  });

  it("order kedaluwarsa/gagal → expired", async () => {
    refs.server = makeClient({
      invitations: { id: INV, slug: SLUG, status: "draft" },
      orders: { ...PENDING_ORDER, status: "expired" },
    });

    expect(await checkPaymentStatusAction(INV)).toEqual({ status: "expired" });
    expect(verifyAndActivate).not.toHaveBeenCalled();
  });

  it("rate limit → pending (transien-lembut: klien tetap poll, bukan gagal keras)", async () => {
    checkClientRateLimit.mockResolvedValue({
      ok: false,
      remaining: 0,
      retryAfterMs: 1,
    });
    refs.server = makeClient({
      invitations: { id: INV, slug: SLUG, status: "draft" },
    });

    expect(await checkPaymentStatusAction(INV)).toEqual({ status: "pending" });
    expect(verifyAndActivate).not.toHaveBeenCalled();
  });
});

describe("checkPaymentStatusAction — poll SAJA tak pernah mengaktifkan", () => {
  function pending() {
    refs.server = makeClient({
      invitations: { id: INV, slug: SLUG, status: "pending_payment" },
      orders: PENDING_ORDER,
    });
  }

  it("API belum konfirmasi lunas → pending, tanpa kuitansi", async () => {
    pending();
    verifyAndActivate.mockResolvedValue({ kind: "not_confirmed" });

    expect(await checkPaymentStatusAction(INV)).toEqual({ status: "pending" });
    expect(notifyOrderPaid).not.toHaveBeenCalled();
  });

  it("amount tak cocok → error, tanpa kuitansi", async () => {
    pending();
    verifyAndActivate.mockResolvedValue({ kind: "mismatch" });

    expect(await checkPaymentStatusAction(INV)).toEqual({ status: "error" });
    expect(notifyOrderPaid).not.toHaveBeenCalled();
  });

  it.each(["verify_error", "rpc_error"])(
    "kegagalan transien (%s) → pending (fail-closed)",
    async (kind) => {
      pending();
      verifyAndActivate.mockResolvedValue({ kind });

      expect(await checkPaymentStatusAction(INV)).toEqual({
        status: "pending",
      });
      expect(notifyOrderPaid).not.toHaveBeenCalled();
    },
  );

  it("held (ditangguhkan) → review, tak dipublikasikan diam-diam", async () => {
    pending();
    verifyAndActivate.mockResolvedValue({
      kind: "ok",
      result: "held",
      slug: SLUG,
    });

    expect(await checkPaymentStatusAction(INV)).toEqual({ status: "review" });
  });

  it("terverifikasi lunas → active + kuitansi SEKALI, nominal dari order DB", async () => {
    pending();
    verifyAndActivate.mockResolvedValue({
      kind: "ok",
      result: "activated",
      slug: SLUG,
    });

    expect(await checkPaymentStatusAction(INV)).toEqual({
      status: "active",
      slug: SLUG,
    });
    // `txn_id` ada di fixture DAN di assertion di bawah. Sebelum ini keduanya
    // tak menyebutnya, dan `toHaveBeenCalledWith` mencocokkan objek TEPAT —
    // jadi assertion itu bukan sekadar melewatkan bug, ia MENOLAK
    // perbaikannya: menambahkan txn_id akan memerahkannya.
    expect(verifyAndActivate).toHaveBeenCalledWith(expect.anything(), {
      order_code: "MRV-1",
      amount_idr: 299000,
      txn_id: "TXN-1",
    });
    expect(notifyOrderPaid).toHaveBeenCalledTimes(1);
  });

  it("already_paid (webhook menang duluan) → active TANPA kuitansi ganda", async () => {
    pending();
    verifyAndActivate.mockResolvedValue({
      kind: "ok",
      result: "already_paid",
      slug: SLUG,
    });

    expect(await checkPaymentStatusAction(INV)).toEqual({
      status: "active",
      slug: SLUG,
    });
    expect(notifyOrderPaid).not.toHaveBeenCalled();
  });
});

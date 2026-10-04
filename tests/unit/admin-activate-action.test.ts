import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `adminActivateInvitationAction` — kuitansi untuk aktivasi manual
 * (AUDIT-2026-10-01 B7).
 *
 * Aktivasi manual dipakai saat uang masuk di luar sistem (transfer bank). Sampai
 * perubahan ini, pembayar itulah SATU-SATUNYA pelanggan yang membayar penuh dan
 * tak menerima bukti apa pun: webhook, poller, dan cron semuanya memanggil
 * `notifyOrderPaid`, jalur manual tidak.
 *
 * Yang dijaga di sini:
 *  - kuitansi memakai kode order yang BENAR-BENAR dipakai RPC. Sebelumnya kode
 *    itu ditulis inline ke argumen RPC dan langsung terbuang — kuitansi apa pun
 *    yang dirakit dari kode baru akan merujuk order yang tidak ada;
 *  - gerbangnya `activated` SAJA, tidak menumpang cabang `already_paid`;
 *  - email DI-AWAIT sebelum `redirect()`. `redirect()` melempar `NEXT_REDIRECT`
 *    dan responsnya langsung dikirim, jadi promise yang menggantung bisa mati
 *    bersama request-nya;
 *  - kuitansi yang gagal terkirim DIBERITAHUKAN kepada admin — ia satu-satunya
 *    yang bisa menindaklanjuti, dan undangannya sendiri sudah aktif.
 */

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

const { requireAdmin } = vi.hoisted(() => ({
  requireAdmin: vi.fn(async () => ({ id: "admin-1" })),
}));
vi.mock("@/server/guards/auth", () => ({ requireAdmin }));

const { reportHandledError } = vi.hoisted(() => ({
  reportHandledError: vi.fn(),
}));
vi.mock("@/lib/observability", () => ({ reportHandledError }));

const { rpc, pkgRow } = vi.hoisted(() => ({
  rpc: vi.fn(),
  pkgRow: { current: { data: { id: "pkg-basic" }, error: null } as unknown },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    rpc,
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = () => Promise.resolve(pkgRow.current);
      return chain;
    },
  }),
}));

/**
 * `notifyOrderPaid` palsu yang MENCATAT urutan: "start" saat dipanggil, "end"
 * setelah satu putaran microtask. Tanpa jarak itu, `void notifyOrderPaid(...)`
 * dan `await notifyOrderPaid(...)` menghasilkan jejak yang sama persis.
 */
const { notifyOrderPaid, jejak, statusKuitansi } = vi.hoisted(() => {
  const jejak: string[] = [];
  const statusKuitansi = { current: "sent" };
  return {
    jejak,
    statusKuitansi,
    // Parameter dituliskan walau tak dipakai: tanpa itu `mock.calls[0][1]` di
    // bawah bertipe tuple kosong, dan assertion kode ordernya tak bisa ditulis.
    notifyOrderPaid: vi.fn(async (_admin: unknown, _orderCode: string) => {
      jejak.push("notify:start");
      await Promise.resolve();
      await Promise.resolve();
      jejak.push("notify:end");
      return statusKuitansi.current;
    }),
  };
});
vi.mock("@/server/email/notify", () => ({ notifyOrderPaid }));

import { adminActivateInvitationAction } from "@/server/actions/admin";

const INV = "44444444-4444-4444-8444-444444444444";

function form(packageCode = "basic"): FormData {
  const fd = new FormData();
  fd.set("packageCode", packageCode);
  return fd;
}

/** Menjalankan aksi dan mengembalikan tujuan redirect-nya. */
async function jalankan(id = INV, fd = form()): Promise<string> {
  try {
    await adminActivateInvitationAction(id, fd);
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

/** Kode order yang diterima RPC pada percobaan ke-`i`. */
const kodeRpc = (i = 0) => rpc.mock.calls[i]?.[1]?.p_order_code as string;

beforeEach(() => {
  redirect.mockClear();
  requireAdmin.mockClear();
  reportHandledError.mockClear();
  notifyOrderPaid.mockClear();
  revalidatePath.mockClear();
  revalidatePath.mockImplementation(() => {
    jejak.push("revalidate");
  });
  rpc.mockReset();
  jejak.length = 0;
  statusKuitansi.current = "sent";
  pkgRow.current = { data: { id: "pkg-basic" }, error: null };
  redirect.mockImplementation((to: string) => {
    jejak.push("redirect");
    throw new Error(`REDIRECT ${to}`);
  });
  hasil("activated");
});

describe("kuitansi aktivasi manual", () => {
  it("aktivasi berhasil → kuitansi dikirim sekali", async () => {
    await jalankan();
    expect(notifyOrderPaid).toHaveBeenCalledTimes(1);
  });

  it("kuitansi memakai kode order yang DIPAKAI RPC, bukan kode baru", async () => {
    // Inti perbaikannya. Kode order dulu ditulis inline ke argumen RPC lalu
    // terbuang; kuitansi dari kode yang dirakit ulang akan merujuk order yang
    // tak ada, dan `notifyOrderPaid` diam-diam melaporkan "order hilang".
    await jalankan();
    expect(notifyOrderPaid.mock.calls[0]?.[1]).toBe(kodeRpc(0));
  });

  it("sesudah bentrok kode, yang dipakai adalah percobaan TERAKHIR", async () => {
    // Percobaan yang berhasil itulah yang membuat order-nya; kode percobaan
    // pertama tidak pernah menjadi baris di `orders`.
    rpc
      .mockResolvedValueOnce({
        data: [{ result: "order_code_conflict", slug: null }],
        error: null,
      })
      .mockResolvedValue({
        data: [{ result: "activated", slug: "andi-sinta" }],
        error: null,
      });

    await jalankan();

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(kodeRpc(0)).not.toBe(kodeRpc(1));
    expect(notifyOrderPaid.mock.calls[0]?.[1]).toBe(kodeRpc(1));
  });

  it("email DI-AWAIT sebelum redirect", async () => {
    await jalankan();
    expect(jejak.filter((j) => j !== "revalidate")).toEqual([
      "notify:start",
      "notify:end",
      "redirect",
    ]);
  });

  it("email dikirim SESUDAH revalidate, bukan sebelum", async () => {
    // Urutannya bermakna: kuitansi memuat link undangan, jadi mengirimkannya
    // sebelum cache ISR disegarkan berarti mengundang pemilik ke halaman yang
    // masih menampilkan keadaan lama.
    await jalankan();
    expect(jejak.indexOf("notify:start")).toBeGreaterThan(
      jejak.lastIndexOf("revalidate"),
    );
    expect(jejak).toContain("revalidate");
  });

  it("`already_paid` TIDAK mengirim kuitansi, tetapi tetap melaporkan sukses", async () => {
    // Gerbangnya sengaja dipisah dari pesan suksesnya: `already_paid` berarti
    // order lunasnya sudah ada sejak sebelum klik ini, jadi kuitansinya pun
    // sudah pernah dikirim. Menumpang cabang yang sama akan mengirim ulang.
    hasil("already_paid");
    expect(await jalankan()).toBe(`/admin/undangan/${INV}?msg=activate_ok`);
    expect(notifyOrderPaid).not.toHaveBeenCalled();
  });

  it.each([
    ["draft_slug", "activate_draft_slug"],
    ["not_payable", "activate_not_payable"],
    ["package_unavailable", "activate_pkg"],
  ])("hasil `%s` tak mengirim kuitansi", async (result, msg) => {
    hasil(result);
    expect(await jalankan()).toBe(`/admin/undangan/${INV}?msg=${msg}`);
    expect(notifyOrderPaid).not.toHaveBeenCalled();
  });

  it("galat RPC tak mengirim kuitansi", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await jalankan()).toBe(`/admin/undangan/${INV}?msg=activate_failed`);
    expect(notifyOrderPaid).not.toHaveBeenCalled();
  });
});

describe("umpan balik ke admin", () => {
  it("kuitansi terkirim → pesan sukses biasa", async () => {
    expect(await jalankan()).toBe(`/admin/undangan/${INV}?msg=activate_ok`);
  });

  it.each(["error", "skipped", "nodata"])(
    "kuitansi %s → admin DIBERITAHU, dan undangannya tetap disebut aktif",
    async (status) => {
      // Undangan SUDAH aktif; yang gagal hanya kuitansinya. Pesannya karena itu
      // bukan "gagal" — admin yang membacanya sebagai kegagalan akan mencoba
      // mengaktifkan ulang undangan yang sudah aktif.
      statusKuitansi.current = status;
      expect(await jalankan()).toBe(
        `/admin/undangan/${INV}?msg=activate_ok_no_email`,
      );
    },
  );

  it("`nodata` mencakup undangan tanpa pemilik — kasus yang paling mudah terlewat", async () => {
    // `invitations.user_id` dan `orders.user_id` keduanya nullable (akun dihapus,
    // A6). `notifyOrderPaid` memang diam untuk order tanpa pemilik; tanpa pesan
    // ini aktivasinya tampak sepenuhnya normal padahal tak ada kuitansi.
    statusKuitansi.current = "nodata";
    expect(await jalankan()).toContain("activate_ok_no_email");
    expect(reportHandledError).not.toHaveBeenCalled();
  });
});

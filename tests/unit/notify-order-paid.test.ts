import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `notifyOrderPaid` + `sendExpiryReminder` — sampai AUDIT-2026-10-01 gelombang
 * C, berkas `src/server/email/notify.ts` **tidak punya satu pun test**.
 *
 * Yang dijaga di sini:
 *  - pemilihan TEMPLATE dari jenis order, bukan dari nominal atau nama paket.
 *    Kuitansi aktivasi mengaku "undangan Anda kini aktif" dan mencantumkan masa
 *    aktif; mengirimkannya untuk order upgrade atau add-on adalah keterangan
 *    yang SALAH pada dokumen bukti pembayaran;
 *  - setiap `return` sebelum email terkirim meninggalkan jejak — kecuali satu
 *    yang memang bukan galat (akun pemilik sudah dihapus);
 *  - tak ada PII yang ikut ke telemetri: alamat email, nama pembeli, isi
 *    kuitansi, maupun pesan mentah Resend;
 *  - kegagalan Resend tak lagi hilang: kuitansi dikirim SEKALI tanpa retry.
 */

const { sendTransactionalEmail, reportHandledError } = vi.hoisted(() => ({
  sendTransactionalEmail: vi.fn(),
  reportHandledError: vi.fn(),
}));
vi.mock("@/lib/email/send", () => ({ sendTransactionalEmail }));
vi.mock("@/lib/observability", () => ({ reportHandledError }));

import { copy } from "@/lib/copy";
import { notifyOrderPaid, sendExpiryReminder } from "@/server/email/notify";

const KODE = "MRV-8F3K2Q";
const USER = "55555555-5555-4555-8555-555555555555";
const INV = "44444444-4444-4444-8444-444444444444";
const EMAIL = "pembeli@contoh.test";

type Res = { data: unknown; error: unknown };

interface Keadaan {
  orders: Res;
  profiles: Res;
  packages: Res;
  invitations: Res;
  auth: Res;
}

function keadaanBawaan(): Keadaan {
  return {
    orders: {
      data: {
        order_code: KODE,
        amount_idr: 99000,
        paid_at: "2026-10-04T05:00:00.000Z",
        user_id: USER,
        invitation_id: INV,
        package_id: "pkg-basic",
        purpose: "purchase",
      },
      error: null,
    },
    profiles: { data: { full_name: "Andi" }, error: null },
    packages: { data: { name: "Basic", kind: "invitation" }, error: null },
    invitations: {
      data: { slug: "andi-sinta", active_until: "2027-04-04T00:00:00.000Z" },
      error: null,
    },
    auth: { data: { user: { email: EMAIL } }, error: null },
  };
}

/** Klien admin palsu: menjawab per TABEL, dan membawa `error` seperti aslinya. */
function adminClient(k: Keadaan) {
  const from = (table: keyof Keadaan) => {
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.maybeSingle = () => Promise.resolve(k[table]);
    return chain;
  };
  return {
    from: vi.fn(from),
    auth: { admin: { getUserById: vi.fn(() => Promise.resolve(k.auth)) } },
  };
}

let k: Keadaan;

beforeEach(() => {
  vi.clearAllMocks();
  k = keadaanBawaan();
  sendTransactionalEmail.mockResolvedValue({ status: "sent", id: "em_1" });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jalankan = () => notifyOrderPaid(adminClient(k) as any, KODE);

const kiriman = () => sendTransactionalEmail.mock.calls[0]?.[0];
const laporan = () => reportHandledError.mock.calls;

describe("pemilihan template kuitansi", () => {
  it("aktivasi/perpanjangan → kuitansi undangan", async () => {
    await jalankan();
    expect(kiriman()?.subject).toBe(copy.email.receipt.subject);
    expect(kiriman()?.to).toBe(EMAIL);
    expect(kiriman()?.idempotencyKey).toBe(`receipt/${KODE}`);
  });

  it("order UPGRADE → kuitansi upgrade, BUKAN kuitansi aktivasi", async () => {
    // Paket tujuan upgrade adalah paket undangan biasa, jadi `packages.kind`
    // sendirian memilih template yang salah — yang mengaku "undangan Anda kini
    // aktif" dan menyiratkan masa aktif baru untuk pembayaran selisih (B3).
    (k.orders.data as { purpose: string }).purpose = "upgrade";
    (k.packages.data as { name: string }).name = "Premium";

    await jalankan();

    expect(kiriman()?.subject).toBe(copy.email.upgradeReceipt.subject);
  });

  it("add-on Album Momen → kuitansi add-on", async () => {
    (k.packages.data as { kind: string }).kind = "addon_momen";

    await jalankan();

    expect(kiriman()?.subject).toBe(copy.email.momenReceipt.subject);
  });
});

describe("prasyarat yang gagal meninggalkan jejak", () => {
  it("order tak terbaca (galat DB) → GALAT ASLINYA dilaporkan, email TIDAK dikirim", async () => {
    // `.maybeSingle()` menjawab `data: null, error: null` untuk 0 baris —
    // bentuk yang IDENTIK dengan gangguan DB. Membuang `error` membuat keduanya
    // sama-sama tak terlihat.
    const galatDb = { message: "statement timeout", code: "57014" };
    k.orders = { data: null, error: galatDb };

    await jalankan();

    expect(sendTransactionalEmail).not.toHaveBeenCalled();
    expect(laporan()).toHaveLength(1);
    // Yang diteruskan WAJIB objek galat DB-nya, bukan `Error` generik buatan
    // sendiri: `reportHandledError` menyusun nama isu Sentry dari `code`-nya
    // (`SupabaseError:57014`), dan tanpa itu seluruh gangguan DB menyatu jadi
    // satu isu "order hilang" yang tak bisa didiagnosis.
    expect(laporan()[0][0]).toBe(galatDb);
    expect(laporan()[0][1]).toBe("email.receipt.lookup");
    expect(laporan()[0][2]).toMatchObject({ orderCode: KODE, step: "order" });
  });

  it("order hilang (0 baris) juga dilaporkan — ia baru saja diaktifkan", async () => {
    k.orders = { data: null, error: null };

    await jalankan();

    expect(laporan()[0]?.[2]).toMatchObject({ step: "order" });
  });

  it("akun pemilik sudah dihapus → DIAM, karena itu bukan galat", async () => {
    // Baris `orders` ber-`user_id` NULL disimpan demi pembukuan (A6). Tak ada
    // alamat tujuan, dan melaporkannya hanya akan menjadi derau tetap.
    (k.orders.data as { user_id: string | null }).user_id = null;

    await jalankan();

    expect(sendTransactionalEmail).not.toHaveBeenCalled();
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("pencarian akun gagal → dilaporkan dengan step auth", async () => {
    k.auth = { data: null, error: { message: "auth down" } };

    await jalankan();

    expect(sendTransactionalEmail).not.toHaveBeenCalled();
    expect(laporan()[0]?.[2]).toMatchObject({ step: "auth" });
  });

  it("undangan tak terbaca → GALAT ASLINYA dilaporkan, email TIDAK dikirim", async () => {
    const galatDb = { message: "boom", code: "08006" };
    k.invitations = { data: null, error: galatDb };

    await jalankan();

    expect(sendTransactionalEmail).not.toHaveBeenCalled();
    expect(laporan()[0]?.[0]).toBe(galatDb);
    expect(laporan()[0]?.[2]).toMatchObject({ step: "invitation" });
  });

  it("undangan hilang TANPA galat → `Error` generik, bukan undefined", async () => {
    // Cabang yang membedakan: 0 baris (anomali data) vs gangguan DB. Keduanya
    // dilaporkan, tetapi dengan objek yang berbeda — itulah gunanya memeriksa
    // `invErr` di samping `!inv`.
    k.invitations = { data: null, error: null };

    await jalankan();

    expect((laporan()[0]?.[0] as Error).message).toContain("undangan hilang");
  });

  it("paket tak terbaca → dilaporkan TETAPI kuitansi TETAP dikirim", async () => {
    // `pkg` memilih template. Bila ia null, add-on akan dikirimi kuitansi
    // aktivasi — karena itu wajib dilaporkan. Tetapi kehilangan kuitansi
    // sepenuhnya lebih buruk daripada nama paket yang kosong, jadi JANGAN
    // berhenti di sini.
    const galatDb = { message: "boom", code: "08006" };
    k.packages = { data: null, error: galatDb };

    await jalankan();

    expect(laporan()[0]?.[0]).toBe(galatDb);
    expect(laporan()[0]?.[2]).toMatchObject({ step: "package" });
    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1);
  });

  it("nama pembeli tak terbaca TIDAK dilaporkan — kegagalannya kosmetik", async () => {
    k.profiles = { data: null, error: { message: "boom" } };

    await jalankan();

    expect(reportHandledError).not.toHaveBeenCalled();
    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1);
  });
});

describe("kegagalan pengiriman", () => {
  it("Resend gagal → dilaporkan dengan KODE galatnya", async () => {
    // Kuitansi dikirim SEKALI pada transisi `activated` tanpa retry: satu
    // kegagalan = bukti pembayaran hilang permanen bagi yang sudah membayar.
    sendTransactionalEmail.mockResolvedValue({
      status: "error",
      code: "rate_limit_exceeded",
      statusCode: 429,
    });

    await jalankan();

    expect(laporan()).toHaveLength(1);
    const [err, area, extra] = laporan()[0];
    expect((err as Error).message).toBe("resend:rate_limit_exceeded");
    expect(area).toBe("email.receipt");
    expect(extra).toMatchObject({ orderCode: KODE, statusCode: 429 });
  });

  it("lemparan tak terduga tetap dilaporkan dan TIDAK menggagalkan aktivasi", async () => {
    sendTransactionalEmail.mockRejectedValue(new Error("jaringan putus"));

    await expect(jalankan()).resolves.toBeUndefined();

    expect(laporan().some((c) => c[1] === "email.receipt")).toBe(true);
  });
});

describe("tak ada PII yang bocor ke telemetri", () => {
  it("alamat email, nama pembeli, dan isi kuitansi tak pernah ikut", async () => {
    // `reportHandledError` meneruskan `extra` apa adanya ke Sentry, dan
    // `scrubSentryEvent` hanya meredaksi token tamu — ia tak mengenal alamat
    // email. Jaringnya harus di sini.
    k.invitations = { data: null, error: { message: "boom" } };

    await jalankan();

    const serialisasi = JSON.stringify(laporan());
    expect(serialisasi).not.toContain(EMAIL);
    expect(serialisasi).not.toContain("Andi");
    expect(serialisasi).not.toContain("andi-sinta");
  });

  it("pesan mentah Resend tak bisa ikut — field-nya memang tak ada", async () => {
    // `SendEmailResult` sengaja TIDAK membawa `message`: galat
    // `validation_error` Resend rutin mengutip isi field `to`. Komentar bukan
    // gerbang; ketiadaan field itulah gerbangnya.
    sendTransactionalEmail.mockResolvedValue({
      status: "error",
      code: "validation_error",
      statusCode: 422,
    });

    await jalankan();

    const serialisasi = JSON.stringify(laporan());
    expect(serialisasi).not.toContain(EMAIL);
  });
});

describe("sendExpiryReminder", () => {
  const target = {
    id: INV,
    slug: "andi-sinta",
    user_id: USER,
    active_until: "2026-10-18T00:00:00.000Z",
  };
  const now = Date.parse("2026-10-04T00:00:00.000Z");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ingatkan = () => sendExpiryReminder(adminClient(k) as any, target, now);

  it("terkirim → status sent, tanpa laporan", async () => {
    const status = await ingatkan();

    expect(status).toBe("sent");
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("Resend gagal → dilaporkan dengan id UNDANGAN, bukan slug/email", async () => {
    sendTransactionalEmail.mockResolvedValue({
      status: "error",
      code: "invalid_api_key",
      statusCode: 401,
    });

    const status = await ingatkan();

    expect(status).toBe("error");
    expect(laporan()[0][1]).toBe("email.expiry-reminder");
    expect(laporan()[0][2]).toMatchObject({ invitationId: INV });
    expect(JSON.stringify(laporan())).not.toContain("andi-sinta");
  });

  it("lemparan tak terduga tak lagi hilang di `catch` kosong", async () => {
    // Sebelumnya `catch { return "error"; }` — objek galatnya lenyap, lebih
    // buta daripada cabang mana pun di berkas ini.
    sendTransactionalEmail.mockRejectedValue(new Error("jaringan putus"));

    const status = await ingatkan();

    expect(status).toBe("error");
    expect(laporan()[0][1]).toBe("email.expiry-reminder");
  });

  it("pemilik tanpa alamat email → nodata, tanpa mengirim apa pun", async () => {
    k.auth = { data: { user: {} }, error: null };

    const status = await ingatkan();

    expect(status).toBe("nodata");
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });
});

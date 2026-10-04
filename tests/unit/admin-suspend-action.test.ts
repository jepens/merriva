import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `adminSuspendInvitationAction` + `adminReinstateInvitationAction` — dua kolom
 * alasan dan email pemberitahuannya (AUDIT-2026-10-01 B7, DECISIONS #68).
 *
 * Batas yang dijaga berkas ini cuma satu, tetapi ia batas yang paling mudah
 * dilanggar oleh perubahan kecil di kemudian hari: **teks mana yang pergi ke
 * mana**. `reason` ke audit log, `publicReason` ke email pelanggan, dan tak ada
 * satu pun jalur yang menukar keduanya.
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
  createSupabaseAdminClient: () => ({ rpc, from: () => ({}) }),
}));

const { sendSuspendedNotice, sendReinstatedNotice, status } = vi.hoisted(() => {
  const status = { current: "sent" };
  return {
    status,
    sendSuspendedNotice: vi.fn(
      async (_a: unknown, _id: string, _alasan: string | null) =>
        status.current,
    ),
    sendReinstatedNotice: vi.fn(
      async (_a: unknown, _id: string, _tampil: boolean) => status.current,
    ),
  };
});
vi.mock("@/server/email/notify", () => ({
  notifyOrderPaid: vi.fn(async () => "sent"),
  sendSuspendedNotice,
  sendReinstatedNotice,
}));

import {
  adminReinstateInvitationAction,
  adminSuspendInvitationAction,
} from "@/server/actions/admin";

const INV = "44444444-4444-4444-8444-444444444444";
const INTERNAL = "dilaporkan 3 orang, cek nomor 0812-9999-1111";
const PUBLIK = "Undangan memuat materi yang melanggar ketentuan kami.";

function form(reason = INTERNAL, publicReason: string | null = PUBLIK) {
  const fd = new FormData();
  fd.set("reason", reason);
  if (publicReason !== null) fd.set("publicReason", publicReason);
  return fd;
}

async function tangguhkan(fd = form()): Promise<string> {
  try {
    await adminSuspendInvitationAction(INV, fd);
  } catch (e) {
    return String((e as Error).message).replace("REDIRECT ", "");
  }
  throw new Error("aksi tidak me-redirect");
}

async function pulihkan(): Promise<string> {
  try {
    await adminReinstateInvitationAction(INV);
  } catch (e) {
    return String((e as Error).message).replace("REDIRECT ", "");
  }
  throw new Error("aksi tidak me-redirect");
}

const argRpc = () => rpc.mock.calls[0]?.[1];
const msg = (m: string) => `/admin/undangan/${INV}?msg=${m}`;

beforeEach(() => {
  vi.clearAllMocks();
  status.current = "sent";
  rpc.mockResolvedValue({
    data: [{ result: "suspended", slug: "andi-sinta" }],
    error: null,
  });
});

describe("dua kolom alasan tidak pernah tertukar", () => {
  it("RPC menerima KEDUA teks di parameternya masing-masing", async () => {
    await tangguhkan();
    expect(argRpc()).toMatchObject({
      p_reason: INTERNAL,
      p_public_reason: PUBLIK,
    });
  });

  it("email menerima alasan PUBLIK, bukan catatan internal", async () => {
    // Pertukaran di sini mengirim nama pelapor dan nomor telepon pihak ketiga
    // ke orang yang baru saja ditangguhkan karenanya.
    await tangguhkan();
    expect(sendSuspendedNotice.mock.calls[0]?.[2]).toBe(PUBLIK);
  });

  it("kolom publik kosong → `null`, dan email tetap dikirim", async () => {
    // Input teks yang tak diisi mengirim string KOSONG, bukan `null`. Tanpa
    // normalisasi, `""` akan lolos sebagai "alasan" dan email mencetak bagian
    // alasan yang kosong melompong.
    await tangguhkan(form(INTERNAL, ""));
    expect(argRpc()?.p_public_reason).toBeNull();
    expect(sendSuspendedNotice.mock.calls[0]?.[2]).toBeNull();
  });

  it("kolom publik tak ada di form → `null`, bukan gagal validasi", async () => {
    expect(await tangguhkan(form(INTERNAL, null))).toBe(msg("suspend_ok"));
    expect(argRpc()?.p_public_reason).toBeNull();
  });

  it("catatan internal WAJIB — tanpanya tak ada RPC sama sekali", async () => {
    expect(await tangguhkan(form("", PUBLIK))).toBe(msg("suspend_invalid"));
    expect(rpc).not.toHaveBeenCalled();
    expect(sendSuspendedNotice).not.toHaveBeenCalled();
  });

  it("alasan publik kelewat panjang ditolak di server", async () => {
    expect(await tangguhkan(form(INTERNAL, "x".repeat(501)))).toBe(
      msg("suspend_invalid"),
    );
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("gerbang email penangguhan", () => {
  it("transisi `suspended` → email dikirim", async () => {
    expect(await tangguhkan()).toBe(msg("suspend_ok"));
    expect(sendSuspendedNotice).toHaveBeenCalledTimes(1);
  });

  it("`already_suspended` → TIDAK mengirim email lagi", async () => {
    // Klik kedua admin bukan penangguhan kedua. Email ulang akan terbaca sebagai
    // tindakan baru oleh pemilik yang sedang mengajukan banding.
    rpc.mockResolvedValue({
      data: [{ result: "already_suspended", slug: "andi-sinta" }],
      error: null,
    });
    expect(await tangguhkan()).toBe(msg("suspend_ok"));
    expect(sendSuspendedNotice).not.toHaveBeenCalled();
  });

  it("galat RPC → tak ada email, dan dilaporkan", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await tangguhkan()).toBe(msg("suspend_failed"));
    expect(sendSuspendedNotice).not.toHaveBeenCalled();
    expect(reportHandledError).toHaveBeenCalled();
  });

  it.each(["error", "skipped", "nodata"])(
    "email %s → admin diberi tahu, penangguhannya tetap disebut berhasil",
    async (s) => {
      status.current = s;
      expect(await tangguhkan()).toBe(msg("suspend_ok_no_email"));
    },
  );
});

describe("pencabutan penangguhan", () => {
  beforeEach(() => {
    rpc.mockResolvedValue({
      data: [
        { result: "reinstated", slug: "andi-sinta", new_status: "active" },
      ],
      error: null,
    });
  });

  it("pulih ke `active` → email mengabarkan undangan tampil kembali", async () => {
    expect(await pulihkan()).toBe(msg("reinstate_ok"));
    expect(sendReinstatedNotice.mock.calls[0]?.[2]).toBe(true);
  });

  it.each(["expired", "draft"])(
    "pulih ke `%s` → email TIDAK mengaku tampil kembali",
    async (st) => {
      // `new_status` dari RPC, bukan asumsi: reinstate memulihkan status dari
      // `active_until`.
      rpc.mockResolvedValue({
        data: [{ result: "reinstated", slug: "andi-sinta", new_status: st }],
        error: null,
      });
      await pulihkan();
      expect(sendReinstatedNotice.mock.calls[0]?.[2]).toBe(false);
    },
  );

  it("`not_suspended` → tak ada email", async () => {
    rpc.mockResolvedValue({
      data: [
        { result: "not_suspended", slug: "andi-sinta", new_status: "active" },
      ],
      error: null,
    });
    expect(await pulihkan()).toBe(msg("reinstate_not_suspended"));
    expect(sendReinstatedNotice).not.toHaveBeenCalled();
  });

  it("email gagal → admin diberi tahu", async () => {
    status.current = "error";
    expect(await pulihkan()).toBe(msg("reinstate_ok_no_email"));
  });
});

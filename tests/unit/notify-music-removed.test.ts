import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `sendMusicRemovedNotice` (DECISIONS #121) — email takedown musik unggahan.
 * Klon ringkas `notify-suspend.test.ts` untuk aturan yang sama:
 *  1. catatan internal tak pernah ikut (fungsi hanya menerima alasan publik dan
 *     tak membaca `admin_logs`);
 *  2. jalur sanggahan + keterangan kunci selalu tercetak, termasuk tanpa alasan;
 *  3. best-effort: tak pernah melempar, tanpa PII di telemetri.
 */

const { sendTransactionalEmail, reportHandledError } = vi.hoisted(() => ({
  sendTransactionalEmail: vi.fn(),
  reportHandledError: vi.fn(),
}));
vi.mock("@/lib/email/send", () => ({ sendTransactionalEmail }));
vi.mock("@/lib/observability", () => ({ reportHandledError }));

import { copy } from "@/lib/copy";
import { sendMusicRemovedNotice } from "@/server/email/notify";

const USER = "55555555-5555-4555-8555-555555555555";
const INV = "44444444-4444-4444-8444-444444444444";
const EMAIL = "pemilik@contoh.test";
const NAMA = "Andi Prasetyo";
const SLUG = "andi-sinta";
const NOW = Date.parse("2026-11-09T10:00:00.000Z");

const INTERNAL = "dilaporkan label X, kontak 0812-9999-1111";
const PUBLIK = "Pemegang hak cipta lagu ini melaporkan penggunaannya.";
const M = copy.email.musicRemoved;

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

const kabari = (publicReason: string | null = PUBLIK, now = NOW) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendMusicRemovedNotice(adminClient() as any, INV, publicReason, now);

describe("isi email", () => {
  it("dikirim ke pemilik dengan subjek & alasan PUBLIK", async () => {
    expect(await kabari()).toBe("sent");
    const { to, subject, text, html } = kiriman();
    expect(to).toBe(EMAIL);
    expect(subject).toBe(M.subject(SLUG));
    expect(text).toContain(M.intro(SLUG));
    expect(text).toContain(PUBLIK);
    expect(text).not.toContain(INTERNAL);
    expect(html).not.toContain("0812");
  });

  it("fungsinya tak pernah membaca `admin_logs`", async () => {
    const client = adminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await sendMusicRemovedNotice(client as any, INV, PUBLIK, NOW);
    const tabel = client.from.mock.calls.map((c) => c[0]);
    expect(tabel).toEqual(["invitations", "profiles"]);
  });

  it.each([
    ["alasan ditulis", PUBLIK],
    ["alasan kosong", null],
    ["alasan hanya spasi", "   "],
  ])(
    "%s → kunci + jalur sanggahan tercetak di HTML DAN teks",
    async (_n, a) => {
      await kabari(a);
      for (const isi of [kiriman()?.text, kiriman()?.html]) {
        expect(isi).toContain(copy.support.email);
        expect(isi).toContain(M.sanggahJudul);
        expect(isi).toContain(M.kunci);
      }
    },
  );

  it("alasan kosong/spasi → teks pengganti, bukan bagian yang hilang", async () => {
    await kabari("   ");
    const text = kiriman()?.text as string;
    expect(text).toContain(`${M.alasanJudul}: ${M.alasanKosong}`);
  });

  it("alasan DI-ESCAPE di HTML", async () => {
    await kabari('<img src=x onerror="alert(1)">');
    const html = kiriman()?.html as string;
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });

  it("CTA mengarah ke dashboard undangan", async () => {
    await kabari();
    expect(kiriman()?.text).toContain(`/dashboard/undangan/${INV}`);
  });
});

describe("pencarian pemilik", () => {
  it("undangan tanpa pemilik → `nodata`, TANPA laporan", async () => {
    k.invitations = { data: { slug: SLUG, user_id: null }, error: null };
    expect(await kabari()).toBe("nodata");
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("undangan hilang → `nodata` DAN dilaporkan", async () => {
    k.invitations = { data: null, error: null };
    expect(await kabari()).toBe("nodata");
    expect(laporan()[0]?.[1]).toBe("email.music-removed");
  });
});

describe("idempotency & kegagalan", () => {
  it("klik ganda dalam menit yang sama → kunci sama; menit lain → beda", async () => {
    await kabari(PUBLIK, NOW);
    const a = kiriman()?.idempotencyKey;
    sendTransactionalEmail.mockClear();
    await kabari(PUBLIK, NOW + 5_000);
    expect(kiriman()?.idempotencyKey).toBe(a);
    sendTransactionalEmail.mockClear();
    await kabari(PUBLIK, NOW + 120_000);
    expect(kiriman()?.idempotencyKey).not.toBe(a);
  });

  it("kuncinya tak bertabrakan dengan email penangguhan", async () => {
    await kabari();
    expect(kiriman()?.idempotencyKey).toMatch(/^music-removed\//);
  });

  it("Resend gagal → `error` + kode galatnya, tanpa PII", async () => {
    sendTransactionalEmail.mockResolvedValue({
      status: "error",
      code: "rate_limit_exceeded",
      statusCode: 429,
    });
    expect(await kabari()).toBe("error");
    const [err, area, extra] = laporan()[0];
    expect((err as Error).message).toBe("resend:rate_limit_exceeded");
    expect(area).toBe("email.music-removed");
    expect(extra).toMatchObject({ invitationId: INV, statusCode: 429 });
    const jejak = JSON.stringify(laporan());
    for (const pii of [EMAIL, NAMA, SLUG, PUBLIK]) {
      expect(jejak).not.toContain(pii);
    }
  });

  it("lemparan tak terduga → `error`, bukan melempar keluar", async () => {
    sendTransactionalEmail.mockRejectedValue(new Error("jaringan putus"));
    await expect(kabari()).resolves.toBe("error");
  });
});

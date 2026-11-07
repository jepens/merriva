import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Laporan backup media (DECISIONS #117). Skrip host `scripts/backup-media.sh`
 * memanggil route ini sesudah unggahannya TERBUKTI (atau gagal), dan route ini
 * satu-satunya jalan hasil backup sampai ke panel /admin dan `ops:verify`.
 *
 * Yang dijaga:
 * - tanpa CRON_SECRET yang benar, tak ada yang tercatat (siapa pun bisa
 *   memalsukan "backup sehat" kalau tidak);
 * - laporan gagal tercatat GAGAL beserta pesannya — panel menampilkan
 *   `last_error`, bukan sekadar angka;
 * - bentuk laporan yang tak dikenal DITOLAK, bukan dicatat sebagai sukses.
 */

const { refs } = vi.hoisted(() => ({
  refs: {
    authorized: true,
    panggilan: [] as Array<{
      nama: string;
      ok: boolean;
      stats: Record<string, unknown>;
      error: unknown;
    }>,
    sentry: [] as Array<{ err: unknown; area: string }>,
  },
}));

vi.mock("@/server/cron/auth", () => ({
  isAuthorizedCron: () => refs.authorized,
}));
vi.mock("@/lib/observability", () => ({
  reportHandledError: vi.fn((err: unknown, area: string) => {
    refs.sentry.push({ err, area });
  }),
}));
vi.mock("@/server/cron/record", () => ({
  recordCronRun: vi.fn(
    async (
      nama: string,
      ok: boolean,
      stats: Record<string, unknown>,
      error?: unknown,
    ) => {
      refs.panggilan.push({ nama, ok, stats, error });
    },
  ),
}));

const { POST } = await import("@/app/api/cron/backup-media/route");

function req(body: string): Request {
  return new Request("http://localhost/api/cron/backup-media", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

beforeEach(() => {
  refs.authorized = true;
  refs.panggilan = [];
  refs.sentry = [];
});

describe("POST /api/cron/backup-media", () => {
  it("tanpa otorisasi → 401 dan TIDAK mencatat apa pun", async () => {
    refs.authorized = false;
    const res = await POST(req('{"ok":true,"files":48,"bytes":14680064}'));
    expect(res.status).toBe(401);
    expect(refs.panggilan).toEqual([]);
  });

  it("laporan sukses → dicatat ok dengan jumlah berkas & ukuran", async () => {
    const res = await POST(req('{"ok":true,"files":48,"bytes":14680064}'));
    expect(res.status).toBe(200);
    expect(refs.panggilan).toEqual([
      {
        nama: "backup-media",
        ok: true,
        stats: { files: 48, bytes: 14680064 },
        error: undefined,
      },
    ]);
    expect(refs.sentry).toEqual([]);
  });

  it("laporan gagal → dikirim ke Sentry (area cron.backup-media), seperti cron lain", async () => {
    // Panel tak mendorong notifikasi; lifecycle bucket terus menghapus snapshot
    // lama walau yang baru gagal. Galat yang sama yang tercatat di panel.
    await POST(
      req('{"ok":false,"error":"unggah ditolak: HTTP 403 AccessDenied"}'),
    );
    expect(refs.sentry).toHaveLength(1);
    expect(refs.sentry[0].area).toBe("cron.backup-media");
    expect(refs.sentry[0].err).toBe(refs.panggilan[0].error);
  });

  it("laporan gagal → dicatat GAGAL dengan pesan dari skrip", async () => {
    const res = await POST(
      req('{"ok":false,"error":"unggah ditolak: SignatureDoesNotMatch"}'),
    );
    expect(res.status).toBe(200);
    expect(refs.panggilan).toHaveLength(1);
    const [p] = refs.panggilan;
    expect(p.nama).toBe("backup-media");
    expect(p.ok).toBe(false);
    expect(p.stats).toEqual({ files: 0, bytes: 0 });
    expect(p.error).toBeInstanceOf(Error);
    expect((p.error as Error).message).toBe(
      "unggah ditolak: SignatureDoesNotMatch",
    );
  });

  it("laporan gagal tanpa pesan tetap punya last_error yang terbaca", async () => {
    await POST(req('{"ok":false}'));
    expect((refs.panggilan[0].error as Error).message).toBe(
      "backup gagal tanpa pesan",
    );
  });

  it.each([
    ["bukan JSON", "ok"],
    ["ok bukan boolean", '{"ok":"true"}'],
    ["tanpa ok", '{"files":48}'],
    ["kunci tak dikenal", '{"ok":true,"lunas":true}'],
    ["angka negatif", '{"ok":true,"files":-1}'],
    ["angka pecahan", '{"ok":true,"bytes":1.5}'],
    [
      "pesan terlalu panjang",
      JSON.stringify({ ok: false, error: "x".repeat(301) }),
    ],
  ])(
    "bentuk tak dikenal (%s) → 400, tak dicatat sebagai sukses",
    async (_n, body) => {
      const res = await POST(req(body));
      expect(res.status).toBe(400);
      expect(refs.panggilan).toEqual([]);
      expect(refs.sentry).toEqual([]);
    },
  );
});

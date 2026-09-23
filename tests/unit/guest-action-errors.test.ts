import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Aksi TAMU saat DB berkedip (DECISIONS #46). Aksi ini dipanggil dari klien
 * (tak ter-cache), tetapi jawabannya dulu menyesatkan:
 *  - personalisasi `?g=` → "token tak dikenal": sapaan hilang DAN token dibuang,
 *    sehingga RSVP tak tertaut ke tamu, pax dipotong ke 2, dan ekspor tamu
 *    menandainya "belum RSVP";
 *  - RSVP/amplop → "Undangan ini sedang tidak menerima konfirmasi" (terdengar
 *    permanen, tamu tak mencoba lagi); atau lebih buruk, RSVP TERSIMPAN tak
 *    tertaut lalu dilaporkan sukses;
 *  - dinding ucapan → "Belum ada ucapan" padahal ada puluhan.
 * Galat disuntik berbentuk OBJEK POLOS seperti keluaran postgrest-js.
 */

const { reportHandledError } = vi.hoisted(() => ({
  reportHandledError: vi.fn(),
}));
vi.mock("@/lib/observability", () => ({ reportHandledError }));
vi.mock("@/lib/request-ip", () => ({
  checkClientRateLimit: vi.fn(async () => ({
    ok: true,
    remaining: 9,
    retryAfterMs: 0,
  })),
  getClientIp: async () => "1.2.3.4",
}));
vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: vi.fn(async () => true),
}));

type Res = { data: unknown; error: unknown };

const { refs } = vi.hoisted(() => ({
  refs: {
    tables: {} as Record<string, Res>,
    inserts: [] as { table: string; payload: unknown }[],
    updates: [] as string[],
    updateError: null as unknown,
    insertError: null as unknown,
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      const res = () => refs.tables[table] ?? { data: null, error: null };
      const chain: Record<string, unknown> = {};
      for (const op of ["select", "eq", "is", "not", "neq", "order", "range"]) {
        chain[op] = () => chain;
      }
      chain.insert = (payload: unknown) => {
        refs.inserts.push({ table, payload });
        return Promise.resolve({ error: refs.insertError });
      };
      chain.update = () => {
        refs.updates.push(table);
        const upd: Record<string, unknown> = {};
        for (const op of ["eq", "is"]) upd[op] = () => upd;
        upd.then = (ok: (v: unknown) => unknown) =>
          Promise.resolve({ error: refs.updateError }).then(ok);
        return upd;
      };
      chain.maybeSingle = () => Promise.resolve(res());
      chain.then = (
        ok: (v: unknown) => unknown,
        fail: (e: unknown) => unknown,
      ) => Promise.resolve(res()).then(ok, fail);
      return chain;
    },
  }),
}));

import { copy } from "@/lib/copy";
import { viewGuestByTokenAction } from "@/server/actions/personalization";
import {
  getGuestbookAction,
  submitGiftNoteAction,
  submitRsvpAction,
} from "@/server/actions/guestbook";

const SLUG = "andi-sinta";
const TOKEN = "tokentamu123";
/** Bentuk galat postgrest-js sungguhan (objek polos, bukan Error). */
const BOOM = {
  message: "canceling statement due to statement timeout",
  details: null,
  hint: null,
  code: "57014",
};

const INV_AKTIF = { data: { id: "inv-1", status: "active" }, error: null };

beforeEach(() => {
  refs.tables = {
    invitations: INV_AKTIF,
    guests: { data: null, error: null },
    rsvps: { data: [], error: null },
    gift_notes: { data: null, error: null },
  };
  refs.inserts = [];
  refs.updates = [];
  refs.updateError = null;
  refs.insertError = null;
  reportHandledError.mockClear();
});

describe("personalisasi ?g= — galat DB ≠ token tak dikenal", () => {
  it("galat membaca undangan → status 'error' (bukan 'none'); dilaporkan", async () => {
    refs.tables.invitations = { data: null, error: BOOM };
    expect(await viewGuestByTokenAction(SLUG, TOKEN)).toEqual({
      status: "error",
    });
    expect(reportHandledError).toHaveBeenCalledWith(
      BOOM,
      "personalization.invitation",
      { slug: SLUG },
    );
  });

  it("galat mencari tamu → 'error'; token TIDAK ikut dilaporkan (identitas tamu)", async () => {
    refs.tables.guests = { data: null, error: BOOM };
    expect(await viewGuestByTokenAction(SLUG, TOKEN)).toEqual({
      status: "error",
    });
    const [, area, extra] = reportHandledError.mock.calls.at(-1)!;
    expect(area).toBe("personalization.guest");
    expect(JSON.stringify(extra)).not.toContain(TOKEN);
  });

  it("token memang tak dikenal (tanpa galat) → tetap 'none'", async () => {
    expect(await viewGuestByTokenAction(SLUG, TOKEN)).toEqual({
      status: "none",
    });
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("gagal menandai first_viewed_at tak menggagalkan sapaan, hanya dilaporkan", async () => {
    refs.tables.guests = {
      data: { id: "g-1", name: "Sasa", first_viewed_at: null },
      error: null,
    };
    refs.updateError = BOOM;
    const res = await viewGuestByTokenAction(SLUG, TOKEN);
    expect(res).toEqual({ status: "ok", name: "Sasa" });
    expect(refs.updates).toContain("guests");
    expect(reportHandledError).toHaveBeenCalledWith(
      BOOM,
      "personalization.firstViewed",
      { slug: SLUG },
    );
  });
});

describe("submitRsvpAction — galat DB tak boleh terdengar permanen / tersimpan salah", () => {
  const input = {
    slug: SLUG,
    guestName: "Sasa",
    attendance: "yes" as const,
    pax: 4,
    message: "Selamat!",
    guestToken: TOKEN,
    turnstileToken: "tok",
  };

  it("galat membaca undangan → galat biasa (BUKAN 'tidak menerima konfirmasi'), tanpa menyimpan", async () => {
    refs.tables.invitations = { data: null, error: BOOM };
    const res = await submitRsvpAction(input);
    expect(res).toEqual({ status: "error", message: copy.common.error });
    expect(res).not.toMatchObject({ reason: "closed" });
    expect(refs.inserts).toHaveLength(0);
    expect(reportHandledError).toHaveBeenCalledWith(BOOM, "rsvp.invitation", {
      slug: SLUG,
    });
  });

  it("galat mencari tamu bertoken → DITOLAK, bukan RSVP tak tertaut yang dilaporkan sukses", async () => {
    refs.tables.guests = { data: null, error: BOOM };
    const res = await submitRsvpAction(input);
    expect(res).toEqual({ status: "error", message: copy.common.error });
    expect(refs.inserts).toHaveLength(0);
    expect(reportHandledError).toHaveBeenCalledWith(BOOM, "rsvp.guest", {
      slug: SLUG,
    });
  });

  it("tamu bertoken ditemukan → tersimpan tertaut dengan jatah pax-nya", async () => {
    refs.tables.guests = {
      data: { id: "g-1", pax_allocated: 5 },
      error: null,
    };
    expect(await submitRsvpAction(input)).toMatchObject({ status: "success" });
    expect(refs.inserts[0].payload).toMatchObject({
      guest_id: "g-1",
      pax: 4,
    });
  });

  it("undangan memang tak aktif (tanpa galat) → tetap pesan 'ditutup'", async () => {
    refs.tables.invitations = {
      data: { id: "inv-1", status: "expired" },
      error: null,
    };
    expect(await submitRsvpAction(input)).toMatchObject({ reason: "closed" });
    expect(refs.inserts).toHaveLength(0);
  });
});

describe("submitGiftNoteAction", () => {
  const input = {
    slug: SLUG,
    guestName: "Sasa",
    type: "transfer" as const,
    amount: "150000",
    note: "Semoga bahagia",
    guestToken: TOKEN,
    turnstileToken: "tok",
  };

  it("galat membaca undangan → galat biasa, tanpa menyimpan", async () => {
    refs.tables.invitations = { data: null, error: BOOM };
    expect(await submitGiftNoteAction(input)).toEqual({
      status: "error",
      message: copy.common.error,
    });
    expect(refs.inserts).toHaveLength(0);
  });

  it("galat mencari nama tamu → catatan TETAP tersimpan dengan nama dari form; dilaporkan", async () => {
    refs.tables.guests = { data: null, error: BOOM };
    expect(await submitGiftNoteAction(input)).toEqual({ status: "success" });
    expect(refs.inserts[0]).toMatchObject({
      table: "gift_notes",
      payload: { guest_name: "Sasa" },
    });
    expect(reportHandledError).toHaveBeenCalledWith(BOOM, "gift.guest", {
      slug: SLUG,
    });
  });
});

describe("getGuestbookAction — dinding ucapan", () => {
  it("galat membaca undangan → penanda gagal (UI menampilkan 'coba lagi', bukan 'belum ada ucapan')", async () => {
    refs.tables.invitations = { data: null, error: BOOM };
    expect(await getGuestbookAction(SLUG)).toEqual({
      entries: [],
      hasMore: false,
      failed: true,
    });
    expect(reportHandledError).toHaveBeenCalledWith(
      BOOM,
      "guestbook.invitation",
      { slug: SLUG },
    );
  });

  it("galat membaca ucapan → penanda gagal; dilaporkan", async () => {
    refs.tables.rsvps = { data: null, error: BOOM };
    expect(await getGuestbookAction(SLUG)).toEqual({
      entries: [],
      hasMore: false,
      failed: true,
    });
    expect(reportHandledError).toHaveBeenCalledWith(BOOM, "guestbook.rsvps", {
      slug: SLUG,
    });
  });

  it("dinding memang kosong (tanpa galat) → TANPA penanda gagal", async () => {
    const res = await getGuestbookAction(SLUG);
    expect(res.entries).toEqual([]);
    expect(res.failed).toBeUndefined();
    expect(reportHandledError).not.toHaveBeenCalled();
  });
});

/**
 * Galat TULIS juga dilaporkan (DECISIONS #46 butir 7 — koreksi temuan review).
 * Sebelumnya INSERT/UPDATE yang gagal hanya menjadi "Terjadi kesalahan" tanpa
 * satu pun sinyal: RSVP tamu hilang di hari-H dan tim tak pernah tahu.
 */
describe("galat TULIS ikut dilaporkan", () => {
  const rsvp = {
    slug: SLUG,
    guestName: "Sasa",
    attendance: "yes" as const,
    pax: 2,
    message: "Selamat!",
    turnstileToken: "tok",
  };

  it("INSERT rsvps gagal → galat biasa + dilaporkan", async () => {
    refs.insertError = BOOM;
    expect(await submitRsvpAction(rsvp)).toEqual({
      status: "error",
      message: copy.common.error,
    });
    expect(reportHandledError).toHaveBeenCalledWith(BOOM, "rsvp.insert", {
      slug: SLUG,
    });
  });

  it("kiriman ULANG tamu bertoken (23505) → UPDATE; gagal → dilaporkan", async () => {
    refs.tables.guests = { data: { id: "g-1", pax_allocated: 5 }, error: null };
    refs.insertError = { ...BOOM, code: "23505" };
    refs.updateError = BOOM;

    expect(await submitRsvpAction({ ...rsvp, guestToken: TOKEN })).toEqual({
      status: "error",
      message: copy.common.error,
    });
    expect(refs.updates).toContain("rsvps");
    expect(reportHandledError).toHaveBeenCalledWith(BOOM, "rsvp.update", {
      slug: SLUG,
    });
  });

  it("23505 tanpa token → tetap galat, TIDAK menimpa RSVP tamu lain", async () => {
    refs.insertError = { ...BOOM, code: "23505" };
    expect(await submitRsvpAction(rsvp)).toMatchObject({ status: "error" });
    expect(refs.updates).not.toContain("rsvps");
  });

  it("INSERT gift_notes gagal → galat biasa + dilaporkan", async () => {
    refs.insertError = BOOM;
    expect(
      await submitGiftNoteAction({
        slug: SLUG,
        guestName: "Sasa",
        type: "transfer" as const,
        amount: "150000",
        note: "Semoga bahagia",
        turnstileToken: "tok",
      }),
    ).toEqual({ status: "error", message: copy.common.error });
    expect(reportHandledError).toHaveBeenCalledWith(BOOM, "gift.insert", {
      slug: SLUG,
    });
  });
});

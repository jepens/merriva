import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Invarian PER-3 untuk dinding ucapan: penolakan rate limit WAJIB dapat
 * dibedakan dari "belum ada ucapan".
 *
 * Sebelumnya `getGuestbookAction` mengembalikan `{entries: [], hasMore: false}`
 * saat ditolak — identik dengan dinding yang memang kosong. Di WiFi venue plafon
 * lama (40/menit per /24, tanpa cakupan) habis setelah 40 pemuatan, sehingga
 * tamu berikutnya melihat "Belum ada ucapan. Jadilah yang pertama!" padahal
 * ucapan sudah banyak. Limiter & keying IP di sini ASLI.
 */

const { ipRef } = vi.hoisted(() => ({ ipRef: { current: "198.51.100.4" } }));
vi.mock("next/headers", () => ({
  headers: () =>
    Promise.resolve(new Headers({ "cf-connecting-ip": ipRef.current })),
}));

const { adminRef } = vi.hoisted(() => ({
  adminRef: { current: null as never },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => adminRef.current,
}));

import { __resetRateLimit } from "@/lib/rate-limit";
import { getGuestbookAction } from "@/server/actions/guestbook";

/** Satu ucapan tersetujui → hasil "tidak kosong" bila query benar-benar jalan. */
function makeAdmin() {
  const row = {
    id: "r1",
    guest_name: "Sasa",
    message: "Selamat menempuh hidup baru!",
    created_at: "2026-09-05T10:00:00Z",
  };
  return {
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "not", "neq", "order"])
        chain[m] = () => chain;
      chain.maybeSingle = () =>
        Promise.resolve({
          data: { id: "inv-1", status: "active" },
          error: null,
        });
      chain.range = () => Promise.resolve({ data: [row], error: null });
      return table === "invitations" ? chain : chain;
    },
  };
}

beforeEach(() => {
  __resetRateLimit();
  ipRef.current = "198.51.100.4";
  adminRef.current = makeAdmin() as never;
});

describe("getGuestbookAction — rate limit terlihat, bukan 'kosong' palsu", () => {
  it("melampaui plafon → rateLimited:true (BUKAN daftar kosong diam-diam)", async () => {
    let last = await getGuestbookAction("andi-sinta", 0);
    for (let i = 0; i < 601 && !last.rateLimited; i += 1) {
      last = await getGuestbookAction("andi-sinta", 0);
    }
    expect(last.rateLimited).toBe(true);
    expect(last.entries).toEqual([]);
  });

  it("plafon baru melampaui 40/menit lama (venue 300 tamu)", async () => {
    let ok = 0;
    for (let i = 0; i < 300; i += 1) {
      const res = await getGuestbookAction("andi-sinta", 0);
      if (!res.rateLimited) ok += 1;
    }
    expect(ok).toBe(300);
  });

  it("kunci di-scope per undangan: acara lain sejaringan tidak ikut terkunci", async () => {
    for (let i = 0; i < 600; i += 1) await getGuestbookAction("andi-sinta", 0);
    expect((await getGuestbookAction("andi-sinta", 0)).rateLimited).toBe(true);

    // Undangan berbeda, jaringan SAMA → bucket sendiri.
    const lain = await getGuestbookAction("budi-rina", 0);
    expect(lain.rateLimited).toBeUndefined();
    expect(lain.entries.length).toBe(1);
  });

  it("dinding yang benar-benar kosong tetap tanpa penanda rate limit", async () => {
    const res = await getGuestbookAction("andi-sinta", 0);
    expect(res.rateLimited).toBeUndefined();
    expect(res.entries.length).toBe(1);
  });
});

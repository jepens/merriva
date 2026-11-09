import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `saveInvitationDraftAction` ASLI (bukan tiruan) — kontrak galat yang dipakai
 * editor untuk menandai isian (DECISIONS #41): kunci = PATH LENGKAP (sama dengan
 * `name` isian), pesan berbahasa Indonesia, pesan kustom skema dipertahankan,
 * dan database tak disentuh bila validasi gagal. Dulu `flatten()` meratakan
 * semuanya ke `content` dengan pesan bawaan Zod berbahasa Inggris.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { refs } = vi.hoisted(() => ({ refs: { server: null as unknown } }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => Promise.resolve(refs.server),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({}),
}));

import { DEFAULT_SETTINGS, emptyContent } from "@/lib/validation/content";
import { saveInvitationDraftAction } from "@/server/actions/invitation";

const INV = "44444444-4444-4444-8444-444444444444";

function payload(
  content: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) {
  return {
    content: { ...emptyContent("wedding"), ...content },
    settings: DEFAULT_SETTINGS,
    eventDate: "",
    events: [],
    ...extra,
  };
}

beforeEach(() => {
  refs.server = {
    auth: { getUser: async () => ({ data: { user: { id: "u-1" } } }) },
    from: () => {
      throw new Error("database tak boleh disentuh saat validasi gagal");
    },
    rpc: () => {
      throw new Error("database tak boleh disentuh saat validasi gagal");
    },
  };
});

describe("saveInvitationDraftAction — galat per isian", () => {
  it("teks kepanjangan: kunci path lengkap, pesan Indonesia", async () => {
    const res = await saveInvitationDraftAction(
      INV,
      payload({ story: [{ title: "Awal", narrative: "a".repeat(2001) }] }),
    );
    expect(res).toEqual({
      status: "error",
      fieldErrors: {
        "content.story.0.narrative": ["Maksimal 2.000 karakter."],
      },
    });
  });

  it("daftar kepanjangan: galat di path daftarnya", async () => {
    const story = Array.from({ length: 21 }, () => ({
      title: "",
      narrative: "",
    }));
    const res = await saveInvitationDraftAction(INV, payload({ story }));
    expect(res).toEqual({
      status: "error",
      fieldErrors: { "content.story": ["Maksimal 20 entri."] },
    });
  });

  it("pesan kustom skema tetap menang atas peta pesan", async () => {
    const res = await saveInvitationDraftAction(
      INV,
      payload({ youtubeUrl: "javascript:alert(1)" }),
    );
    expect(res).toEqual({
      status: "error",
      fieldErrors: { "content.youtubeUrl": ["Tautan tidak valid"] },
    });
  });

  it("nilai bertipe/pilihan salah tidak pernah menampilkan pesan bawaan Zod", async () => {
    const res = await saveInvitationDraftAction(
      INV,
      payload(
        {},
        { settings: { ...DEFAULT_SETTINGS, timezone: "Mars/Olympus" } },
      ),
    );
    expect(res.status).toBe("error");
    const pesan =
      res.status === "error" ? Object.values(res.fieldErrors ?? {}).flat() : [];
    expect(pesan.length).toBeGreaterThan(0);
    for (const m of pesan) {
      expect(m).not.toMatch(/invalid|expected|option|received|too big/i);
    }
    expect(
      Object.keys(res.status === "error" ? (res.fieldErrors ?? {}) : {}),
    ).toContain("settings.timezone");
  });
});

/**
 * Musik unggahan dikunci admin (takedown, DECISIONS #121): tab editor yang
 * masih terbuka memegang rujukan lama dan menulisnya kembali di autosave. Aksi
 * membuangnya selama `music_locked_at` terisi — supaya rujukan ke objek yang
 * sudah dihapus tak hidup lagi saat kunci dibuka.
 */
describe("saveInvitationDraftAction — musik unggahan terkunci", () => {
  const MUSIK = {
    path: `audio/${INV}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.mp3`,
    name: "Lagu Kami.mp3",
  };

  function pasangKlien(lockedAt: string | null) {
    const ditulis: Array<Record<string, unknown>> = [];
    refs.server = {
      auth: { getUser: async () => ({ data: { user: { id: "u-1" } } }) },
      from: (tabel: string) => {
        expect(tabel).toBe("invitations");
        const b = {
          select: () => b,
          eq: () => b,
          update: (row: Record<string, unknown>) => {
            ditulis.push(row);
            return b;
          },
          maybeSingle: async () =>
            ditulis.length === 0
              ? {
                  data: {
                    settings: DEFAULT_SETTINGS,
                    music_locked_at: lockedAt,
                  },
                  error: null,
                }
              : { data: { slug: "lala-lele" }, error: null },
        };
        return b;
      },
      rpc: async () => ({ data: null, error: null }),
    };
    return ditulis;
  }

  // supabase-js mengirim body sebagai JSON — kunci bernilai undefined hilang.
  const sebagaiJson = (v: unknown) => JSON.parse(JSON.stringify(v));

  it("terkunci: customMusic dari klien TIDAK ikut tersimpan", async () => {
    const ditulis = pasangKlien("2026-11-09T01:00:00Z");
    const res = await saveInvitationDraftAction(
      INV,
      payload({ customMusic: MUSIK }),
    );
    expect(res).toEqual({ status: "success" });
    expect(ditulis).toHaveLength(1);
    expect(sebagaiJson(ditulis[0]!.content)).not.toHaveProperty("customMusic");
  });

  it("tidak terkunci: customMusic tersimpan apa adanya", async () => {
    const ditulis = pasangKlien(null);
    const res = await saveInvitationDraftAction(
      INV,
      payload({ customMusic: MUSIK }),
    );
    expect(res).toEqual({ status: "success" });
    expect(sebagaiJson(ditulis[0]!.content).customMusic).toEqual(MUSIK);
  });
});

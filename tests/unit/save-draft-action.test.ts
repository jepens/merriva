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

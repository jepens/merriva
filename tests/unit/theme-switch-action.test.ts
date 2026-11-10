import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Aksi ganti tema (SPEC §4.4 "Ganti tema", DECISIONS #124): auth →
 * kepemilikan → validasi → status → tema (aktif, sekategori, kodenya ada) →
 * paket → SATU UPDATE `theme_id` + `settings` tanpa `custom` → revalidasi.
 * Penolakan trigger DB (23514) diterjemahkan ke pesan Indonesia.
 */

const ID = "9a500f03-f12d-4d66-85fc-af8ebcedd350";

const { refs, limits, reportHandledError, revalidatePath } = vi.hoisted(() => ({
  refs: {
    user: { id: "u-1" } as { id: string } | null,
    inv: null as Record<string, unknown> | null,
    theme: null as Record<string, unknown> | null,
    updateError: null as { code: string; message: string } | null,
    updates: [] as unknown[],
  },
  limits: vi.fn(),
  reportHandledError: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/observability", () => ({ reportHandledError }));
vi.mock("@/server/limits", () => ({ getEffectiveLimits: limits }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: refs.user } }) },
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.update = (payload: unknown) => {
        refs.updates.push(payload);
        return chain;
      };
      chain.then = (ok: (v: unknown) => unknown) =>
        Promise.resolve({ error: refs.updateError }).then(ok);
      chain.maybeSingle = () =>
        Promise.resolve({
          data: table === "invitations" ? refs.inv : refs.theme,
          error: null,
        });
      return chain;
    },
  }),
}));

import { copy } from "@/lib/copy";
import { changeInvitationThemeAction } from "@/server/actions/theme";

const SETTINGS = {
  timezone: "Asia/Jakarta",
  songId: "lagu-1",
  sections: { story: false },
  custom: { v: 1, variant: "rose" },
};

function undangan(over: Record<string, unknown> = {}) {
  return {
    id: ID,
    slug: "rani-wanda",
    status: "active",
    category: "wedding",
    settings: SETTINGS,
    theme_id: "t-lama",
    package_id: "pkg-basic",
    purged_at: null,
    ...over,
  };
}

function tema(over: Record<string, unknown> = {}) {
  return {
    id: "t-warta",
    slug: "warta",
    tier: "standard",
    categories: ["wedding"],
    is_active: true,
    ...over,
  };
}

beforeEach(() => {
  refs.user = { id: "u-1" };
  refs.inv = undangan();
  refs.theme = tema();
  refs.updateError = null;
  refs.updates = [];
  limits.mockReset();
  limits.mockResolvedValue({ allThemes: false });
  reportHandledError.mockClear();
  revalidatePath.mockClear();
});

describe("changeInvitationThemeAction", () => {
  it("sukses: satu UPDATE theme_id + settings TANPA custom, lalu revalidasi halaman publik", async () => {
    const res = await changeInvitationThemeAction(ID, "warta");
    expect(res).toEqual({ status: "success", message: copy.themeSwitch.saved });
    expect(refs.updates).toEqual([
      {
        theme_id: "t-warta",
        settings: {
          timezone: "Asia/Jakarta",
          songId: "lagu-1",
          sections: { story: false },
        },
      },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/rani-wanda");
    expect(revalidatePath).toHaveBeenCalledWith(
      `/dashboard/undangan/${ID}/edit`,
    );
  });

  it("belum login → galat auth, tanpa menulis", async () => {
    refs.user = null;
    const res = await changeInvitationThemeAction(ID, "warta");
    expect(res).toEqual({
      status: "error",
      message: copy.auth.genericAuthError,
    });
    expect(refs.updates).toEqual([]);
  });

  it.each([123, "", "Warta", "../x", "a b"])(
    "slug tak sah (%s) → tema tak tersedia, tanpa menulis",
    async (slug) => {
      const res = await changeInvitationThemeAction(ID, slug);
      expect(res).toEqual({
        status: "error",
        message: copy.themeSwitch.unavailable,
      });
      expect(refs.updates).toEqual([]);
    },
  );

  it("bukan pemilik (baris tak terlihat) → galat umum", async () => {
    refs.inv = null;
    const res = await changeInvitationThemeAction(ID, "warta");
    expect(res).toEqual({ status: "error", message: copy.common.error });
    expect(refs.updates).toEqual([]);
  });

  it.each([
    [{ status: "suspended" }],
    [{ status: "expired", purged_at: "2026-11-01T00:00:00Z" }],
  ])("undangan %o → tak bisa ganti tema", async (over) => {
    refs.inv = undangan(over);
    const res = await changeInvitationThemeAction(ID, "warta");
    expect(res).toEqual({
      status: "error",
      message: copy.themeSwitch.notAllowed,
    });
    expect(refs.updates).toEqual([]);
  });

  it.each([
    ["nonaktif", { is_active: false }],
    ["kategori lain", { categories: ["corporate"] }],
    ["tanpa kode tema", { slug: "tema-tanpa-kode" }],
  ])("tema %s → tak tersedia, tanpa menulis", async (_l, over) => {
    refs.theme = tema(over);
    const res = await changeInvitationThemeAction(
      ID,
      (over as { slug?: string }).slug ?? "warta",
    );
    expect(res).toEqual({
      status: "error",
      message: copy.themeSwitch.unavailable,
    });
    expect(refs.updates).toEqual([]);
  });

  it("tema yang sama → sukses tanpa menulis (kustomisasi tak direset)", async () => {
    refs.theme = tema({ id: "t-lama" });
    const res = await changeInvitationThemeAction(ID, "warta");
    expect(res.status).toBe("success");
    expect(refs.updates).toEqual([]);
  });

  it("tema PREMIUM untuk undangan aktif Basic → perlu Premium, tanpa menulis", async () => {
    refs.theme = tema({ tier: "premium" });
    const res = await changeInvitationThemeAction(ID, "warta");
    expect(res).toEqual({
      status: "error",
      message: copy.themeSwitch.needsPremium,
    });
    expect(refs.updates).toEqual([]);
  });

  it("tema PREMIUM untuk draft yang belum dibayar → boleh (rasakan dulu)", async () => {
    refs.inv = undangan({ status: "draft", package_id: null });
    refs.theme = tema({ tier: "premium" });
    const res = await changeInvitationThemeAction(ID, "warta");
    expect(res.status).toBe("success");
    expect(refs.updates).toHaveLength(1);
  });

  it("penolakan trigger premium (order Basic pending) → pesan tagihan menunggu, BUKAN ajakan upgrade", async () => {
    refs.inv = undangan({ status: "pending_payment", package_id: null });
    refs.theme = tema({ tier: "premium" });
    refs.updateError = {
      code: "23514",
      message: "Tema premium hanya untuk paket Premium.",
    };
    const res = await changeInvitationThemeAction(ID, "warta");
    expect(res).toEqual({
      status: "error",
      message: copy.themeSwitch.pendingOrder,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("penolakan trigger lain (tema dinonaktifkan di tengah jalan) → tema tak tersedia", async () => {
    refs.updateError = {
      code: "23514",
      message: "Tema tidak tersedia untuk undangan ini.",
    };
    const res = await changeInvitationThemeAction(ID, "warta");
    expect(res).toEqual({
      status: "error",
      message: copy.themeSwitch.unavailable,
    });
  });

  it("galat DB lain saat menulis → galat ganti tema, dilaporkan", async () => {
    refs.updateError = { code: "", message: "TypeError: fetch failed" };
    const res = await changeInvitationThemeAction(ID, "warta");
    expect(res).toEqual({ status: "error", message: copy.themeSwitch.error });
    expect(reportHandledError).toHaveBeenCalledOnce();
  });

  it("galat membaca paket → galat umum, tanpa menulis, dilaporkan", async () => {
    refs.theme = tema({ tier: "premium" });
    limits.mockRejectedValue(new Error("packages: koneksi DB terputus"));
    const res = await changeInvitationThemeAction(ID, "warta");
    expect(res).toEqual({ status: "error", message: copy.common.error });
    expect(refs.updates).toEqual([]);
    expect(reportHandledError).toHaveBeenCalledOnce();
  });
});

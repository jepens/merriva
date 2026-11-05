import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Aksi kustomisasi tampilan saat DB berkedip (DECISIONS #45):
 *  - `getEffectiveLimits` kini MELEMPAR galat DB alih-alih pura-pura Basic →
 *    aksi membalas galat biasa: tak menolak kustomisasi Premium milik pemilik
 *    Premium, tak melempar ke klien (editor tampilan tak punya penangkapnya);
 *  - galat membaca tema bukan "tema belum mendukung kustomisasi" (pesan
 *    permanen yang keliru);
 *  - keduanya tak menulis apa pun dan DILAPORKAN ke Sentry (galat yang
 *    ditangani tak sampai `onRequestError`).
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ID = "9a500f03-f12d-4d66-85fc-af8ebcedd350";

const { refs, limits, reportHandledError } = vi.hoisted(() => ({
  refs: { updates: 0, themeError: null as unknown },
  limits: vi.fn(),
  reportHandledError: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({ reportHandledError }));
vi.mock("@/server/limits", () => ({ getEffectiveLimits: limits }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u-1" } } }) },
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.update = () => {
        refs.updates += 1;
        return chain;
      };
      chain.then = (ok: (v: unknown) => unknown) =>
        Promise.resolve({ error: null }).then(ok);
      chain.maybeSingle = () =>
        Promise.resolve(
          table === "invitations"
            ? {
                data: {
                  id: ID,
                  slug: "andi-sinta",
                  settings: {},
                  theme_id: "t-1",
                  package_id: "pkg-premium",
                },
                error: null,
              }
            : refs.themeError
              ? { data: null, error: refs.themeError }
              : { data: { slug: "aria" }, error: null },
        );
      return chain;
    },
  }),
}));

import { copy } from "@/lib/copy";
import { updateInvitationAppearanceAction } from "@/server/actions/appearance";

const GAGAL = { message: "TypeError: fetch failed", code: "" };

beforeEach(() => {
  refs.updates = 0;
  refs.themeError = null;
  limits.mockReset();
  reportHandledError.mockClear();
});

describe("updateInvitationAppearanceAction — galat DB", () => {
  it("galat membaca paket → galat biasa, TANPA menulis dan TANPA melempar; dilaporkan", async () => {
    const boom = new Error("packages: koneksi DB terputus");
    limits.mockRejectedValue(boom);
    const res = await updateInvitationAppearanceAction(ID, {});
    expect(res).toEqual({ status: "error", message: copy.common.error });
    expect(refs.updates).toBe(0);
    // Benar-benar sampai ke pembacaan paket (bukan tertolak lebih awal).
    // Pemilik diteruskan agar draft admin/Pro memakai paket teratas (#115).
    expect(limits).toHaveBeenCalledWith(
      expect.anything(),
      "pkg-premium",
      "u-1",
    );
    expect(reportHandledError).toHaveBeenCalledWith(boom, "appearance.limits", {
      id: ID,
    });
  });

  it("galat membaca tema → galat biasa (BUKAN 'tema belum mendukung kustomisasi'); dilaporkan", async () => {
    refs.themeError = GAGAL;
    const res = await updateInvitationAppearanceAction(ID, {});
    expect(res).toEqual({ status: "error", message: copy.common.error });
    expect(res).not.toEqual(
      expect.objectContaining({ message: copy.appearance.unsupported }),
    );
    expect(refs.updates).toBe(0);
    expect(limits).not.toHaveBeenCalled();
    expect(reportHandledError).toHaveBeenCalledWith(GAGAL, "appearance.theme", {
      id: ID,
    });
  });
});

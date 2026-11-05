import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `getEffectiveLimits` — draft milik admin/Pro memakai paket teratas
 * (DECISIONS #115). Cermin TypeScript dari `invitation_effective_limits`
 * (pgTAP `draft_admin_pro_paket_teratas`).
 *
 * Yang dijaga: peran yang dibaca adalah peran PEMILIK yang diteruskan
 * pemanggil; tanpa `ownerId` perilakunya persis lama (lantai Basic tanpa
 * query); undangan berpaket tak pernah menanyakan peran; dan galat baca paket
 * teratas DILEMPAR (DECISIONS #45), bukan diam-diam jatuh ke Basic.
 */

const { isPaymentExempt } = vi.hoisted(() => ({
  isPaymentExempt: vi.fn((_c: unknown, _id: string) => Promise.resolve(false)),
}));
vi.mock("@/server/guards/auth", () => ({ isPaymentExempt }));

import { BASIC_LIMITS } from "@/lib/limits";
import { getEffectiveLimits } from "@/server/limits";

const PREMIUM = {
  max_photos: 20,
  max_guests: null,
  youtube: true,
  all_themes: true,
  watermark: false,
};

type Hasil = { data: unknown; error: unknown };

function client(hasil: Hasil) {
  const panggilan: Array<[string, unknown[]]> = [];
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit"]) {
    q[m] = (...a: unknown[]) => {
      panggilan.push([m, a]);
      return q;
    };
  }
  q.maybeSingle = () => Promise.resolve(hasil);
  const from = vi.fn((_t: string) => q);
  return { c: { from } as never, from, panggilan };
}

const OWNER = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  vi.clearAllMocks();
  isPaymentExempt.mockResolvedValue(false);
});

describe("getEffectiveLimits — cabang draft", () => {
  it("tanpa ownerId: lantai Basic tanpa query apa pun (perilaku lama)", async () => {
    const { c, from } = client({ data: null, error: null });
    expect(await getEffectiveLimits(c, null)).toEqual(BASIC_LIMITS);
    expect(from).not.toHaveBeenCalled();
    expect(isPaymentExempt).not.toHaveBeenCalled();
  });

  it("draft milik KLIEN: lantai Basic, paket tak dibaca", async () => {
    const { c, from } = client({ data: { limits: PREMIUM }, error: null });
    expect(await getEffectiveLimits(c, null, OWNER)).toEqual(BASIC_LIMITS);
    expect(isPaymentExempt).toHaveBeenCalledWith(c, OWNER);
    expect(from).not.toHaveBeenCalled();
  });

  it("draft milik ADMIN/PRO: paket undangan aktif termahal", async () => {
    isPaymentExempt.mockResolvedValue(true);
    const { c, from, panggilan } = client({
      data: { limits: PREMIUM },
      error: null,
    });
    const l = await getEffectiveLimits(c, null, OWNER);
    expect(l).toMatchObject({
      maxPhotos: 20,
      maxGuests: null,
      youtube: true,
      watermark: false,
    });
    expect(from).toHaveBeenCalledWith("packages");
    // Pilihan paket yang sama dengan aktivasi gratis (halaman aktifkan).
    expect(panggilan).toContainEqual(["eq", ["is_active", true]]);
    expect(panggilan).toContainEqual(["eq", ["kind", "invitation"]]);
    expect(panggilan).toContainEqual([
      "order",
      ["price_idr", { ascending: false }],
    ]);
    expect(panggilan).toContainEqual(["order", ["code", { ascending: false }]]);
  });

  it("galat baca paket teratas DILEMPAR, bukan jatuh ke Basic", async () => {
    isPaymentExempt.mockResolvedValue(true);
    const { c } = client({ data: null, error: { message: "putus" } });
    await expect(getEffectiveLimits(c, null, OWNER)).rejects.toThrow();
  });
});

describe("getEffectiveLimits — undangan berpaket", () => {
  it("paket berlaku apa adanya; peran pemilik tak pernah ditanyakan", async () => {
    const { c } = client({
      data: { limits: { ...PREMIUM, watermark: true, max_photos: 8 } },
      error: null,
    });
    const l = await getEffectiveLimits(c, "pkg-basic", OWNER);
    expect(l.maxPhotos).toBe(8);
    expect(l.watermark).toBe(true);
    expect(isPaymentExempt).not.toHaveBeenCalled();
  });
});

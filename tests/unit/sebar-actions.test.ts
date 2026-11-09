import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Aksi server Sebar (DECISIONS #120): simpan template personal & umum, dan
 * batalkan tanda "terkirim". Pola wajib proyek: auth → validasi → operasi
 * (kepemilikan oleh RLS) → revalidate. Yang dijaga di sini:
 * - template wajib memuat {link} dan ≤ 2.000 karakter (sejalan CHECK kolom);
 * - teks yang sama dengan bawaan disimpan NULL (perbaikan bawaan ikut sampai);
 * - 0 baris terdampak (bukan pemilik / RLS) ≠ sukses;
 * - membatalkan tanda hanya mengosongkan `wa_clicked_at`.
 */

const { refs, revalidatePath } = vi.hoisted(() => ({
  refs: {
    user: { id: "u-1" } as { id: string } | null,
    updates: [] as Array<{
      table: string;
      payload: unknown;
      filters: Record<string, unknown>;
    }>,
    returned: [{ id: "x" }] as unknown[] | null,
    error: null as unknown,
  },
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: refs.user } }) },
    from: (table: string) => ({
      update: (payload: unknown) => {
        const rec = { table, payload, filters: {} as Record<string, unknown> };
        refs.updates.push(rec);
        const chain: Record<string, unknown> = {};
        chain.eq = (k: string, v: unknown) => {
          rec.filters[k] = v;
          return chain;
        };
        chain.is = (k: string, v: unknown) => {
          rec.filters[`is:${k}`] = v;
          return chain;
        };
        chain.select = () =>
          Promise.resolve({ data: refs.returned, error: refs.error });
        chain.then = (ok: (v: unknown) => unknown) =>
          Promise.resolve({ error: refs.error }).then(ok);
        return chain;
      },
    }),
  }),
}));

import { copy } from "@/lib/copy";
import {
  markWaClickedAction,
  unmarkWaClickedAction,
} from "@/server/actions/guests";
import { saveShareTemplatesAction } from "@/server/actions/sebar";

const INV = "11111111-1111-4111-8111-111111111111";
const GUEST = "22222222-2222-4222-8222-222222222222";
const t = copy.dashboard.sebar;

beforeEach(() => {
  refs.user = { id: "u-1" };
  refs.updates = [];
  refs.returned = [{ id: INV }];
  refs.error = null;
  revalidatePath.mockClear();
});

describe("saveShareTemplatesAction", () => {
  it("menyimpan template yang disunting ke kolom undangan milik pemilik", async () => {
    const res = await saveShareTemplatesAction(INV, {
      personal: "Halo {nama} {link}",
      general: "Halo semua {link}",
    });
    expect(res).toEqual({ status: "success" });
    expect(refs.updates).toEqual([
      {
        table: "invitations",
        payload: {
          share_template: "Halo {nama} {link}",
          share_template_general: "Halo semua {link}",
        },
        // Undangan ter-purge (retensi UU PDP) tak menerima data pribadi baru.
        filters: { id: INV, "is:purged_at": null },
      },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith(
      `/dashboard/undangan/${INV}/sebar`,
    );
  });

  it("halaman undangan ikut di-revalidate: simpanan menaikkan updated_at = ?v og:image yang dipanaskan Sebar (DECISIONS #122)", async () => {
    refs.returned = [{ id: INV, slug: "rani-wanda" }];
    const res = await saveShareTemplatesAction(INV, {
      personal: "Halo {nama} {link}",
      general: null,
    });
    expect(res).toEqual({ status: "success" });
    expect(revalidatePath).toHaveBeenCalledWith("/rani-wanda");
  });

  it("teks SAMA dengan bawaan → NULL (perbaikan teks bawaan tetap sampai)", async () => {
    await saveShareTemplatesAction(INV, {
      personal: t.defaultTemplate,
      general: `${t.defaultTemplateGeneral}\n`,
    });
    expect(refs.updates[0].payload).toEqual({
      share_template: null,
      share_template_general: null,
    });
  });

  it("template tanpa {link} DITOLAK di server, tanpa menulis apa pun", async () => {
    const res = await saveShareTemplatesAction(INV, {
      personal: "Halo {nama}",
      general: null,
    });
    expect(res).toEqual({ status: "error", message: t.templateNeedsLink });
    expect(refs.updates).toHaveLength(0);
  });

  it("lebih dari 2.000 karakter → ditolak (sejalan CHECK kolom)", async () => {
    const res = await saveShareTemplatesAction(INV, {
      personal: `{link}${"x".repeat(2000)}`,
      general: null,
    });
    expect(res).toEqual({ status: "error", message: t.templateTooLong });
    expect(refs.updates).toHaveLength(0);
  });

  it("0 baris terdampak (bukan pemilik / RLS) → galat, BUKAN sukses", async () => {
    refs.returned = [];
    const res = await saveShareTemplatesAction(INV, {
      personal: null,
      general: null,
    });
    expect(res).toEqual({ status: "error", message: copy.common.error });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("tanpa sesi / id bukan UUID → galat tanpa menyentuh DB", async () => {
    refs.user = null;
    expect(
      (await saveShareTemplatesAction(INV, { personal: null, general: null }))
        .status,
    ).toBe("error");
    refs.user = { id: "u-1" };
    expect(
      (
        await saveShareTemplatesAction("bukan-uuid", {
          personal: null,
          general: null,
        })
      ).status,
    ).toBe("error");
    expect(refs.updates).toHaveLength(0);
  });
});

describe("tanda terkirim", () => {
  it("menandai hanya bila belum bertanda (idempoten)", async () => {
    expect(await markWaClickedAction(INV, GUEST)).toEqual({
      status: "success",
    });
    const u = refs.updates[0];
    expect(u.table).toBe("guests");
    expect(u.filters).toEqual({
      id: GUEST,
      invitation_id: INV,
      "is:wa_clicked_at": null,
    });
  });

  it("membatalkan = mengosongkan wa_clicked_at saja (first_viewed_at tak disentuh)", async () => {
    expect(await unmarkWaClickedAction(INV, GUEST)).toEqual({
      status: "success",
    });
    expect(refs.updates).toEqual([
      {
        table: "guests",
        payload: { wa_clicked_at: null },
        filters: { id: GUEST, invitation_id: INV },
      },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith(
      `/dashboard/undangan/${INV}/sebar`,
    );
    expect(revalidatePath).toHaveBeenCalledWith(
      `/dashboard/undangan/${INV}/tamu`,
    );
  });

  it("membatalkan tanpa sesi / id tak sah → galat tanpa update", async () => {
    refs.user = null;
    expect((await unmarkWaClickedAction(INV, GUEST)).status).toBe("error");
    refs.user = { id: "u-1" };
    expect((await unmarkWaClickedAction(INV, "x")).status).toBe("error");
    expect(refs.updates).toHaveLength(0);
  });

  it("galat DB saat membatalkan → galat (UI mengembalikan tandanya)", async () => {
    refs.error = { message: "boom" };
    expect(await unmarkWaClickedAction(INV, GUEST)).toEqual({
      status: "error",
      message: copy.common.error,
    });
  });
});

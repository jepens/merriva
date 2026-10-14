import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kesiapan identitas pelaku usaha. Fungsinya satu baris, tetapi ia yang
 * memutuskan apakah tombol bayar hidup di produksi — jadi "cukup salah satu
 * terisi" harus tetap dibaca BELUM SIAP.
 *
 * `name` tanpa `address` adalah kelalaian yang paling mungkin terjadi: nama
 * usaha paling mudah diingat, alamat paling mudah ditunda.
 */

const { merchant } = vi.hoisted(() => ({
  merchant: {
    form: "Usaha perseorangan",
    name: "",
    owner: "",
    address: "",
    taxId: "",
  },
}));
vi.mock("@/lib/copy", () => ({
  copy: { marketing: { legal: { merchant } } },
}));

import { merchantIdentityReady } from "@/lib/merchant";

function isi(over: Partial<typeof merchant>) {
  Object.assign(
    merchant,
    { name: "", owner: "", address: "", taxId: "" },
    over,
  );
}

beforeEach(() => isi({}));

describe("siap", () => {
  it("nama + alamat terisi", () => {
    isi({ name: "Merriva", address: "Jl. Merdeka 1, Bandung, Jawa Barat" });
    expect(merchantIdentityReady()).toBe(true);
  });

  it("NPWP & penanggung jawab tidak wajib", () => {
    isi({ name: "Merriva", address: "Bandung, Jawa Barat" });
    expect(merchantIdentityReady()).toBe(true);
  });
});

describe("belum siap", () => {
  it.each([
    ["keduanya kosong", {}],
    ["hanya nama", { name: "Merriva" }],
    ["hanya alamat", { address: "Bandung" }],
    ["nama hanya spasi", { name: "   ", address: "Bandung" }],
    ["alamat hanya spasi", { name: "Merriva", address: "  " }],
  ])("%s", (_n, over) => {
    isi(over);
    expect(merchantIdentityReady()).toBe(false);
  });
});

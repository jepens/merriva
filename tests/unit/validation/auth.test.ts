import { describe, expect, it } from "vitest";

import {
  loginSchema,
  profileSchema,
  registerSchema,
  resetRequestSchema,
  updatePasswordSchema,
} from "@/lib/validation/auth";

describe("registerSchema", () => {
  const base = {
    full_name: "Rina Kartika",
    email: "rina@example.com",
    password: "rahasia123",
  };

  it("menerima input valid tanpa phone", () => {
    const r = registerSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("menerima phone valid dan mengizinkan phone kosong", () => {
    expect(
      registerSchema.safeParse({ ...base, phone: "081234567890" }).success,
    ).toBe(true);
    expect(registerSchema.safeParse({ ...base, phone: "" }).success).toBe(true);
  });

  it("menolak email tidak valid & password pendek", () => {
    const bad = registerSchema.safeParse({
      ...base,
      email: "bukan-email",
      password: "123",
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      const fe = bad.error.flatten().fieldErrors;
      expect(fe.email).toBeDefined();
      expect(fe.password).toBeDefined();
    }
  });

  it("menolak nama terlalu pendek & phone tidak valid", () => {
    const bad = registerSchema.safeParse({
      ...base,
      full_name: "R",
      phone: "abc",
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      const fe = bad.error.flatten().fieldErrors;
      expect(fe.full_name).toBeDefined();
      expect(fe.phone).toBeDefined();
    }
  });
});

describe("loginSchema", () => {
  it("butuh email valid & password non-kosong", () => {
    expect(
      loginSchema.safeParse({ email: "a@b.com", password: "x" }).success,
    ).toBe(true);
    expect(
      loginSchema.safeParse({ email: "a@b.com", password: "" }).success,
    ).toBe(false);
  });
});

describe("resetRequestSchema", () => {
  it("hanya menerima email valid", () => {
    expect(resetRequestSchema.safeParse({ email: "a@b.com" }).success).toBe(
      true,
    );
    expect(resetRequestSchema.safeParse({ email: "x" }).success).toBe(false);
  });
});

describe("updatePasswordSchema", () => {
  it("menolak bila konfirmasi tidak cocok, dengan error pada field confirm", () => {
    const r = updatePasswordSchema.safeParse({
      password: "rahasia123",
      confirm: "rahasia124",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.confirm).toBeDefined();
    }
  });

  it("menerima bila cocok", () => {
    expect(
      updatePasswordSchema.safeParse({
        password: "rahasia123",
        confirm: "rahasia123",
      }).success,
    ).toBe(true);
  });
});

describe("profileSchema", () => {
  it("menerima nama valid + phone opsional", () => {
    expect(profileSchema.safeParse({ full_name: "Budi" }).success).toBe(true);
    expect(
      profileSchema.safeParse({ full_name: "Budi", phone: "081234567890" })
        .success,
    ).toBe(true);
  });
});

describe("kata sandi yang terlalu mudah ditebak (B5)", () => {
  const dasar = {
    full_name: "Andi Pratama",
    email: "andi@contoh.test",
    phone: "",
  };

  it("menolak kata sandi yang memuat nama merek", () => {
    // HIBP tak akan menangkap ini: `merriva2026` boleh jadi tak pernah bocor ke
    // mana pun, tetapi ia tetap tebakan pertama penyerang akun di domain ini.
    for (const p of ["merriva2026", "MerrivaKu!", "undangan123"]) {
      const r = registerSchema.safeParse({ ...dasar, password: p });
      expect(r.success, p).toBe(false);
    }
  });

  it("menolak kata sandi yang memuat bagian lokal alamat email", () => {
    const r = registerSchema.safeParse({
      ...dasar,
      email: "budisantoso@contoh.test",
      password: "budisantoso99",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["password"]);
  });

  it("bagian lokal yang sangat pendek TIDAK memblokir apa pun", () => {
    // `a@contoh.test` → nyaris semua kata sandi memuat huruf "a". Aturan yang
    // memblokirnya akan menolak kata sandi yang sebenarnya kuat.
    const r = registerSchema.safeParse({
      ...dasar,
      email: "a@contoh.test",
      password: "Jangkrik-Pagi-7712",
    });
    expect(r.success).toBe(true);
  });

  it("kata sandi kuat yang kebetulan panjang tetap diterima", () => {
    const r = registerSchema.safeParse({
      ...dasar,
      password: "Kopi-Tubruk-Pagi-88",
    });
    expect(r.success).toBe(true);
  });
});

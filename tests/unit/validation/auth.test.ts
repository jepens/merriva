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

import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/lib/safe-redirect";

describe("safeNextPath", () => {
  it("mempertahankan path relatif internal", () => {
    expect(safeNextPath("/dashboard/profil")).toBe("/dashboard/profil");
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
  });

  it("menolak open redirect (absolute / protocol-relative / backslash)", () => {
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard");
    expect(safeNextPath("javascript:alert(1)")).toBe("/dashboard");
  });

  it("menolak bypass via karakter kontrol / backslash (temuan review M1.1)", () => {
    // Parser URL membuang TAB/LF/CR & menormalkan `\` → protocol-relative.
    expect(safeNextPath("/\t/evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\n/evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\r/evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\t\\evil.example")).toBe("/dashboard");
    expect(safeNextPath("/foo\\bar")).toBe("/dashboard");
  });

  it("tetap menerima path relatif dengan tanda hubung/segmen", () => {
    expect(safeNextPath("/reset-password/ubah")).toBe("/reset-password/ubah");
    expect(safeNextPath("/dashboard/undangan/baru")).toBe(
      "/dashboard/undangan/baru",
    );
  });

  it("memakai fallback untuk nilai kosong / non-path", () => {
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath(undefined)).toBe("/dashboard");
    expect(safeNextPath("dashboard")).toBe("/dashboard");
    expect(safeNextPath("", "/x")).toBe("/x");
  });
});

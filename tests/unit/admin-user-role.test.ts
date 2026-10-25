import { describe, expect, it } from "vitest";

import { adminUserRoleSchema } from "@/lib/validation/admin";
import { Constants } from "@/types/database";

/**
 * Dropdown peran di /admin/pengguna adalah SATU-SATUNYA jalan memberi status
 * Pro (DECISIONS #100). Skema yang tertinggal dari enum DB tak memunculkan
 * galat apa pun — admin hanya melihat "peran tidak valid" dan Pro tak pernah
 * bisa diberikan. Karena itu skemanya diuji terhadap enum hasil generate.
 */
describe("adminUserRoleSchema", () => {
  it("menerima SETIAP peran di enum `profile_role`, termasuk Pro", () => {
    expect(Constants.public.Enums.profile_role).toContain("pro");
    for (const role of Constants.public.Enums.profile_role) {
      expect(adminUserRoleSchema.safeParse({ role }).success).toBe(true);
    }
  });

  it("menolak peran karangan", () => {
    expect(adminUserRoleSchema.safeParse({ role: "superadmin" }).success).toBe(
      false,
    );
  });
});

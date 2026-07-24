import { expect, test } from "@playwright/test";

// Smoke test dasar — jalur E2E wajib (SPEC §10) diisi mulai M1.
test("halaman utama menampilkan brand Merriva", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Merriva" })).toBeVisible();
});

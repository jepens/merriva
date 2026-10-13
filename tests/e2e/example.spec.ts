import { expect, test } from "@playwright/test";

import { copy } from "../../src/lib/copy";

// Smoke test dasar — jalur E2E wajib (SPEC §10) diisi mulai M1.

test("halaman utama memuat judul hero", async ({ page }) => {
  await page.goto("/");
  // Judulnya dirangkai dari dua potong copy (`titleLead` + `titleAccent`) agar
  // kata aksennya bisa diwarnai, jadi yang dicocokkan adalah gabungannya.
  const { titleLead, titleAccent } = copy.marketing.hero;
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: `${titleLead} ${titleAccent}`,
    }),
  ).toBeVisible();
});

test("logo brand punya nama aksesibel", async ({ page }) => {
  await page.goto("/");
  // Sejak logo menjadi SVG inline (DECISIONS #75), nama "Merriva" TIDAK lagi
  // berupa teks DOM: ia hanya hidup di `aria-label` tautan brand. Test lama
  // mencari heading "Merriva" dan tak pernah ketahuan gagal karena E2E belum
  // dijalankan di CI. Yang dijaga sekarang adalah hal yang benar-benar bisa
  // hilang: pengguna pembaca layar kehilangan satu-satunya cara mengenali
  // tautan itu bila `aria-label`-nya terhapus.
  await expect(
    page.getByRole("link", { name: copy.brand.name }).first(),
  ).toBeVisible();
});

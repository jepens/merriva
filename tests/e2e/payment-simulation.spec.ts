import { expect, test } from "@playwright/test";

import { PakasirGateway } from "../../src/lib/payment/pakasir";

/**
 * E2E pembayaran (SPEC §4.8 / M3.6): checkout → **paymentsimulation** (sandbox
 * Pakasir, bukan uang asli) → halaman cek-status mem-poll `transactiondetail` →
 * undangan AKTIF. Jalur poll memakai `transactiondetail` OUTBOUND dari server
 * kita, jadi test ini TAK butuh URL webhook publik — cukup kredensial sandbox.
 *
 * GATED: hanya jalan bila env sandbox + akun uji + undangan uji tersedia; jika
 * tidak → di-skip (dev/CI tanpa kredensial). Runbook: `docs/PAYMENT-E2E.md`.
 *
 * Prasyarat env (set di `.env.local` untuk `pnpm dev` yang dipakai Playwright,
 * dan di environment test untuk `simulatePayment`):
 *   PAKASIR_PROJECT_SLUG, PAKASIR_API_KEY  → project SANDBOX Pakasir
 *   E2E_EMAIL, E2E_PASSWORD                → akun terverifikasi di DB target
 *   E2E_INVITATION_ID                      → undangan milik akun itu, status
 *     `draft`/`expired`, dengan **slug asli** (BUKAN `draft-…`) dan **minimal satu
 *     sesi jadwal bertanggal-jam mulai lengkap** (syarat bayar, DECISIONS #44).
 *     Reset ke draft sebelum menjalankan ulang (aktivasi membuatnya `active` =
 *     tak bisa dibayar lagi).
 */

const SANDBOX =
  process.env.PAKASIR_PROJECT_SLUG &&
  process.env.PAKASIR_API_KEY &&
  process.env.E2E_EMAIL &&
  process.env.E2E_PASSWORD &&
  process.env.E2E_INVITATION_ID;

test.describe("Pembayaran end-to-end (paymentsimulation)", () => {
  test.skip(
    !SANDBOX,
    "Butuh kredensial sandbox Pakasir + akun uji + E2E_INVITATION_ID (undangan draft dgn slug asli + sesi berjam).",
  );

  test("checkout Basic → simulasi bayar → undangan aktif + kuitansi", async ({
    page,
  }) => {
    // Poll `transactiondetail` bisa perlu beberapa siklus → longgarkan timeout.
    test.setTimeout(120_000);
    const invitationId = process.env.E2E_INVITATION_ID!;

    // 1) Login (origin `localhost`, bukan 127.0.0.1 — Next 16 dev memblokir
    //    server action lintas-origin dari 127.0.0.1).
    await page.goto("/masuk");
    await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
    await page.getByLabel(/kata sandi/i).fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL("**/dashboard");

    // 2) Aktifkan → pilih paket Basic (kartu termurah/pertama). Undangan uji WAJIB
    //    sudah punya slug asli dan sesi berjam (syarat checkout, DECISIONS #44).
    await page.goto(`/dashboard/undangan/${invitationId}/aktifkan`);
    // Gagal-cepat dengan sebab yang jelas: bila undangan uji belum memenuhi
    // syarat bayar, halaman menampilkan daftar syarat, bukan pemilih paket
    // (DECISIONS #44) — tanpa ini klik di bawah menunggu sampai timeout.
    await expect(
      page.getByRole("button", { name: "Pilih paket ini" }).first(),
      "Undangan uji belum siap dibayar: wajib slug asli + minimal 1 sesi jadwal berjam (lihat docs/PAYMENT-E2E.md)",
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Pilih paket ini" }).first().click();

    // 3) Redirect ke halaman bayar Pakasir → ambil order_id + amount dari URL.
    await page.waitForURL(/app\.pakasir\.com\/pay\//, { timeout: 30_000 });
    const payUrl = new URL(page.url());
    const orderId = payUrl.searchParams.get("order_id");
    const amount = Number(payUrl.pathname.split("/").pop());
    expect(orderId).toBeTruthy();
    expect(amount).toBeGreaterThan(0);

    // 4) Simulasikan pembayaran (sandbox) → Pakasir menandai lunas.
    const gateway = new PakasirGateway(
      process.env.PAKASIR_PROJECT_SLUG!,
      process.env.PAKASIR_API_KEY!,
    );
    await gateway.simulatePayment(orderId!, amount);

    // 5) Halaman cek-status → poll `transactiondetail` mengaktifkan → sukses.
    await page.goto(`/dashboard/undangan/${invitationId}/bayar`);
    await expect(page.getByText("Pembayaran berhasil!")).toBeVisible({
      timeout: 60_000,
    });

    // 6) Tautan "Lihat undangan" mengarah ke slug ASLI (bukan `draft-…` → tak 404).
    const view = page.getByRole("link", { name: "Lihat undangan" });
    await expect(view).toBeVisible();
    const href = await view.getAttribute("href");
    expect(href).toBeTruthy();
    expect(href!.startsWith("/draft-")).toBe(false);
  });
});

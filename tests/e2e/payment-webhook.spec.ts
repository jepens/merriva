import { expect, test } from "@playwright/test";

import { PakasirGateway } from "../../src/lib/payment/pakasir";

/**
 * E2E pembayaran via JALUR WEBHOOK (SPEC §4.8 / M3.2) — pelengkap
 * `payment-simulation.spec.ts` (yang menempuh jalur POLL `transactiondetail`).
 * Di sini kita men-POST payload webhook Pakasir ke endpoint publik kita
 * `/api/webhooks/pakasir` dan memverifikasi verifikasi-berlapis + aktivasi
 * ATOMIK + IDEMPOTENSI benar-benar dieksekusi (payload = sinyal; bukti lunas
 * tetap dari `transactiondetail` di dalam handler).
 *
 * GATED: butuh env sandbox + akun uji + undangan uji TERPISAH (agar tak bentrok
 * dengan test poll yang mengaktifkan `E2E_INVITATION_ID`). Runbook:
 * `docs/PAYMENT-E2E.md`.
 *
 * Prasyarat env (sama seperti test poll, plus satu undangan lagi):
 *   PAKASIR_PROJECT_SLUG, PAKASIR_API_KEY   → project SANDBOX Pakasir
 *   E2E_EMAIL, E2E_PASSWORD                 → akun terverifikasi di DB target
 *   E2E_INVITATION_ID_WEBHOOK               → undangan milik akun itu, status
 *     `draft`/`expired`, dengan **slug asli**. Reset ke draft sebelum run ulang.
 */

const SANDBOX =
  process.env.PAKASIR_PROJECT_SLUG &&
  process.env.PAKASIR_API_KEY &&
  process.env.E2E_EMAIL &&
  process.env.E2E_PASSWORD &&
  process.env.E2E_INVITATION_ID_WEBHOOK;

test.describe("Pembayaran end-to-end (jalur webhook)", () => {
  test.skip(
    !SANDBOX,
    "Butuh kredensial sandbox Pakasir + akun uji + E2E_INVITATION_ID_WEBHOOK (undangan draft terpisah, slug asli).",
  );

  test("checkout → simulasi bayar → POST webhook mengaktifkan + idempoten", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const invitationId = process.env.E2E_INVITATION_ID_WEBHOOK!;
    const project = process.env.PAKASIR_PROJECT_SLUG!;

    // 1) Login (origin localhost — Next 16 dev memblokir server action dari 127.0.0.1).
    await page.goto("/masuk");
    await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
    await page.getByLabel(/kata sandi/i).fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL("**/dashboard");

    // 2) Aktifkan → pilih paket Basic (kartu pertama).
    await page.goto(`/dashboard/undangan/${invitationId}/aktifkan`);
    await page.getByRole("button", { name: "Pilih paket ini" }).first().click();

    // 3) Redirect ke halaman bayar Pakasir → ambil order_id + amount.
    await page.waitForURL(/app\.pakasir\.com\/pay\//, { timeout: 30_000 });
    const payUrl = new URL(page.url());
    const orderId = payUrl.searchParams.get("order_id");
    const amount = Number(payUrl.pathname.split("/").pop());
    expect(orderId).toBeTruthy();
    expect(amount).toBeGreaterThan(0);

    // 4) Simulasikan pembayaran (sandbox) → Pakasir menandai lunas.
    const gateway = new PakasirGateway(project, process.env.PAKASIR_API_KEY!);
    await gateway.simulatePayment(orderId!, amount);

    // 5) POST webhook ke endpoint kita. Payload = SINYAL; handler memverifikasi
    //    ulang lewat `transactiondetail`. `transactiondetail` bisa telat merefleksi
    //    lunas → retry (meniru perilaku retry Pakasir) sampai activated:true.
    const payload = {
      amount,
      order_id: orderId,
      project,
      status: "completed",
    };
    const post = () =>
      request.post("/api/webhooks/pakasir", {
        data: payload,
        headers: { "Content-Type": "application/json" },
      });

    let activated = false;
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const res = await post();
      expect(res.status()).toBe(200); // 5xx = transien; di sini harus sukses
      const body = await res.json();
      if (body.activated === true) {
        activated = true;
        break;
      }
      await page.waitForTimeout(3_000);
    }
    expect(activated, "webhook mengaktifkan undangan").toBe(true);

    // 6) Idempotensi: POST ulang payload sama → 200 tetapi TIDAK mengaktifkan lagi.
    const again = await post();
    expect(again.status()).toBe(200);
    expect((await again.json()).activated).toBe(false);
  });
});

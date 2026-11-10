import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { PakasirGateway } from "../../src/lib/payment/pakasir";

/**
 * E2E pembayaran via JALUR WEBHOOK (SPEC §4.8 / M3.2) — pelengkap
 * `payment-simulation.spec.ts` (yang menempuh jalur POLL `transaction-status`).
 * Di sini kita men-POST payload webhook Pakasir ke endpoint publik kita
 * `/api/webhooks/pakasir` dan memverifikasi verifikasi-berlapis + aktivasi
 * ATOMIK + IDEMPOTENSI benar-benar dieksekusi (payload = sinyal; bukti lunas
 * tetap dari `transaction-status` di dalam handler).
 *
 * GATED: butuh env sandbox + akun uji + undangan uji TERPISAH (agar tak bentrok
 * dengan test poll yang mengaktifkan `E2E_INVITATION_ID`). Runbook:
 * `docs/PAYMENT-E2E.md`.
 *
 * Prasyarat env (sama seperti test poll, plus satu undangan lagi):
 *   PAKASIR_PROJECT_SLUG, PAKASIR_API_KEY   → project SANDBOX Pakasir
 *   E2E_EMAIL, E2E_PASSWORD                 → akun terverifikasi di DB target,
 *     ber-peran `client` (admin/Pro tak pernah ditagih — DECISIONS #100)
 *   E2E_INVITATION_ID_WEBHOOK               → undangan milik akun itu, status
 *     `draft`/`expired`, dengan **slug asli** dan **minimal satu sesi jadwal
 *     bertanggal-jam mulai lengkap** (syarat bayar, DECISIONS #44). Reset ke
 *     draft sebelum run ulang.
 */

// Skip yang SENYAP tak bisa dibedakan dari lulus — dan selama ini itulah
// yang terjadi: runner tak pernah memuat `.env.local`, seluruh spec
// dilewati, `pnpm test:e2e` keluar 0. Sekarang runner memuatnya
// (playwright.config.ts) DAN ketiadaannya bersuara.
const WAJIB = [
  "PAKASIR_PROJECT_SLUG",
  "PAKASIR_API_KEY",
  "E2E_EMAIL",
  "E2E_PASSWORD",
  "E2E_INVITATION_ID_WEBHOOK",
] as const;
const KOSONG = WAJIB.filter((k) => !process.env[k]);
const SANDBOX = KOSONG.length === 0;
if (!SANDBOX) {
  console.warn(
    [
      "",
      `[e2e] DILEWATI — variabel kosong: ${KOSONG.join(", ")}`,
      "      Isi di .env.local (lihat docs/PAYMENT-E2E.md).",
      "      PASTIKAN PAKASIR_PROJECT_SLUG adalah project SANDBOX, bukan produksi.",
      "",
    ].join("\n"),
  );
}

/**
 * Order `pending` TERBARU milik satu undangan, dibaca dari DB.
 *
 * URL `pay-v2` tak lagi memuat `order_id` maupun nominal (API v2), jadi kedua
 * nilai itu diambil dari sumber otoritatifnya. `txn_id` ikut dikembalikan supaya
 * spec bisa membuktikan bahwa penerbitan link benar-benar MENYIMPANNYA — tanpa
 * itu tersimpan, pembayaran tak bisa diverifikasi sama sekali.
 */
async function orderTerbaru(invitationId: string): Promise<{
  orderId: string;
  amount: number;
  txnId: string | null;
}> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data } = await admin
    .from("orders")
    .select("order_code, amount_idr, txn_id")
    .eq("invitation_id", invitationId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("order pending tak ditemukan untuk undangan uji");
  return {
    orderId: data.order_code,
    amount: data.amount_idr,
    txnId: data.txn_id,
  };
}

test.describe("Pembayaran end-to-end (jalur webhook)", () => {
  test.skip(
    !SANDBOX,
    "Butuh kredensial sandbox Pakasir + akun uji + E2E_INVITATION_ID_WEBHOOK (undangan draft terpisah, slug asli + sesi berjam).",
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
    // Gagal-cepat dengan sebab yang jelas: bila undangan uji belum memenuhi
    // syarat bayar, halaman menampilkan daftar syarat, bukan pemilih paket
    // (DECISIONS #44) — tanpa ini klik di bawah menunggu sampai timeout.
    await expect(
      page.getByRole("button", { name: "Pilih paket ini" }).first(),
      "Undangan uji belum siap dibayar: wajib slug asli + minimal 1 sesi jadwal berjam (lihat docs/PAYMENT-E2E.md)",
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Pilih paket ini" }).first().click();

    // 3) Redirect ke halaman bayar Pakasir.
    //
    //    URL v2 adalah `/pay-v2/{txn_id}`: TIDAK ada `order_id` di query, dan
    //    segmen terakhir path adalah txn_id — bukan nominal seperti pada v1.
    //    Keduanya diambil dari DB, sumber otoritatifnya.
    await page.waitForURL(/app\.pakasir\.com\/pay-v2\//, { timeout: 30_000 });
    const { orderId, amount, txnId } = await orderTerbaru(invitationId);
    expect(orderId).toBeTruthy();
    expect(amount).toBeGreaterThan(0);
    // Bukti bahwa penerbitan link MENYIMPAN rujukan transaksi: tanpa `txn_id`
    // tersimpan, pembayaran atasnya tak bisa diverifikasi sama sekali.
    expect(txnId).toBeTruthy();

    // 4) Simulasikan pembayaran (sandbox) → Pakasir menandai lunas.
    const gateway = new PakasirGateway(project, process.env.PAKASIR_API_KEY!);
    await gateway.simulatePayment(orderId!, amount);

    // 5) POST webhook ke endpoint kita. Payload = SINYAL; handler memverifikasi
    //    ulang lewat `transaction-status`. `transaction-status` bisa telat merefleksi
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

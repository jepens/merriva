import { existsSync, readFileSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

/**
 * Muat `.env.local` ke proses TEST RUNNER.
 *
 * Next memuat `.env.local` hanya ke proses DEV SERVER. Gerbang `SANDBOX` di
 * kedua spec dievaluasi di proses runner — yang sebelumnya tak pernah melihat
 * satu variabel pun. Hasilnya `test.skip()` menyala, spec dilewati, dan
 * `pnpm test:e2e` keluar dengan kode 0: "hijau" yang tak menguji apa pun.
 * Itulah sebab sebenarnya gerbang E2E tak pernah berbunyi — bukan "butuh
 * staging".
 *
 * Parser sengaja seadanya (tanpa dependensi `dotenv` baru): hanya `KUNCI=nilai`,
 * melewati komentar, dan TIDAK menimpa variabel yang sudah ada di shell.
 */
for (const berkas of [".env.local"]) {
  if (!existsSync(berkas)) continue;
  for (const baris of readFileSync(berkas, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(baris);
    if (!m || baris.trimStart().startsWith("#")) continue;
    if (process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

/**
 * Konfigurasi Playwright. Jalur E2E wajib (SPEC §10) diisi mulai M1.
 * Sebelum menjalankan pertama kali: `pnpm exec playwright install`.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

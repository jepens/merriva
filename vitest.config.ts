import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` menandai modul agar gagal bila ter-bundle ke klien; di
      // test tak ada bundle klien → stub kosong agar modul server bisa diuji.
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // DIPATOK, bukan diwarisi. Vitest 5 membalik default ini dari `false` ke
    // `true`, dan 103 dari 155 berkas test di repo ini tak pernah membersihkan
    // mock-nya sendiri — artinya semantik isolasi antar-test berubah untuk
    // seluruh suite tanpa satu baris pun ikut berubah warna. Nilainya `true`
    // karena itu yang lebih benar: `expect(x).not.toHaveBeenCalled()` harus
    // berarti "tak dipanggil DI TEST INI", bukan menumpang pada kebocoran
    // state dari test sebelumnya. Yang dipatok di sini adalah KEPASTIANNYA —
    // supaya pembalikan default berikutnya tak lagi menggeser arti test
    // diam-diam.
    clearMocks: true,
    include: [
      "tests/unit/**/*.{test,spec}.{ts,tsx}",
      "src/**/*.{test,spec}.{ts,tsx}",
    ],
    // E2E (Playwright) punya runner sendiri — jangan dijalankan Vitest.
    exclude: ["node_modules/**", ".next/**", "tests/e2e/**"],
  },
});

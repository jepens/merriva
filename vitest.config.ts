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
    include: [
      "tests/unit/**/*.{test,spec}.{ts,tsx}",
      "src/**/*.{test,spec}.{ts,tsx}",
    ],
    // E2E (Playwright) punya runner sendiri — jangan dijalankan Vitest.
    exclude: ["node_modules/**", ".next/**", "tests/e2e/**"],
  },
});

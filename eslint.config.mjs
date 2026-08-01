import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Matikan aturan yang berkonflik dengan Prettier (Prettier yang menangani format).
  prettier,
  {
    rules: {
      // Izinkan argumen/var yang sengaja tidak dipakai bila diawali `_`.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
    // Tooling Node (bukan kode app Next) & manifest foto demo auto-generate.
    "scripts/**",
    "src/themes/_shared/demo-photos.generated.ts",
  ]),
]);

export default eslintConfig;

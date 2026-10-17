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
  // `scripts/**` DULU diabaikan seluruhnya sebagai "tooling Node, bukan kode
  // app Next". Ongkos diam itu terbayar 17 Okt 2026: `return basisMedia;` yang
  // tersisip di tengah `periksaSitus()` membuat pemeriksaan identitas pelaku
  // usaha di `ops-verify.mjs` TIDAK PERNAH JALAN selama dua hari, dan
  // ketiadaannya tak terlihat karena baris yang absen di laporan tampak seperti
  // ketiadaan, bukan seperti kegagalan. `no-unreachable` akan menangkapnya
  // seketika — seandainya ia dijalankan.
  //
  // Jadi skrip kini ikut di-lint, dengan dua aturan yang memang tak cocok
  // untuknya dimatikan secara eksplisit alih-alih mengabaikan seluruh folder.
  {
    files: ["scripts/**/*.{mjs,js}"],
    rules: {
      // Dijalankan `node` langsung tanpa langkah build; tsconfig app tak
      // mencakupnya, jadi `@ts-nocheck` di sana disengaja.
      "@typescript-eslint/ban-ts-comment": "off",
      // k6 MENUNTUT `export default function () {}` — namanya tak terpakai.
      "import/no-anonymous-default-export": "off",
      // Berkas `.mjs` tak tersentuh tsc sama sekali (di luar `include`
      // tsconfig, dan ber-@ts-nocheck), jadi `allowUnreachableCode: false`
      // tidak menjangkaunya. Konfigurasi ini juga tak memuat
      // `eslint:recommended`, sehingga aturan-aturan "kode ini tak mungkin
      // benar" harus diminta satu per satu.
      "no-unreachable": "error",
      "no-dupe-keys": "error",
      "no-dupe-args": "error",
      "no-unsafe-negation": "error",
      "no-self-assign": "error",
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
    // Manifest foto demo auto-generate.
    "src/themes/_shared/demo-photos.generated.ts",
  ]),
]);

export default eslintConfig;

# handoff/brand — logo raster Merriva

Dirender dari **`src/app/(marketing)/icon.svg`**, yang tetap menjadi sumber
kebenaran. Berkas di sini hanya turunan untuk tempat-tempat yang **tidak
menerima SVG**.

| Berkas | Dipakai di |
|---|---|
| `merriva-logo-120.png` | **Google OAuth consent screen** (minimal 120×120, PNG/JPG, harus kotak) |
| `merriva-logo-512.png` | cadangan untuk Search Console, profil pihak ketiga, dsb. |

Warnanya mengikuti mark yang sudah ada: kertas `#fbf9f6`, tinta `#241f2b`,
aksen emas `#9a6a22` — sama dengan `(marketing)/opengraph-image.tsx`, supaya
tab, pratinjau tautan, halaman marketing, dan layar login Google bercerita sama.

## Merender ulang

Bila `icon.svg` berubah, render ulang keduanya. `sharp` sudah ada sebagai
dependensi transitif Next, jadi tak perlu memasang apa pun:

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const p = 'node_modules/.pnpm/sharp@0.34.5/node_modules/sharp/lib/index.js';
const { default: sharp } = await import(pathToFileURL(p).href);
const svg = readFileSync('src/app/(marketing)/icon.svg');
for (const size of [120, 512]) {
  await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: '#fbf9f6' })
    .png()
    .toFile('handoff/brand/merriva-logo-' + size + '.png');
}
"
```

`density: 384` penting: tanpa itu `sharp` meraster SVG pada 72 dpi lalu
memperbesarnya, dan hasilnya buram pada 512 px. `background` diisi karena logo
ini **tidak transparan** — Google menampilkannya di atas latar gelap maupun
terang, dan monogram tinta di atas transparan akan hilang di tema gelap.

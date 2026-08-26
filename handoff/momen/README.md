# handoff/momen — Modul Inti Album Momen (teruji, siap pindah)

**Status verifikasi (26 Agu 2026, lingkungan bersih):** `tsc --strict` + `noUncheckedIndexedAccess` LOLOS · **vitest 40/40 hijau** (`film-render.test.ts` 15, `momen-logic.test.ts` 25) · zod v4 (^4.4), sama dengan versi repo.

Aturan yang sama dengan handoff customizer: **PINDAHKAN, jangan tulis ulang.** Sesuaikan hanya path import. Test ikut pindah dan wajib tetap hijau (pola include vitest repo `src/**/*.test.ts` sudah menangkapnya otomatis).

## Peta penempatan

| File | Tujuan | Catatan |
|---|---|---|
| `film-presets.ts` | `src/lib/momen/film-presets.ts` | Sumber kebenaran preset (UI pemilih filter, preview CSS, bake, enum Zod) |
| `film-render.ts` | `src/lib/momen/film-render.ts` | Pipeline piksel murni — dipanggil dari client component kamera |
| `album-phase.ts` | `src/lib/momen/album-phase.ts` | Fase reveal + countdown; aturan yang SAMA wajib diterapkan di query server |
| `shot-quota.ts` | `src/lib/momen/shot-quota.ts` | UX jatah di klien + pesan error konsisten di server |
| `momen-settings-schema.ts` | `src/lib/momen/momen-settings-schema.ts` | Validasi server action/RPC (Zod v4 strictObject) |
| `*.test.ts` | ikut modulnya | 39 test |

## Kontrak penting

1. **Bake = piksel murni, bukan `ctx.filter`** — Safari tidak andal utk canvas filter; `applyFilmToPixels(imageData.data, w, h, preset.params, {seed})` deterministik & sudah teruji clamp/mono/vignette/halation/grain. Preview live memakai `preset.css` di `<video>` + `preset.overlay` sebagai layer (lihat prototipe `prototypes/momen-album.html` — implementasi referensi yang berperilaku identik).
2. **Integrasi kompresi:** panggil bake SETELAH gambar dirender ke canvas ukuran display (1600px) & SEBELUM `toBlob("image/webp")` — menyatu dengan pola `src/lib/image/compress.ts` (server tidak pernah memproses gambar; EXIF/GPS otomatis hilang saat re-encode).
3. **Fail-closed:** `resolveAlbumPhase` mengembalikan `hidden` untuk `reveal_at` korup; jangan "diperbaiki" jadi permisif.
4. **Seed grain:** pakai hash stabil (mis. dari id foto/urutan jepret) supaya re-render preview == hasil unggah; jangan `Math.random()` tanpa disimpan.
5. `getFilmPreset(id)` fallback ke `polos` untuk id tak dikenal — jangan melempar di jalur render publik.
6. **Field `format` di `momenUploadMetaSchema` (webp|jpeg):** Safari/iOS tidak mendukung `toBlob('image/webp')` (caniuse, verif. 26 Agu 2026) dan diam-diam memberi PNG lossless raksasa — klien wajib cek `blob.type` lalu fallback JPEG q0.82; server menolak selain webp/jpeg. Bug yang sama ada di `compress.ts` existing — perbaiki sekalian (MOMEN-PROMPT langkah 0.5).

## Menjalankan verifikasi di repo (setelah pindah)

`pnpm vitest run src/lib/momen` — 39 test harus hijau tanpa modifikasi selain path import.

# CUSTOMIZER-SPEC — Kustomisasi Terpandu oleh Pembeli (Jalur A)

**Versi:** 1.1 — 2 Agustus 2026 · Keputusan: `DECISIONS.md` #12 (arah), #13 (teknis Fase G), #14 (audit + kontrak `preview`) · Prototipe UX teruji: `prototypes/customizer-mobile.html` (buka di HP; tombol `</>` menampilkan bentuk data)
**Status implementasi:** SELESAI untuk 10 tema — `eternal-rose` (acuan) + noir, verdant, barakah, aria, kirana, meridian, prisma, festa, lumina. Sudah diaudit menyeluruh (10 auditor + sintesis; DECISIONS #14).
**Target:** pembeli akhir mengkustom undangannya dari HP. **Bukan** kanvas drag-and-drop — kurasi terpandu berbasis token.

---

## 1. Prinsip

1. **Kurasi di atas kebebasan** — setiap pilihan yang mungkin dipilih user sudah dipastikan pantas: preset dikurasi, custom accent dijaga penjaga kontras, gaya section adalah varian yang didesain. "Kustom tanpa bisa jelek."
2. **Live preview = tema asli** — yang dilihat saat mengedit adalah komponen tema sungguhan (mode draft) dengan settings state diterapkan instan; bukan mockup.
3. **Settings-driven, bukan layout-driven** — kustomisasi hanya mengubah token (CSS variables) & konfigurasi terdeklarasi; struktur/koreografi tema tetap milik tema. Kontrak `InvitationData` TIDAK berubah.
4. Editor **generik satu untuk semua tema**: tema mendeklarasikan opsinya lewat *options schema*; editor merender kontrol dari schema. Tema tanpa schema = tidak menampilkan fitur kustom (tetap berfungsi normal).

## 2. Bentuk data — `settings.custom` (perluasan `invitations.settings`)

```jsonc
{
  "custom": {
    "v": 1,                       // versi skema utk migrasi ke depan
    "variant": "rose",            // id preset dari options schema tema
    "accent": null,               // hex "#rrggbb" HANYA bila custom (Premium); null = ikut varian
    "fontPair": "a",              // id pasangan font dari schema
    "sections": [                  // urutan render + visibilitas
      { "id": "quote", "visible": true },
      { "id": "couple", "visible": true }
    ],
    "styles": { "gallery": "polaroid" },  // gaya per-section, key/enum dari schema
    "motion": "full",             // "full" | "calm"
    "grain": true
  }
}
```

Default (field absen/null) = bawaan tema — undangan lama tanpa `custom` render persis seperti sekarang (backward compatible, tanpa migrasi).

## 3. Options schema per tema — `src/themes/{slug}/options.ts`

```ts
export const options: ThemeOptions = {
  variants: [ { id:'rose', name:'Rose', acc:'#B76E79', paper:'#F6EFE7', ink:'#241A1E' }, /* 3–5 */ ],
  fontPairs: [ { id:'a', name:'Marcellus + Figtree', dispVar:'var(--er-disp-a)', bodyVar:'var(--er-body-a)' }, /* maks 3; pasangan non-default preload:false */ ],
  sections: [ { id:'hero', reorder:false, toggle:false }, { id:'quote', reorder:true, toggle:true }, /* hero & rsvp wajib tampil */ ],
  styles:   { gallery: ['strip','grid','polaroid'] },
  supports: { customAccent:true, motion:true, grain:true },
  preview:  { root:'er', vars:[ {name:'--rose',token:'accent'}, {name:'--er-serif',token:'disp'} /* … token ∈ accent|accentText|onAccent|paper|ink|disp|body */ ] },
};
```

Registry mengekspor `getThemeOptions(slug)`. Editor generik membaca ini; **server memvalidasi terhadap ini** (satu sumber kebenaran). Font pair memakai `next/font` yang sudah dimuat tema — maksimal 3 pasangan agar berat font terkendali. **`preview` (WAJIB)** memetakan token render → nama CSS var milik tema; dipakai BERSAMA render server & editor pratinjau lewat helper `appearanceStyle` (§8) → satu sumber, anti-drift.

## 4. Penjaga kontras (wajib — teruji di prototipe)

Warna aksen dipakai untuk teks di atas paper → dihitung `--acc-text`: rasio kontras WCAG harus **≥ 4.5**. Bila accent pilihan user kurang, gelapkan bertahap (faktor 0.92, maks 24 iterasi) sampai lolos; elemen dekoratif (garis, blob, tombol berlatar aksen dengan teks putih — teks putih juga dicek ≥4.5 terhadap aksen, fallback ink) tetap memakai warna asli. UI menampilkan catatan snap yang ramah (lihat prototipe). **Hitung juga di server saat render publik** (bukan hanya di editor) supaya data apa pun yang lolos tetap aman dirender.

## 5. Validasi server (server action `updateInvitationAppearance`)

Zod terhadap options schema tema aktual: `variant`/`fontPair`/`styles.*` ∈ enum schema · `sections` = permutasi id yang dikenal (unik, lengkap; yang `toggle:false` harus `visible:true`; yang `reorder:false` dikunci posisinya) · `accent` regex `^#[0-9a-f]{6}$` (flag `i`) **dan** tema `supports.customAccent` **dan** paket Premium (cek `packages.limits`) — hex ketat karena nilai dirender ke CSS variable (cegah injeksi CSS) · `motion`/`grain` enum/boolean, nilai non-default DITOLAK bila tema tak mendukungnya (`supports.motion`/`supports.grain`). Nilai di luar whitelist → tolak (gagal validasi), jangan "dibersihkan diam-diam". Modul murni bebas-DB `parseAppearanceInput` (diuji tanpa mock Supabase); server action membungkusnya dgn auth + cek kepemilikan.

## 6. Gating paket (server-side)

**Basic:** preset varian, urutan & on/off section, motion, grain. **Premium:** + custom accent, + semua fontPair, + semua gaya section (Basic hanya gaya default). Tombol/opsi yang terkunci tetap terlihat dengan badge "Premium" (upsell path), tap → ajakan upgrade.

## 7. UX & halaman

Route baru dashboard: `/dashboard/undangan/[id]/tampilan`. Layout: preview tema asli full-viewport (iframe `/preview/tema/[slug]`) + **bottom sheet** kontrol (pola prototipe): tab **Warna / Font / Bagian / Gaya** (Font muncul hanya bila >1 pasangan; Gaya bila ada gaya/motion/grain), sheet bisa di-peek/expand, semua target sentuh ≥ 44px. Reorder section: **`@dnd-kit/react`** — generasi baru dnd-kit; paket lama `@dnd-kit/core`/`@dnd-kit/sortable` kini berstatus *legacy* di dokumentasi resminya — + tombol panah ↑↓ (aksesibilitas & fallback). Perubahan diterapkan instan ke preview lewat **manipulasi DOM iframe same-origin** (bukan re-render props React): editor memakai resolver `resolveAppearance` + peta `preview.vars` + helper `appearanceStyle` yang SAMA dgn render server, jadi editor ≡ halaman publik tanpa duplikasi kode (DECISIONS #13, #14). **Simpan** = PATCH `settings.custom` + **`revalidatePath('/{slug}')`** + `revalidatePath` halaman tampilan (halaman publik ISR berbasis PATH; `updateTag` dipertimbangkan tapi DITOLAK karena `[slug]` belum tag-based — #13); **Reset** = buang `settings.custom` (kembali ke bawaan tema). Indikator dirty-state bila ada perubahan belum disimpan.

## 8. Rendering di tema

Tema menerima `settings.custom` (sudah tervalidasi) → `resolveAppearance(options, custom)` (murni, dipakai server & editor). Hasil diterapkan sebagai: **CSS variables** di ELEMEN AKAR tema — objek `appearance.style` disusun `appearanceStyle(options.preview.vars, resolved)` (nama var milik tema, mis. `--rose`/`--er-serif`; token → nilai resolve) → diteruskan ke prop opsional `appearance` di `CoverGate` bersama; **data-atribut** `data-gallery` + `data-motion` (`calm` meng-AND-kan preferensi user dgn tier device) + `data-variant` (id varian terselesaikan — dipasang editor pratinjau untuk SEMUA tema; tema yang mengubah lebih dari warna per varian memakainya di CSS, mis. meihua #103, warta Edisi Indonesia #130 yang juga menukar teks judul dua bahasa lewat CSS karena pratinjau langsung tak merender ulang); dan **urutan render section = urutan array di server** via section-map (`Record<string, ReactNode>` difilter/urut oleh `resolved.sections`) — **bukan CSS `order`** (produksi wajib DOM order asli demi aksesibilitas, SEO, urutan fokus). Penjaga kontras dihitung juga di sini (server). Undangan tanpa `custom` → cabang legacy, render identik. Nol JS tambahan di halaman publik — semuanya resolve saat render (ISR).

## 9. Definition of Done

**Status per item (2 Agu 2026 — `typecheck`/`lint` 0, `test` 312/312, `build` hijau):**
- ✅ Validasi server teruji (unit: nilai liar/injeksi ditolak; sections permutasi salah ditolak) — `parse-appearance.test.ts` + `settings-custom-schema`.
- ✅ Penjaga kontras unit-tested (`#e8b7c0` di `#F6EFE7` → snap rasio ≥4.5) — `resolve.test.ts` + `contrast-guard`.
- ✅ Preview editor = halaman publik utk settings yang sama — via resolver + `appearanceStyle` bersama (satu sumber). *Catatan:* tema bernomor (aria/prisma) tak menghitung ulang nomor section secara live saat reorder di editor — nomor benar setelah Simpan (render server); aproksimasi pratinjau yang diterima (#14).
- ✅ Gating paket terbukti (Basic tak bisa simpan accent/fontPair/gaya non-default via API langsung) — unit test.
- ✅ Undangan lama tanpa `custom` render tanpa perubahan (cabang legacy tiap tema).
- ✅ Kontrak lintas-tema terkunci — `theme-contracts.test.ts`: tiap tema wajib `preview` valid + `appearanceStyle` menghasilkan tepat var yang dideklarasikan + tiap id section & nilai gaya berlabel Indonesia.
- ⏳ Reorder teruji sentuh di HP nyata (drag + panah) — verifikasi manual di perangkat.
- ⏳ Bundle & Lighthouse halaman publik ≥90 — diukur di Docker/staging (server standalone tak jalan di Windows lokal).

## 10. Rollout

**SELESAI untuk 10 tema.** Mulai `eternal-rose` (schema penuh sebagai acuan) → tema lain mendeklarasikan `options.ts` masing-masing (varian warna dikurasi sesuai DNA-nya; mis. barakah: Zamrud/Maroon/Biru Tua; kirana: Sogan/Indigo/Hitam Wayang). Fitur muncul otomatis per tema begitu schema-nya ada. **Tema baru WAJIB** menambah blok `preview` di `options.ts` (di-enforce tsc + `theme-contracts.test.ts`) dan menyusun `appearance.style` via `appearanceStyle`. Lima tema wedding juga punya pasangan font `b` + gaya galeri grid/polaroid (Premium).

## 11. Di luar scope ini (dicatat, tidak dikerjakan)

Kanvas bebas ala Canva — **ditolak sadar** (DECISIONS #12). "Studio" section-builder untuk EO/reseller di desktop (kandidat: [Puck](https://github.com/puckeditor/puck), MIT, embeddable, komponen = section tema kita) — dievaluasi terpisah bila ada tarikan pasar.

# Kontrak Tema v2 — standar untuk menambah banyak tema

Status: **fase 1a, 1b & 2 SELESAI** (DECISIONS #85, #86, #87) · fase 3 menunggu · 14 Okt 2026 · keputusan pemilik: media
**non-destruktif**, susunan section **boleh berbeda antar tema**, tema dibuat **dari arahan pemilik**.

Dokumen ini melengkapi — bukan menggantikan — [`THEME-DESIGN.md`](THEME-DESIGN.md)
(art direction & motion), [`THEME-PORTING.md`](THEME-PORTING.md) (cara memasang
satu tema), dan [`CUSTOMIZER-SPEC.md`](CUSTOMIZER-SPEC.md) (kustomisasi tampilan).
Yang diatur di sini: **apa yang harus dideklarasikan sebuah tema** supaya editor,
server, dan katalog bisa melayaninya tanpa kode khusus per tema.

---

## 0. Kenapa ini perlu sekarang

Sepuluh tema pertama ditulis satu per satu, dan sebagian kontraknya hidup di
kepala — bukan di kode. Buktinya sudah ada hari ini:

- **`lumina` membuat `hero` bisa disembunyikan** (`{ id: "intro", toggle: true }`)
  padahal CUSTOMIZER-SPEC §3 mewajibkan hero & rsvp selalu tampil. Tak ada yang
  menangkapnya karena tak ada yang memeriksa.
- **Kosakata section sudah bercabang:** `hero` / `intro` / `opening` untuk hal
  yang sama; `couple` vs `principals`; `rundown` + `event` di prisma.
- **Media tidak pernah dideklarasikan.** `ThemeOptions` tak menyebut foto sama
  sekali; editor mengeraskan daftarnya (pria, wanita, sampul, logo, galeri).
  Tema yang ingin hero lanskap atau tanpa foto mempelai tak punya cara
  memberi tahu.

Dengan sepuluh tema itu masih bisa diingat. Dengan tiga puluh, tidak.

**Dan inilah jendela termurahnya:** produksi berisi **3 undangan, 0 aktif, 0 yang
punya `settings.custom`**. Mengubah kosakata section dan model foto sekarang =
**nol migrasi data**. Setiap minggu penundaan menambah ongkosnya.

---

## 1. Kosakata section kanonik

Id section BUKAN nama bebas. Ia masuk `settings.custom.sections`, dipakai label
editor, dan menentukan apakah pengaturan ikut berpindah saat pemilik ganti tema.

### Inti — wajib ada di setiap tema

| id | arti | ketentuan |
|---|---|---|
| `hero` | layar pembuka & identitas acara | `reorder: false`, `toggle: false` |
| `rsvp` | konfirmasi kehadiran & ucapan | `toggle: false` |

### Standar — dipakai bila temanya memang punya

`quote` · `couple` (pihak utama: mempelai / anak / narasumber) · `countdown` ·
`schedule` · `agenda` (rundown corporate) · `gallery` · `story` · `envelope`

### Kandidat — boleh dipakai, masuk tabel ini begitu ada tema pertamanya

`location` (peta & denah) · `livestream` · `dresscode` · `wishes` (dinding ucapan
terpisah dari RSVP)

### Section KHAS tema

Keputusan pemilik: susunan section boleh berbeda antar tema. Supaya itu tidak
berarti kekacauan, section yang hanya ada di satu tema memakai **awalan `x-`**
dan **wajib menyertakan `label`**:

```ts
{ id: "x-seating", label: "Denah Meja", reorder: true, toggle: true }
```

Id tanpa `x-` yang tidak ada di tabel di atas **ditolak test konformansi**. Itu
yang menjaga kosakata inti tetap kecil sementara ragamnya bebas tumbuh.

### Yang harus diganti saat implementasi

| sekarang | jadi | tema |
|---|---|---|
| `intro` | `hero` | meridian, lumina, prisma |
| `opening` | `hero` | aria, festa |
| `principals` | `couple` | lumina |
| `rundown` | `agenda` | prisma |
| `event` | `schedule` | prisma |

Label yang tampil ke pemilik **tidak** ikut berubah: `options.sections[].label`
mengatur itu per tema ("Mempelai" / "Narasumber" / "Pengantin").

---

## 2. Blok `media` di `options.ts`

Perluasan `ThemeOptions`. Tema mendeklarasikan foto apa saja yang dipakainya;
**editor merender bidang unggah persis dari daftar ini** — tak ada lagi bidang
yang mengambang tanpa penampil.

```ts
media: {
  slots: [
    { id: "groom", aspect: 4 / 5 },
    { id: "bride", aspect: 4 / 5 },
    { id: "cover", aspect: 3 / 4 },
  ],
  gallery: { recommended: 6 },
},
```

- **`id`** ∈ `cover` · `groom` · `bride` · `celebrant` · `logo`, atau khas tema
  dengan awalan `x-` + `label`.
- **`aspect`** = lebar / tinggi wadah di tema. Dipakai editor **hanya untuk
  bingkai pratinjau penyesuaian** — bukan untuk memangkas berkas (§3).
- Tema yang tak menyebut `groom`/`bride` → bidangnya **tidak muncul** di editor
  untuk tema itu.

Konsekuensi langsung: `cover` dan `logo` yang hari ini bisa diunggah tetapi tak
dirender tema mana pun akan **hilang dari editor** sampai ada tema yang
mendeklarasikannya. Itu memperbaiki janji palsu, bukan menghapus fitur.

---

## 3. Foto non-destruktif — rasio milik TEMA, bukan milik berkas

### Masalah dengan memanggang

Pemangkasan 4:5 yang dipanggang (DECISIONS #84) aman selama keenam tema
berwadah potret 1,24–1,35. Begitu ada tema lanskap, rasionya salah; dan pemilik
yang berganti tema setelah mengunggah akan terpangkas keliru **tanpa jalan
mundur** — tepinya sudah tak ada di berkas.

### Bentuk data

Berkas diunggah **utuh** (2 varian seperti sekarang). Penyesuaian disimpan
sebagai angka di `content`:

```ts
photo: {
  path: "inv/<invId>/foto/<uuid>",  // PREFIX 2-varian, seperti sekarang
  x: 0.5,      // titik fokus mendatar, 0..1
  y: 0.38,     // titik fokus tegak, 0..1
  zoom: 1.4,   // 1..4
}
```

Skema menerima **string telanjang** juga (`photo: "inv/…"`) dan menormalkannya ke
`{ path, x: 0.5, y: 0.5, zoom: 1 }`. Jadi dua foto yang sudah terunggah hari ini
tetap sah — **tanpa migrasi**.

### Cara tema memakainya

Satu helper bersama, satu baris per `<img>`:

```tsx
import { fotoStyle } from "@/themes/_shared/foto";

<img src={foto.url} alt="" style={fotoStyle(foto)} />
```

```ts
// object-position menentukan bagian mana yang terlihat dalam `cover`;
// transform-origin disamakan supaya memperbesar terjadi DI titik fokus,
// bukan di tengah wadah.
export function fotoStyle(f: FotoView): CSSProperties {
  const pos = `${f.x * 100}% ${f.y * 100}%`;
  return {
    objectFit: "cover",
    objectPosition: pos,
    transform: f.zoom === 1 ? undefined : `scale(${f.zoom})`,
    transformOrigin: pos,
  };
}
```

Kontrak props berubah dari `groomPhotoUrl: string | null` menjadi
`groomPhoto: FotoView | null`. **Itu perubahan kontrak props tema** — disetujui
pemilik 14 Okt 2026.

### Yang ikut diganti

Pemangkas kanvas (`photo-cropper.tsx` + `cropToVariants`) **diganti** penyesuai
berbasis CSS: kotak pratinjau memakai `fotoStyle` yang sama persis dengan yang
dipakai tema, jadi apa yang dilihat pemilik = apa yang dilihat tamu. Geometri
penjepitan di `lib/image/crop.ts` sebagian masih terpakai (zoom & jepit titik
fokus); pemangkasan kanvasnya tidak.

Hasil sampingan yang menyenangkan: **kodenya lebih sedikit**, bukan lebih
banyak — tak ada lagi kanvas keluaran, `drawImage`, atau penghitungan ukuran.

---

## 4. Scaffold — `pnpm theme:new <slug>`

Menambah satu tema hari ini menyentuh **enam tempat** di luar folder temanya:
`registry.ts`, `theme-options-registry.ts`, `demo-data-registry.ts`,
`catalog-meta.ts`, migrasi seed `themes`, dan `pnpm thumbs`. Yang terlewat tak
ketahuan sampai sesuatu kosong di produksi.

Skrip ini membuat folder dari template minimal yang SUDAH memenuhi kontrak,
menambahkan barisnya di keempat registry, dan menuliskan rangka migrasi seed
(`is_active = false` — tema baru tak boleh muncul di katalog sebelum DoD-nya
selesai). Penyisipan registrinya idempoten. Sisanya — art direction — pekerjaan
sungguhan.

```bash
pnpm theme:new senja
pnpm theme:new kembang-api --name "Kembang Api" --tier premium --prefix ka
```

---

## 5. Test konformansi — DoD yang dijaga CI, bukan ingatan

Satu berkas test mengiterasi `themeRegistry` dan menolak tema yang:

1. tak punya `options.ts` yang bisa dibaca `getThemeOptions(slug)`;
2. `variants` kosong, `fontPairs` di luar 1–3;
3. tak punya `hero` dengan `reorder:false, toggle:false`, atau `rsvp` dengan
   `toggle:false` — **ini yang akan menangkap `lumina` hari ini**;
4. memakai id section di luar kosakata §1 tanpa awalan `x-` + `label`;
5. memakai id media slot di luar §2, atau `aspect` di luar 0,4–2,5;
6. token `preview.vars` di luar `accent|accentText|onAccent|paper|ink|disp|body`;
7. tak punya entri di `themeCatalogMeta`, atau kontras `ink` di atas `bg` < 4.5;
8. tak punya demo-data;
9. slug-nya tak pernah muncul di migrasi seed `themes` mana pun.

Kesembilannya kini terpasang (#85 untuk 1–8, #87 untuk yang ke-9).

Tema ke-30 jadi sama amannya dengan tema ke-11.

---

## 6. Urutan pengerjaan

| Fase | Isi | Catatan |
|---|---|---|
| **1a** ✅ | Kosakata kanonik + rename alias di 6 tema · helper `defaultSectionOrder` · test konformansi | SELESAI 14 Okt 2026 — menemukan 4 tema ber-hero yang bisa disembunyikan + 2 tema dua-jalur (DECISIONS #85) |
| **1b** ✅ | Blok `media` · foto non-destruktif + `fotoStyle` + 6 tema · penyesuai editor berbasis CSS | SELESAI 14 Okt 2026 — nol migrasi; 4 tema ternyata tak merender foto mempelai, `cover`/`logo` tak dirender siapa pun (DECISIONS #86) |
| **2** ✅ | `pnpm theme:new` + template tema minimal + test yang menjaga templatenya | SELESAI 14 Okt 2026 — tema hasil generate langsung hijau di typecheck, lint, & konformansi (DECISIONS #87) |
| **3** | Tema baru — satu commit per tema, masing-masing lolos DoD | Di sinilah ragam dibangun |

**Temuan fase 1a yang mengubah perkiraan fase 1b:** `aria` dan `prisma` bukan
berjalur tunggal. Keduanya punya cabang `resolved` DAN JSX legacy yang tak
membaca `options.sections` sama sekali. Fase 1b harus memperhitungkan itu —
mengganti kontrak foto di sana menyentuh dua tempat per tema, bukan satu.

Fase 1 menyentuh 6 tema sekaligus. Itu memang sekali kerja besar — dan itulah
alasan ia dikerjakan **sebelum** tema ke-11, bukan sesudah tema ke-30.

---

## 7. Di luar kontrak ini (dicatat, tidak dikerjakan)

- **`/api/og` memakai foto sampul** (SPEC §4.5) — berdiri sendiri, tak menunggu
  dokumen ini.
- **Membawa `settings.custom` saat pemilik ganti tema.** Kosakata kanonik
  membuatnya mungkin; apakah dilakukan, keputusan terpisah.
- **Tema untuk kategori `family`** — slot media `celebrant` sudah disediakan di
  kosakata, tetapi belum ada temanya.

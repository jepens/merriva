/**
 * Batas panjang teks & jumlah entri isian KONTEN undangan — SATU sumber angka
 * untuk skema Zod (strict & draft) DAN editor (`maxLength`, penghitung
 * karakter, batas tombol "Tambah"). Tanpa angka ganda, UI tak mungkin
 * mengizinkan isian yang kemudian ditolak autosave (DECISIONS #41).
 *
 * Sengaja TANPA impor: komponen klien boleh mengimpor modul ini langsung tanpa
 * menyeret Zod & seluruh graf skema ke bundle editor. Berbeda dari
 * `lib/limits.ts` yang berisi batas PAKET (jumlah foto/tamu).
 *
 * Menaikkan angka selalu aman. MENURUNKAN angka membuat data lama melebihi
 * batas → autosave menolak sampai pemilik memendekkannya; periksa data
 * production lebih dulu.
 */
export const FIELD_LIMITS = {
  person: {
    name: 120,
    nickname: 60,
    fatherName: 120,
    motherName: 120,
    childOrder: 160,
  },
  quote: { text: 500, source: 120 },
  bank: { bank: 60, number: 40, holder: 120 },
  ewallet: { provider: 40, number: 40, holder: 120 },
  envelope: { banks: 6, ewallets: 6, giftAddress: 300 },
  storyEntry: { title: 120, date: 60, narrative: 2000 },
  common: {
    greeting: 1000,
    youtubeUrl: 200,
    livestreamUrl: 500,
    /** Nama berkas musik unggahan (hanya tampil di editor). */
    customMusicName: 120,
  },
  wedding: { title: 160, story: 20 },
  corporate: { eventName: 160, organizer: 160, description: 2000, agenda: 30 },
  pic: { name: 120, phone: 40, email: 160 },
  family: { eventName: 160, celebrant: 120, parents: 200, wishes: 20 },
  event: { name: 80, venueName: 160, address: 400, mapsUrl: 500, sessions: 10 },
} as const;

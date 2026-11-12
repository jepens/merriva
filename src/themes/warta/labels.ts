/**
 * Teks tetap tema `warta` (koran retro) — terpusat supaya tak tercecer di JSX.
 *
 * Dua kelompok:
 *  - `DEKOR` — KOP & JUDUL dekoratif ala koran, per EDISI (DECISIONS #130).
 *    Edisi `en` (varian Koran/Sepia/Merah) tetap berbahasa Inggris ("The
 *    Wedding Post", "Hot News!") — itu rupa temanya (#123). Edisi `id`
 *    (varian "Edisi Indonesia") memakai padanan Indonesia; teks dari halaman
 *    acuan pemilik dipakai PERSIS ("Berita Utama !", "Halaman 2 . Berita",
 *    "Undangan Pernikahan", "… . by the family"). Kedua kamus berbentuk sama
 *    (`Dekor`) — tak ada judul yang lupa diterjemahkan (dijaga test).
 *  - `L` — semua yang INFORMATIF, selalu Bahasa Indonesia di edisi mana pun
 *    (#118): tanggal, jam, label hitung mundur, tombol, instruksi, kalimat
 *    pengantar, dan fallback.
 *
 * Huruf besar dipasang CSS (`text-transform`), bukan ditulis di sini: pembaca
 * layar mengeja kata berhuruf kapital semua sebagai singkatan.
 */

import { VARIAN_EDISI_INDONESIA } from "./options";

/** Edisi bahasa judul dekoratif: `en` = bawaan (#123), `id` = Edisi Indonesia. */
export type Edisi = "en" | "id";

/** Edisi dari id varian TERSELESAIKAN (`resolveAppearance`); tanpa kustomisasi = `en`. */
export function edisiDari(variantId: string | null | undefined): Edisi {
  return variantId === VARIAN_EDISI_INDONESIA ? "id" : "en";
}

/** Rubrik folio per section ("Page 3 · Couple" / "Halaman 3 . Mempelai"). */
export type Rubrik =
  | "hero"
  | "couple"
  | "story"
  | "countdown"
  | "schedule"
  | "video"
  | "rsvp"
  | "gallery";

export interface Dekor {
  /** Kop blackletter sampul & penutup. */
  masthead: string;
  /** Kanan folio setiap halaman. */
  folioRight: string;
  /** Pemisah nomor halaman & rubrik di folio (nomornya CSS counter). */
  folioSep: string;
  folio: Record<Rubrik, string>;
  edition: string;
  free: string;
  cover: {
    headline: (a: string, b: string) => string;
    saveTheDate: string;
    continued: (page: number) => string;
  };
  hero: {
    kicker: string;
    headline: string;
    reported: (city: string | null) => string;
  };
  couple: { bride: string; groom: string };
  story: { heading: string; eyebrow: string };
  countdown: {
    eyebrow: string;
    heading: string;
    sub: string;
    stamp: (numeric: string) => string;
    band: string;
  };
  schedule: {
    heading: string;
    announcements: (n: number, sameDay: boolean) => string;
  };
  video: { heading: string; eyebrow: string };
  rsvp: { eyebrow: string; heading: string };
  gallery: { heading: string };
  envelope: { clip: string; heading: string };
  footer: {
    eyebrow: string;
    motto: string;
    printed: (city: string | null) => string;
  };
}

const EN: Dekor = {
  masthead: "The Wedding Post",
  folioRight: "The Wedding Post",
  folioSep: " · ",
  // Rubrik folio "Page N · News"; kata "Page" + nomornya CSS counter di
  // warta.css (`.wt-folio__n::before`) — ikut urutan & visibilitas section.
  folio: {
    hero: "News",
    couple: "Couple",
    story: "Feature",
    countdown: "Diary",
    schedule: "Classified",
    video: "Cinema",
    rsvp: "Reply",
    gallery: "Archive",
  },
  edition: "Vol. I · No. 1",
  free: "Free Copy",
  cover: {
    headline: (a, b) => `${a} & ${b} are getting married!`,
    saveTheDate: "Save the Date",
    continued: (page) => `Continued on page ${page}`,
  },
  hero: {
    kicker: "Hot News!",
    headline: "The Happy Couple Invites You",
    reported: (city) =>
      city ? `Reported from ${city} · by the family` : "Reported by the family",
  },
  couple: { bride: "Meet the Bride", groom: "Meet the Groom" },
  story: {
    heading: "Our Love Story",
    eyebrow: "As told by the happy couple",
  },
  countdown: {
    eyebrow: "Mark your calendar",
    heading: "Save the Date",
    sub: "And celebrate with us!",
    stamp: (numeric) => `Don't miss it! · ${numeric}`,
    band: "Counting Down",
  },
  schedule: {
    heading: "Wedding Event",
    announcements: (n, sameDay) => {
      const words = ["One", "Two", "Three", "Four", "Five", "Six"];
      const count = words[n - 1] ?? String(n);
      const noun = n === 1 ? "announcement" : "announcements";
      return sameDay && n > 1
        ? `${count} ${noun}, one day`
        : `${count} ${noun}`;
    },
  },
  video: { heading: "On Screen", eyebrow: "Now showing" },
  rsvp: { eyebrow: "Kindly reply", heading: "RSVP" },
  gallery: { heading: "Precious Moment" },
  envelope: { clip: "✂ Clip this coupon", heading: "Wedding Gift" },
  footer: {
    eyebrow: "Thank you for reading",
    motto: "All the love that's fit to print",
    printed: (city) =>
      city ? `Printed in ${city} · Vol. I No. 1` : "Vol. I No. 1",
  },
};

const ID: Dekor = {
  // Nama tampilan tema = "Berita" (#136); kode/slug tetap `warta`.
  masthead: "Berita Pernikahan",
  folioRight: "Undangan Pernikahan",
  folioSep: " . ",
  folio: {
    hero: "Berita",
    couple: "Mempelai",
    story: "Fitur",
    countdown: "Agenda",
    schedule: "Iklan Baris",
    video: "Sinema",
    rsvp: "Balasan",
    gallery: "Arsip",
  },
  edition: "Th. I · No. 1",
  free: "Gratis",
  cover: {
    headline: (a, b) => `${a} & ${b} akan menikah!`,
    saveTheDate: "Catat Tanggalnya",
    continued: (page) => `Bersambung ke hlm. ${page}`,
  },
  hero: {
    kicker: "Berita Utama !",
    headline: "Pasangan Bahagia Mengundang Anda",
    // "by the family" tetap Inggris — persis halaman acuan pemilik.
    reported: (city) =>
      city
        ? `Laporan dari ${city} . by the family`
        : "Laporan khusus . by the family",
  },
  couple: { bride: "Sosok Mempelai Wanita", groom: "Sosok Mempelai Pria" },
  story: { heading: "Kisah Cinta Kami", eyebrow: "Sumber dari kedua mempelai" },
  countdown: {
    eyebrow: "Tandai kalender Anda",
    heading: "Catat Tanggalnya",
    sub: "Dan rayakan bersama kami!",
    stamp: (numeric) => `Jangan lupa! · ${numeric}`,
    band: "Hitung Mundur",
  },
  schedule: {
    heading: "Rangkaian Acara",
    announcements: (n, sameDay) => {
      const words = ["Satu", "Dua", "Tiga", "Empat", "Lima", "Enam"];
      const count = words[n - 1] ?? String(n);
      return sameDay && n > 1
        ? `${count} pengumuman, satu hari`
        : `${count} pengumuman`;
    },
  },
  video: { heading: "Di Layar", eyebrow: "Sedang tayang" },
  // Bukan "RSVP": di Dhaksinarga "v" berbentuk "u" → terbaca "rsup".
  rsvp: { eyebrow: "Mohon balasan", heading: "Kehadiran" },
  gallery: { heading: "Momen Berharga" },
  envelope: { clip: "✂ Gunting kupon ini", heading: "Tanda Kasih" },
  footer: {
    eyebrow: "Terima kasih telah membaca",
    motto: "Segala kasih yang layak dicetak",
    printed: (city) =>
      city ? `Dicetak di ${city} · Th. I No. 1` : "Th. I No. 1",
  },
};

export const DEKOR: Readonly<Record<Edisi, Dekor>> = { en: EN, id: ID };

/** Teks dekoratif kedua edisi — dirender berdampingan, disaring CSS. */
export interface Dwibahasa {
  readonly en: string;
  readonly id: string;
}

/** Ambil teks yang sama dari kedua kamus: `dwi((d) => d.hero.kicker)`. */
export function dwi(pick: (d: Dekor) => string): Dwibahasa {
  return { en: pick(EN), id: pick(ID) };
}

export const L = {
  cover: {
    caption: "Foto: arsip keluarga.",
    recipient: "Kepada Yth.",
    recipientFallback: "Bapak/Ibu/Saudara/i",
    open: "Baca Selengkapnya",
  },
  hero: {
    lead: "Dengan memohon rahmat dan ridha Tuhan Yang Maha Esa, kami bermaksud menyelenggarakan resepsi pernikahan kami. Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu kepada kedua mempelai.",
    // Tanpa "—": tanda pisahnya dirender terpisah dengan font isi (glyph em
    // dash Special Elite bergelombang "⁓-", lihat sections.tsx).
    byline: (city: string | null) =>
      city ? `Redaksi keluarga, ${city}` : "Redaksi keluarga",
  },
  couple: {
    brideCaption: "Mempelai wanita",
    groomCaption: "Mempelai pria",
    childOf: (childOrder: string | undefined, fallback: string) =>
      `${childOrder?.trim() || fallback} dari`,
    daughter: "Putri",
    son: "Putra",
    parents: (father?: string, mother?: string) => {
      const f = father?.trim();
      const m = mother?.trim();
      if (f && m) return `Bapak ${f} & Ibu ${m}`;
      if (f) return `Bapak ${f}`;
      if (m) return `Ibu ${m}`;
      return "";
    },
  },
  countdown: {
    weekdays: ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"],
    months: [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ],
    calendarLabel: (month: string, year: number, day: number) =>
      `Kalender ${month} ${year}, tanggal ${day} ditandai sebagai hari acara`,
    days: "Hari",
    hours: "Jam",
    minutes: "Menit",
    seconds: "Detik",
    done: "Hari bahagia telah tiba",
  },
  schedule: {
    time: (start: string, end: string | null, tz: string) =>
      end ? `Pukul ${start} – ${end} ${tz}` : `Pukul ${start} ${tz} – selesai`,
    maps: "Petunjuk Lokasi",
    calendar: "Simpan Kalender",
    calendarGoogle: "Google Kalender",
    calendarIcs: "Apple / Outlook",
  },
  // Info live di bawah video "Di Layar" (#135) — bukan lagi di section acara.
  live: {
    badge: "Live",
    watch: "Tonton Siaran Langsung",
  },
  rsvp: {
    lead: "Mohon konfirmasi kehadiran Anda agar kami dapat menyiapkan tempat dengan sebaik-baiknya.",
  },
  gallery: {
    caption: "Dari arsip redaksi keluarga.",
  },
  envelope: {
    note: "Doa restu Anda adalah hadiah terindah bagi kami. Namun bila memberi adalah cara Anda menunjukkan kasih, Anda dapat mengirimkannya secara cashless.",
    tabTransfer: "Transfer Langsung",
    tabGift: "Kirim Kado",
    transferLead: "Transfer langsung ke rekening berikut:",
    giftLead: "Kirim kado ke alamat berikut:",
    copy: "Salin",
    copied: "Tersalin",
    holder: "a.n.",
  },
  footer: {
    thanks:
      "Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Anda berkenan hadir dan memberikan doa restu.",
    by: "Dibuat dengan",
    brand: "Merriva",
  },
} as const;

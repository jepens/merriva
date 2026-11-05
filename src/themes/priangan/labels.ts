/**
 * Label chrome tema Priangan (wedding adat Sunda, tier Story) — terpusat di
 * tema. Bahasa Indonesia dengan istilah Sunda dari prototipe
 * `prototypes/priangan-story.html`. Catatan budaya (THEME-WAVE3 §3.1): tanpa
 * gunungan/wayang (identitas kirana/Jawa), tanpa kujang di desain bawaan.
 */
export const L = {
  cover: {
    eyebrow: "Pawiwahan · Undangan Pernikahan",
    recipient: "Kahatur Bapak/Ibu/Saudara/i",
    recipientFallback: "Tamu Undangan",
    open: "Buka Undangan",
    hint: "Gulir saparantos dibuka",
  },
  hero: {
    eyebrow: "Wilujeng Sumping",
    lead: "Dengan rahmat Allah ﷻ dan restu kedua orang tua, kami bermaksud menyatukan dua hati dalam ikatan pernikahan.",
  },
  quote: {
    fallbackText: "Silih asih, silih asah, silih asuh.",
    fallbackSource: "Pepatah Sunda",
    caption: "Pepatah Sunda",
  },
  couple: {
    eyebrow: "Calon Pangantén · Kedua Mempelai",
    heading: "Neda Pidu'a",
    bride: "Mempelai Wanita",
    groom: "Mempelai Pria",
    parents: (father?: string, mother?: string) => {
      const f = father?.trim();
      const m = mother?.trim();
      if (f && m) return `Putra/Putri dari Bapak ${f} & Ibu ${m}`;
      if (f) return `Putra/Putri dari Bapak ${f}`;
      if (m) return `Putra/Putri dari Ibu ${m}`;
      return "";
    },
  },
  countdown: {
    eyebrow: "Ngitung Dinten · Menghitung Hari",
    done: "Dinten anu diantos-antos parantos sumping",
    days: "Hari",
    hours: "Jam",
    minutes: "Menit",
    seconds: "Detik",
  },
  schedule: {
    eyebrow: "Rangkaian Acara",
    heading: "Hatur Uninga",
    maps: "Petunjuk Lokasi",
    calendar: "Simpan Kalender",
    calendarGoogle: "Google Kalender",
    calendarIcs: "Apple / Outlook",
  },
  gallery: { eyebrow: "Galeri", heading: "Potret Kenangan", caption: "Foto" },
  video: { eyebrow: "Video", heading: "Kenangan Bergerak" },
  story: { eyebrow: "Lalampahan", heading: "Kisah Kami" },
  envelope: {
    eyebrow: "Tanda Kasih",
    heading: "Kirim Hadiah",
    note: "Doa restu Bapak/Ibu adalah hadiah terindah. Bagi yang ingin berbagi tanda kasih:",
    copy: "Salin",
    copied: "Tersalin",
    giftAddress: "Alamat pengiriman kado",
    holder: "a.n.",
  },
  footer: {
    eyebrow: "Hatur Nuhun",
    thanks:
      "Mugia kersa rawuh sareng maparin du'a restu — hatur nuhun kana sadaya perhatosanana.",
    by: "Dibuat dengan",
    brand: "Merriva",
  },
} as const;

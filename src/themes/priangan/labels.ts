/**
 * Label chrome tema Priangan (wedding adat Sunda, tier Story) — terpusat di
 * tema. Bahasa Indonesia dengan istilah Sunda dari prototipe
 * `prototypes/priangan-story.html`. Catatan budaya (THEME-WAVE3 §3.1): tanpa
 * gunungan/wayang (identitas kirana/Jawa), tanpa kujang di desain bawaan.
 */
export const L = {
  cover: {
    eyebrow: "Undangan Pernikahan",
    recipient: "Kepada Yth. Bapak/Ibu/Saudara/i",
    recipientFallback: "Tamu Undangan",
    open: "Buka Undangan",
    hint: "Gulir setelah terbuka",
  },
  hero: {
    eyebrow: "Selamat Datang",
    lead: "Dengan rahmat Allah ﷻ dan restu kedua orang tua, kami bermaksud menyatukan dua hati dalam ikatan pernikahan.",
  },
  quote: {
    fallbackText: "Saling mengasihi, saling mengasah diri, saling menjaga.",
    fallbackSource: "Falsafah Sunda",
    caption: "Falsafah Sunda",
  },
  couple: {
    eyebrow: "Kedua Mempelai",
    heading: "Memohon Doa Restu",
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
    eyebrow: "Menghitung Hari",
    done: "Hari yang dinanti telah tiba",
    days: "Hari",
    hours: "Jam",
    minutes: "Menit",
    seconds: "Detik",
  },
  schedule: {
    eyebrow: "Jadwal",
    heading: "Rangkaian Acara",
    maps: "Petunjuk Lokasi",
    calendar: "Simpan Kalender",
    calendarGoogle: "Google Kalender",
    calendarIcs: "Apple / Outlook",
    livestream: "Tonton Siaran Langsung",
  },
  gallery: { eyebrow: "Galeri", heading: "Potret Kenangan", caption: "Foto" },
  video: { eyebrow: "Video", heading: "Kenangan Bergerak" },
  story: { eyebrow: "Perjalanan", heading: "Kisah Kami" },
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
    eyebrow: "Terima Kasih",
    thanks:
      "Merupakan kehormatan bagi kami apabila Bapak/Ibu berkenan hadir dan memberikan doa restu — terima kasih atas segala perhatiannya.",
    by: "Dibuat dengan",
    brand: "Merriva",
  },
} as const;

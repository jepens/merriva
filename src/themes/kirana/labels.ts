/**
 * Label chrome tema Kirana (wedding adat Jawa modern, tier Story) — terpusat di
 * tema. Bahasa Indonesia dengan istilah Jawa dari prototipe (kirana-story.html).
 */
export const L = {
  cover: {
    eyebrow: "Dhaup Ageng · Undangan Pernikahan",
    recipient: "Katur dhumateng",
    recipientFallback: "Bapak/Ibu Tamu Undangan",
    open: "Buka Undangan",
    hint: "Gulir sasampunipun kabuka",
  },
  hero: {
    eyebrow: "Assalamu'alaikum Wr. Wb.",
    titleTop: "Cinta yang tumbuh,",
    titleBottom: "restu yang",
    titleAccent: "bersemi.",
    lead: "Kados dene sekar truntum ingkang tansah semi — seperti bunga truntum yang selalu bersemi kembali, kami memohon doa restu untuk melangkah ke jenjang pernikahan.",
  },
  sekar: {
    caption: "Paribasan Jawa",
  },
  couple: {
    eyebrow: "Temanten Kekalih · Kedua Mempelai",
    bride: "Mempelai Putri",
    groom: "Mempelai Kakung",
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
    eyebrow: "Ngetang Dinten · Menghitung Hari",
    done: "Dinten ingkang kaantu-antu sampun rawuh ✽",
    days: "Hari",
    hours: "Jam",
    minutes: "Menit",
    seconds: "Detik",
  },
  schedule: {
    eyebrow: "Rangkaian Upacara",
    maps: "Petunjuk Arah",
    calendar: "Simpan Kalender",
    calendarGoogle: "Google Kalender",
    calendarIcs: "Apple / Outlook",
  },
  gallery: { eyebrow: "Lampah Katresnan · Galeri", caption: "Foto" },
  story: { eyebrow: "Lelampahan Katresnan", heading: "Kisah Kami" },
  envelope: {
    eyebrow: "Tanda Asih",
    heading: "Paring Tanda Asih",
    note: "Pangestu Bapak/Ibu adalah hadiah termulia. Bila berkenan paring tanda asih, kami sampaikan atur nuwun ingkang tanpa upami:",
    copy: "Salin",
    copied: "Tersalin",
    giftAddress: "Alamat pengiriman kado",
    holder: "a.n.",
  },
  footer: {
    coupleRole: "Sugeng Dhaup",
    thanks: "Atur nuwun",
    fin: "L ✽ P",
    by: "Dibuat dengan",
    brand: "Merriva",
  },
} as const;

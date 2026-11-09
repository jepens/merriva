/**
 * Label chrome tema Kirana (wedding adat Jawa modern, tier Story) — terpusat di
 * tema. SELURUHNYA Bahasa Indonesia (keputusan owner 5 Nov 2026: tanpa bahasa
 * daerah di semua undangan); identitas Jawa dibawa oleh VISUAL (gunungan,
 * wayang, truntum), bukan bahasa.
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
    eyebrow: "Assalamu'alaikum Wr. Wb.",
    titleTop: "Cinta yang tumbuh,",
    titleBottom: "restu yang",
    titleAccent: "bersemi.",
    lead: "Seperti bunga truntum yang selalu bersemi kembali, kami memohon doa restu untuk melangkah ke jenjang pernikahan.",
  },
  sekar: {
    caption: "Peribahasa",
  },
  couple: {
    eyebrow: "Kedua Mempelai",
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
    done: "Hari yang dinanti telah tiba ✽",
    days: "Hari",
    hours: "Jam",
    minutes: "Menit",
    seconds: "Detik",
  },
  schedule: {
    eyebrow: "Rangkaian Acara",
    maps: "Petunjuk Arah",
    calendar: "Simpan Kalender",
    calendarGoogle: "Google Kalender",
    calendarIcs: "Apple / Outlook",
    livestream: "Tonton Siaran Langsung",
  },
  gallery: { eyebrow: "Foto Moment", caption: "Foto" },
  video: { eyebrow: "Video Moment" },
  story: { eyebrow: "Perjalanan Cinta", heading: "Kisah Kami" },
  envelope: {
    eyebrow: "Tanda Kasih",
    heading: "Kirim Tanda Kasih",
    note: "Doa restu Bapak/Ibu adalah hadiah termulia. Bila berkenan berbagi tanda kasih, kami sampaikan terima kasih yang tak terhingga:",
    copy: "Salin",
    copied: "Tersalin",
    giftAddress: "Alamat pengiriman kado",
    holder: "a.n.",
  },
  footer: {
    coupleRole: "Selamat Berbahagia",
    thanks: "Terima kasih",
    fin: "✽",
    by: "Dibuat dengan",
    brand: "Merriva",
  },
} as const;

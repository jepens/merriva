/**
 * Label chrome tema Barakah (wedding islami elegan, tier Story). Standalone
 * (tak lagi bergantung ke WeddingLayout). Teks Bahasa Indonesia terpusat di sini.
 */
export const WRONG_CATEGORY = "Tema ini khusus untuk undangan pernikahan.";

export const L = {
  cover: {
    bismillah: "Bismillahirrahmanirrahim",
    open: "Buka Undangan",
    hint: "Geser untuk membaca",
  },
  hero: {
    eyebrow: "Assalamu'alaikum Warahmatullahi Wabarakatuh",
    headingLead: "Dua hati disatukan",
    headingConnector: "dalam",
    headingEmphasis: "satu barakah",
  },
  quote: { eyebrow: "Doa Keberkahan" },
  couple: {
    eyebrow: "Kedua Mempelai",
    groom: "Mempelai Pria",
    bride: "Mempelai Wanita",
    parents: (father?: string, mother?: string) => {
      const f = father?.trim();
      const m = mother?.trim();
      if (f && m) return `Putra/Putri dari Bpk. ${f} & Ibu ${m}`;
      if (f) return `Putra/Putri dari Bpk. ${f}`;
      if (m) return `Putra/Putri dari Ibu ${m}`;
      return "";
    },
  },
  countdown: {
    eyebrow: "Menuju Hari Bahagia",
    done: "Hari yang dinanti telah tiba",
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
  },
  gallery: { eyebrow: "Galeri", heading: "Momen Kami" },
  story: { eyebrow: "Perjalanan Kami", heading: "Kisah Menuju Barakah" },
  envelope: {
    eyebrow: "Hadiah & Tanda Kasih",
    heading: "Amplop Digital",
    note: "Doa restu Anda adalah karunia terindah. Bila berkenan berbagi kebahagiaan, dapat melalui:",
    copy: "Salin",
    copied: "Tersalin",
    giftAddress: "Alamat pengiriman kado",
    holder: "a.n.",
  },
  footer: {
    thanks: "Jazakumullah Khairan",
    by: "Dibuat dengan",
    brand: "Merriva",
  },
} as const;

/** Label chrome tema Lumina (universal, tier Craft, Indonesia). */
export const L = {
  cover: {
    open: "Buka Undangan",
    /** Baris puitis di cover, dipakai bila tak ada subtitle kategori. */
    invite: {
      wedding: "mengundang Anda pada hari\npernikahan kami yang sederhana",
      corporate: "mengundang Anda untuk hadir\ndi acara istimewa ini",
      family: "mengundang Anda untuk\nberbagi kebahagiaan ini",
    },
  },
  kicker: {
    wedding: "The Wedding Of",
    corporate: "Undangan Acara",
    family: "Undangan",
  },
  countdown: {
    eyebrow: "Hitung Mundur",
    done: "Hari ini",
    days: "Hari",
    hours: "Jam",
    minutes: "Menit",
    seconds: "Detik",
  },
  intro: { eyebrow: "Sebuah surat kecil" },
  principals: {
    wedding: "Kedua Mempelai",
    corporate: "Penyelenggara",
    family: "Yang Berbahagia",
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
    parentsFamily: "Putra/Putri dari",
    contact: "Narahubung",
  },
  timeline: {
    wedding: { eyebrow: "Cerita", heading: "Perjalanan Kami" },
    corporate: { eyebrow: "Rundown", heading: "Agenda Acara" },
    family: { eyebrow: "Doa & Harapan", heading: "Untaian Doa" },
  },
  schedule: {
    eyebrow: "Waktu & Tempat",
    heading: "Rangkaian Acara",
    maps: "Petunjuk Arah",
    calendar: "Simpan Kalender",
    calendarGoogle: "Google Kalender",
    calendarIcs: "Apple / Outlook",
  },
  gallery: { eyebrow: "Album", heading: "Momen" },
  envelope: {
    eyebrow: "Tanda Kasih",
    heading: "Amplop Digital",
    note: "Bila berkenan memberikan tanda kasih, dapat melalui kanal berikut.",
    copy: "Salin",
    copied: "Tersalin",
    giftAddress: "Alamat pengiriman",
    holder: "a.n.",
  },
  footer: { thanks: "Terima Kasih", by: "Dibuat dengan", brand: "Merriva" },
} as const;

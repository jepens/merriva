/** Label chrome tema eternal-rose (Indonesia) — terpusat di dalam tema. */
export const L = {
  hero: {
    eyebrow: "Undangan Pernikahan",
    scroll: "Gulir",
    title: "The Wedding",
    of: "of",
    hint: "Geser untuk membaca",
  },
  countdown: {
    eyebrow: "Menuju Hari Bahagia",
    done: "Hari yang dinanti telah tiba 🤍",
    days: "Hari",
    hours: "Jam",
    minutes: "Menit",
    seconds: "Detik",
  },
  couple: {
    eyebrow: "Mempelai",
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
  schedule: {
    eyebrow: "Rangkaian Acara",
    heading: "Waktu & Tempat",
    maps: "Lihat Lokasi",
    calendar: "Simpan ke Kalender",
    calendarGoogle: "Google Kalender",
    calendarIcs: "Apple / Outlook",
    livestream: "Tonton Siaran Langsung",
  },
  gallery: { eyebrow: "Galeri", heading: "Momen Kami" },
  video: { eyebrow: "Video", heading: "Kisah dalam Gerak" },
  story: { eyebrow: "Perjalanan Kami", heading: "Kisah Cinta" },
  envelope: {
    eyebrow: "Amplop Digital",
    heading: "Tanda Kasih",
    note: "Doa dan restu Anda adalah karunia terindah. Bila berkenan memberi tanda kasih, dapat melalui:",
    copy: "Salin Nomor",
    copied: "Tersalin",
    giftAddress: "Alamat pengiriman kado",
    holder: "a.n.",
  },
  footer: { thanks: "Terima Kasih", by: "Dibuat dengan", brand: "Merriva" },
} as const;

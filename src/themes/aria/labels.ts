/** Label chrome tema Aria (wedding minimalis galeri, tier Craft) — dalam tema. */
export const L = {
  wrongCategory: "Tema ini khusus untuk undangan pernikahan.",
  cover: {
    eyebrow: "Undangan Pernikahan",
    open: "Buka Undangan →",
    hint: "Geser untuk membaca",
  },
  sec: {
    opening: "Kata Pembuka",
    couple: "Mempelai",
    event: "Acara",
    gallery: "Galeri",
    video: "Video",
    story: "Kisah",
    rsvp: "Konfirmasi",
    gift: "Tanda Kasih",
  },
  couple: {
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
  event: {
    time: "Waktu",
    place: "Tempat",
    maps: "Petunjuk Arah",
    calendar: "Simpan Kalender",
    calendarGoogle: "Google Kalender",
    calendarIcs: "Apple / Outlook",
  },
  countdown: {
    done: "Hari ini",
    days: "Hari",
    hours: "Jam",
    minutes: "Menit",
    seconds: "Detik",
  },
  envelope: {
    note: "Kehadiran Anda adalah hadiah yang paling berarti. Bila berkenan memberi tanda kasih:",
    copy: "Salin",
    copied: "Tersalin",
    giftAddress: "Alamat pengiriman",
    holder: "a.n.",
  },
  footer: { by: "Dibuat dengan", brand: "Merriva" },
} as const;

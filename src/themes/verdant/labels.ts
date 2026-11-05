/** Label chrome tema Verdant (wedding botanikal ilustratif, tier Story). */
export const L = {
  cover: {
    eyebrow: "Undangan Pernikahan",
    open: "Buka Undangan",
    hint: "Geser untuk membaca",
  },
  hero: { eyebrow: "Dengan penuh syukur" },
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
    eyebrow: "Menanti Hari Bahagia",
    done: "Hari yang dinanti telah tiba 🌿",
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
  gallery: { eyebrow: "Herbarium Kami", heading: "Potongan Kenangan" },
  video: { eyebrow: "Video", heading: "Kenangan yang Tumbuh" },
  story: { eyebrow: "Kisah Bersemi", heading: "Perjalanan Kami" },
  envelope: {
    eyebrow: "Tanda Kasih",
    heading: "Amplop Digital",
    note: "Doa restu Anda bagai embun pagi. Bila berkenan memberi tanda kasih, dapat melalui:",
    copy: "Salin",
    copied: "Tersalin",
    giftAddress: "Alamat pengiriman kado",
    holder: "a.n.",
  },
  footer: { thanks: "Terima Kasih", by: "Dibuat dengan", brand: "Merriva" },
} as const;

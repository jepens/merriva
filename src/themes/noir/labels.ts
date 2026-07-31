/** Label chrome tema Noir (wedding sinematik, tier Story) — terpusat di tema. */
export const L = {
  cover: {
    presents: "Merriva Pictures mempersembahkan",
    tagline: "Sebuah kisah cinta",
    hint: "Gulir untuk memutar",
    open: "Putar Undangan",
  },
  hero: {
    eyebrow: "A Love Story",
    scene: "Scene 01 · Pembuka",
  },
  quote: { eyebrow: "Logline" },
  couple: {
    eyebrow: "Pemeran Utama",
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
    eyebrow: "Premiere in",
    done: "Tayang perdana telah tiba 🖤",
    days: "Hari",
    hours: "Jam",
    minutes: "Menit",
    seconds: "Detik",
  },
  schedule: {
    eyebrow: "Jadwal Tayang",
    scene: "Scene",
    maps: "Petunjuk Arah",
    calendar: "Simpan Kalender",
    calendarGoogle: "Google Kalender",
    calendarIcs: "Apple / Outlook",
  },
  gallery: { eyebrow: "Behind the Scenes", heading: "Cuplikan Adegan" },
  story: { eyebrow: "Naskah", heading: "Sinopsis Kami" },
  envelope: {
    eyebrow: "Wedding Gift",
    heading: "Tanda Kasih",
    note: "Kehadiran Anda adalah hadiah terbaik. Bila ingin turut berbagi kebahagiaan, silakan melalui:",
    copy: "Salin",
    copied: "Tersalin",
    giftAddress: "Alamat pengiriman kado",
    holder: "a.n.",
  },
  footer: {
    credits: "Credits",
    coupleRole: "Mempelai",
    fin: "— fin —",
    thanks: "Terima Kasih",
    by: "Diproduksi dengan",
    brand: "Merriva",
  },
} as const;

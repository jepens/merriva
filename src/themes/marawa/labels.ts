/**
 * Label chrome tema Marawa (wedding adat Minang, tier Story, dark) — terpusat
 * di tema. Bahasa Indonesia dengan istilah Minang dari prototipe
 * `prototypes/marawa-story.html`. Budaya (THEME-WAVE3 §3.2): pepatah dikutip
 * utuh; urutan pita marawa hitam–merah–kuning tidak diubah.
 */
export const L = {
  cover: {
    eyebrow: "Undangan Pernikahan",
    recipient: "Kepada Yth. Bapak/Ibu/Saudara/i",
    recipientFallback: "Tamu Undangan",
    open: "Buka Undangan",
    hint: "Gulir setelah terbuka",
    jo: "&",
  },
  hero: {
    eyebrow: "Assalamu'alaikum Warahmatullahi Wabarakatuh",
    lead: "Dengan memohon rahmat Allah ﷻ serta restu keluarga besar, kami bermaksud melangsungkan pernikahan.",
  },
  quote: {
    fallbackText: "Adat bersendikan syariat, syariat bersendikan Kitabullah.",
    fallbackSource: "Falsafah Minangkabau",
    caption: "Falsafah Minangkabau",
  },
  couple: {
    eyebrow: "Mempelai",
    heading: "Niat Baik Dua Keluarga",
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
    eyebrow: "Menanti Hari Bahagia",
    done: "Hari yang dinanti telah tiba — alhamdulillah",
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
  gallery: { eyebrow: "Galeri", heading: "Potret Berdua", caption: "Foto" },
  video: { eyebrow: "Video", heading: "Cuplikan Berdua" },
  story: { eyebrow: "Kisah", heading: "Dari Rantau ke Pelaminan" },
  envelope: {
    eyebrow: "Tanda Kasih",
    heading: "Kirim Hadiah",
    note: "Kehadiran dan doa adalah yang utama. Bila hendak berbagi tanda kasih:",
    copy: "Salin",
    copied: "Tersalin",
    giftAddress: "Alamat pengiriman kado",
    holder: "a.n.",
  },
  footer: {
    eyebrow: "Terima Kasih",
    thanks:
      "Segala kehadiran dan doa restu Bapak/Ibu adalah kehormatan bagi keluarga kami. Wassalamu'alaikum warahmatullahi wabarakatuh.",
    by: "Dibuat dengan",
    brand: "Merriva",
  },
} as const;

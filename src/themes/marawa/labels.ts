/**
 * Label chrome tema Marawa (wedding adat Minang, tier Story, dark) — terpusat
 * di tema. Bahasa Indonesia dengan istilah Minang dari prototipe
 * `prototypes/marawa-story.html`. Budaya (THEME-WAVE3 §3.2): pepatah dikutip
 * utuh; urutan pita marawa hitam–merah–kuning tidak diubah.
 */
export const L = {
  cover: {
    eyebrow: "Baralek Gadang",
    recipient: "Kapado Bapak/Ibu/Sanak Saudara",
    recipientFallback: "Tamu Undangan",
    open: "Buka Undangan",
    hint: "Gulir satalah tabuka",
    jo: "jo",
  },
  hero: {
    eyebrow: "Assalamu'alaikum Warahmatullahi Wabarakatuh",
    lead: "Dengan memohon rahmat Allah ﷻ serta restu niniak mamak dan keluarga, kami bermaksud melangsungkan pernikahan.",
  },
  quote: {
    fallbackText: "Adat basandi syarak, syarak basandi Kitabullah.",
    fallbackSource: "Pepatah Minang",
    caption: "Pepatah Minang",
  },
  couple: {
    eyebrow: "Mempelai",
    heading: "Niat Baik Duo Kaluarga",
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
    eyebrow: "Manantikan Hari",
    done: "Hari nan dinanti lah tibo — alhamdulillah",
    days: "Hari",
    hours: "Jam",
    minutes: "Menit",
    seconds: "Detik",
  },
  schedule: {
    eyebrow: "Rangkaian Acara",
    heading: "Alek Nan Dinanti",
    maps: "Petunjuk Lokasi",
    calendar: "Simpan Kalender",
    calendarGoogle: "Google Kalender",
    calendarIcs: "Apple / Outlook",
    livestream: "Tonton Siaran Langsung",
  },
  gallery: { eyebrow: "Galeri", heading: "Potret Baduo", caption: "Foto" },
  video: { eyebrow: "Video", heading: "Cuplikan Berdua" },
  story: { eyebrow: "Kisah", heading: "Dari Rantau ka Pelaminan" },
  envelope: {
    eyebrow: "Tando Kasih",
    heading: "Kirim Hadiah",
    note: "Kehadiran dan doa adalah yang utama. Bila hendak berbagi tanda kasih:",
    copy: "Salin",
    copied: "Tersalin",
    giftAddress: "Alamat pengiriman kado",
    holder: "a.n.",
  },
  footer: {
    eyebrow: "Tarimo Kasih",
    thanks:
      "Sagalo kehadiran jo doa restu Bapak/Ibu adolah kehormatan bagi kaluargo kami. Wassalamu'alaikum warahmatullahi wabarakatuh.",
    by: "Dibuat dengan",
    brand: "Merriva",
  },
} as const;

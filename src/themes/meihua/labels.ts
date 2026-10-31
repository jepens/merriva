/**
 * Label chrome tema Meihua (wedding Tionghoa, tier Story) — terpusat di tema.
 * Dari prototipe `prototypes/meihua-story.html`. Budaya (THEME-WAVE3 §3.4):
 * 囍 selalu utuh; amplop bernama "Angpao Digital".
 */
export const L = {
  cover: {
    eyebrow: "The Wedding Celebration",
    recipient: "Kepada Yth. Bapak/Ibu/Saudara/i",
    recipientFallback: "Tamu Undangan",
    open: "Buka Undangan",
    hint: "Gulir setelah terbuka",
  },
  hero: {
    eyebrow: "Shuāng Xǐ · Kebahagiaan Berganda",
    lead: "Bersama kedua keluarga besar, kami mengundang Anda menjadi saksi kebahagiaan kami.",
  },
  quote: {
    fallbackText: "Dua hati, dua keluarga — satu kebahagiaan yang berganda.",
    fallbackSource: "Makna Shuāng Xǐ",
    caption: "Shuāng Xǐ · Kebahagiaan Berganda",
  },
  couple: {
    eyebrow: "Mempelai",
    heading: "Dengan Restu Keluarga",
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
    done: "Hari bahagia itu telah tiba ✦",
    days: "Hari",
    hours: "Jam",
    minutes: "Menit",
    seconds: "Detik",
  },
  schedule: {
    eyebrow: "Rangkaian Acara",
    heading: "Save The Dates",
    maps: "Petunjuk Lokasi",
    calendar: "Simpan Kalender",
    calendarGoogle: "Google Kalender",
    calendarIcs: "Apple / Outlook",
  },
  gallery: { eyebrow: "Galeri", heading: "Momen Berdua", caption: "Foto" },
  story: { eyebrow: "Kisah", heading: "Perjalanan Kami" },
  envelope: {
    eyebrow: "Tanda Kasih",
    heading: "Angpao Digital",
    note: "Kehadiran Anda adalah berkat bagi kami. Bagi yang ingin mengirim angpao secara digital:",
    copy: "Salin",
    copied: "Tersalin",
    giftAddress: "Alamat pengiriman hadiah",
    holder: "a.n.",
  },
  footer: {
    eyebrow: "Terima Kasih",
    thanks:
      "Merupakan kehormatan bagi kami dan keluarga apabila Anda berkenan hadir serta memberikan doa restu.",
    by: "Dibuat dengan",
    brand: "Merriva",
  },
} as const;

/**
 * Label chrome tema Sakinah (wedding syar'i tanpa foto, tier Craft) — terpusat
 * di tema. Bahasa Indonesia khidmat; teks Arab disalin PERSIS dari prototipe
 * `prototypes/sakinah-craft.html` (sudah diperiksa) — jangan "dirapikan".
 */
export const L = {
  cover: {
    bismillah: "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ",
    eyebrow: "Walimatul 'Ursy",
    recipient: "Kepada Yth. Bapak/Ibu/Saudara/i",
    recipientFallback: "Tamu Undangan",
    open: "Buka Undangan",
  },
  hero: {
    eyebrow: "Undangan Pernikahan",
    lead: "Dengan memohon rahmat dan ridha Allah ﷻ, kami bermaksud menyelenggarakan pernikahan putra-putri kami.",
  },
  quote: {
    ar: "وَمِنْ اٰيٰتِهٖٓ اَنْ خَلَقَ لَكُمْ مِّنْ اَنْفُسِكُمْ اَزْوَاجًا لِّتَسْكُنُوْٓا اِلَيْهَا وَجَعَلَ بَيْنَكُمْ مَّوَدَّةً وَّرَحْمَةً",
    fallbackText:
      "Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan pasangan-pasangan untukmu dari jenismu sendiri, agar kamu merasa tenteram kepadanya, dan Dia menjadikan di antaramu rasa kasih dan sayang.",
    fallbackSource: "QS. Ar-Rūm : 21",
    caption: "Kalam Ilahi",
  },
  couple: {
    eyebrow: "Mempelai",
    heading: "Dua Hati, Satu Tujuan",
    bride: "Mempelai Wanita",
    groom: "Mempelai Pria",
    and: "wa",
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
    done: "Hari yang dinanti telah tiba — alhamdulillah",
    days: "Hari",
    hours: "Jam",
    minutes: "Menit",
    seconds: "Detik",
  },
  schedule: {
    eyebrow: "Rangkaian Acara",
    heading: "InsyaAllah Diselenggarakan",
    maps: "Petunjuk Lokasi",
    calendar: "Simpan Kalender",
    calendarGoogle: "Google Kalender",
    calendarIcs: "Apple / Outlook",
  },
  doa: {
    eyebrow: "Doa",
    heading: "Doa untuk Kedua Mempelai",
    ar: "بَارَكَ اللّٰهُ لَكَ وَبَارَكَ عَلَيْكَ وَجَمَعَ بَيْنَكُمَا فِي خَيْرٍ",
    id: "“Semoga Allah memberkahimu di waktu bahagia dan menyatukan kalian berdua dalam kebaikan.”",
    source: "HR. Abu Dawud",
    note: "Sebagai pengganti galeri foto, kami memohon doa terbaik dari Bapak/Ibu untuk keberkahan rumah tangga kami.",
  },
  envelope: {
    eyebrow: "Tanda Kasih",
    heading: "Kirim Hadiah",
    note: "Tanpa mengurangi rasa hormat, bagi yang ingin berbagi kebahagiaan secara cashless:",
    copy: "Salin",
    copied: "Tersalin",
    giftAddress: "Alamat pengiriman kado",
    holder: "a.n.",
  },
  footer: {
    salam: "وَالسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللّٰهِ وَبَرَكَاتُهُ",
    thanksLead:
      "Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu.",
    by: "Dibuat dengan",
    brand: "Merriva",
  },
} as const;

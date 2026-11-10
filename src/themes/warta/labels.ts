/**
 * Teks tetap tema `warta` (koran retro) — terpusat supaya tak tercecer di JSX.
 *
 * Bahasa (keputusan pemilik 10 Nov 2026, DECISIONS #123): KOP & JUDUL dekoratif
 * ala koran berbahasa Inggris ("The Wedding Post", "Hot News!", "Meet the
 * Bride") — itu rupa temanya. Semua yang INFORMATIF tetap Bahasa Indonesia
 * (#118): tanggal, jam, label hitung mundur, tombol, instruksi, kalimat
 * pengantar, dan fallback. Jangan menerjemahkan arah sebaliknya.
 */
export const L = {
  masthead: "The Wedding Post",
  edition: "Vol. I · No. 1",
  free: "Free Copy",
  cover: {
    headline: (a: string, b: string) => `${a} & ${b} are getting married!`,
    saveTheDate: "Save the Date",
    caption: "Foto: arsip keluarga.",
    continued: (page: number) => `Continued on page ${page}`,
    recipient: "Kepada Yth.",
    recipientFallback: "Bapak/Ibu/Saudara/i",
    open: "Baca Selengkapnya",
  },
  // Rubrik folio "Page N · News"; kata "Page" + nomornya CSS counter di
  // warta.css (`.wt-folio__n::before`) — ikut urutan & visibilitas section.
  folio: {
    hero: "News",
    couple: "Couple",
    story: "Feature",
    countdown: "Diary",
    schedule: "Classified",
    video: "Cinema",
    rsvp: "Reply",
    gallery: "Archive",
  },
  hero: {
    kicker: "Hot News!",
    headline: "The Happy Couple Invites You",
    reported: (city: string | null) =>
      city ? `Reported from ${city} · by the family` : "Reported by the family",
    lead: "Dengan memohon rahmat dan ridha Tuhan Yang Maha Esa, kami bermaksud menyelenggarakan resepsi pernikahan kami. Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu kepada kedua mempelai.",
    // Tanpa "—": tanda pisahnya dirender terpisah dengan font isi (glyph em
    // dash Special Elite bergelombang "⁓-", lihat sections.tsx).
    byline: (city: string | null) =>
      city ? `Redaksi keluarga, ${city}` : "Redaksi keluarga",
  },
  couple: {
    bride: "Meet the Bride",
    groom: "Meet the Groom",
    brideCaption: "Mempelai wanita",
    groomCaption: "Mempelai pria",
    childOf: (childOrder: string | undefined, fallback: string) =>
      `${childOrder?.trim() || fallback} dari`,
    daughter: "Putri",
    son: "Putra",
    parents: (father?: string, mother?: string) => {
      const f = father?.trim();
      const m = mother?.trim();
      if (f && m) return `Bapak ${f} & Ibu ${m}`;
      if (f) return `Bapak ${f}`;
      if (m) return `Ibu ${m}`;
      return "";
    },
  },
  story: {
    heading: "Our Love Story",
    eyebrow: "As told by the happy couple",
  },
  countdown: {
    eyebrow: "Mark your calendar",
    heading: "Save the Date",
    sub: "And celebrate with us!",
    stamp: (numeric: string) => `Don't miss it! · ${numeric}`,
    band: "Counting Down",
    weekdays: ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"],
    months: [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ],
    calendarLabel: (month: string, year: number, day: number) =>
      `Kalender ${month} ${year}, tanggal ${day} ditandai sebagai hari acara`,
    days: "Hari",
    hours: "Jam",
    minutes: "Menit",
    seconds: "Detik",
    done: "Hari bahagia telah tiba",
  },
  schedule: {
    heading: "Wedding Event",
    announcements: (n: number, sameDay: boolean) => {
      const words = ["One", "Two", "Three", "Four", "Five", "Six"];
      const count = words[n - 1] ?? String(n);
      const noun = n === 1 ? "announcement" : "announcements";
      return sameDay && n > 1
        ? `${count} ${noun}, one day`
        : `${count} ${noun}`;
    },
    time: (start: string, end: string | null, tz: string) =>
      end ? `Pukul ${start} – ${end} ${tz}` : `Pukul ${start} ${tz} – selesai`,
    maps: "Petunjuk Lokasi",
    calendar: "Simpan Kalender",
    calendarGoogle: "Google Kalender",
    calendarIcs: "Apple / Outlook",
    livestream: "Tonton Siaran Langsung",
  },
  video: { heading: "On Screen", eyebrow: "Now showing" },
  rsvp: {
    eyebrow: "Kindly reply",
    heading: "RSVP",
    lead: "Mohon konfirmasi kehadiran Anda agar kami dapat menyiapkan tempat dengan sebaik-baiknya.",
  },
  gallery: {
    heading: "Precious Moment",
    caption: "Dari arsip redaksi keluarga.",
  },
  envelope: {
    clip: "✂ Clip this coupon",
    heading: "Wedding Gift",
    note: "Doa restu Anda adalah hadiah terindah bagi kami. Namun bila memberi adalah cara Anda menunjukkan kasih, Anda dapat mengirimkannya secara cashless.",
    tabTransfer: "Transfer Langsung",
    tabGift: "Kirim Kado",
    transferLead: "Transfer langsung ke rekening berikut:",
    giftLead: "Kirim kado ke alamat berikut:",
    copy: "Salin",
    copied: "Tersalin",
    holder: "a.n.",
  },
  footer: {
    eyebrow: "Thank you for reading",
    thanks:
      "Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Anda berkenan hadir dan memberikan doa restu.",
    motto: "All the love that's fit to print",
    printed: (city: string | null) =>
      city ? `Printed in ${city} · Vol. I No. 1` : "Vol. I No. 1",
    by: "Dibuat dengan",
    brand: "Merriva",
  },
} as const;

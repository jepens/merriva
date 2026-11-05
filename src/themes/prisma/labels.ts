/**
 * Label chrome tema Prisma (corporate, Indonesia) — terpusat di dalam tema.
 * Voice korporat/eksperimental: ringkas, kapital, aksen mono.
 */
export const L = {
  cover: {
    /** "{organizer} mempersembahkan" — bila organizer diisi. */
    presents: "mempersembahkan",
    recipient: "Undangan untuk",
    recipientFallback: "Tim & Karyawan",
    enter: "Masuk",
    hint: "Geser untuk menelusuri",
  },
  /** Label mono index tiap section (mengikuti prototipe: Intro/Rundown/…). */
  sec: {
    intro: "Intro",
    rundown: "Rundown",
    countdown: "Countdown",
    gallery: "Galeri",
    video: "Video",
    rsvp: "RSVP",
    envelope: "Tanda Kasih",
  },
  intro: {
    /** Judul besar fallback bila tak ada kutipan. */
    fallbackHead: "Satu momen, satu tim.",
  },
  stats: {
    sessions: "Sesi",
    moments: "Momen",
    locations: "Lokasi",
  },
  countdown: {
    days: "Hari",
    hours: "Jam",
    minutes: "Menit",
    seconds: "Detik",
    done: "Acara telah berlangsung 🎉",
  },
  location: {
    time: "Waktu",
    maps: "Petunjuk Arah",
    calendar: "Simpan Kalender",
    calendarGoogle: "Google Kalender",
    calendarIcs: "Apple / Outlook",
    livestream: "Tonton Siaran Langsung",
  },
  rsvp: {
    admit: "Admit One",
    gate: "GATE A",
    ticketNo: "NO.",
  },
  envelope: {
    heading: "Tanda Kasih",
    note: "Bila berkenan mengirim tanda kasih untuk acara, dapat melalui kanal berikut.",
    copy: "Salin",
    copied: "Tersalin",
    holder: "a.n.",
    giftAddress: "Alamat pengiriman",
  },
  footer: {
    contact: "Pertanyaan? Hubungi panitia divisi masing-masing.",
    by: "Powered by",
    brand: "Merriva",
  },
  wrongCategory: "Tema ini khusus untuk acara korporat.",
} as const;

import type { WeddingLabels } from "@/themes/_shared/wedding-sections";

export const WRONG_CATEGORY = "Tema ini khusus untuk undangan pernikahan.";

/** Label chrome tema Aria (wedding minimalis). */
export const L: WeddingLabels = {
  hero: { eyebrow: "The Wedding Of", scroll: "Scroll" },
  countdown: {
    eyebrow: "Menghitung Hari",
    done: "Hari ini",
    days: "Hari",
    hours: "Jam",
    minutes: "Menit",
    seconds: "Detik",
  },
  couple: {
    eyebrow: "Mempelai",
    groom: "Pria",
    bride: "Wanita",
    parents: (father, mother) => {
      const f = father?.trim();
      const m = mother?.trim();
      if (f && m) return `Putra/Putri dari Bpk. ${f} & Ibu ${m}`;
      if (f) return `Putra/Putri dari Bpk. ${f}`;
      if (m) return `Putra/Putri dari Ibu ${m}`;
      return "";
    },
  },
  schedule: {
    eyebrow: "Acara",
    heading: "Waktu & Tempat",
    maps: "Lihat Lokasi",
    calendar: "Simpan ke Kalender",
    calendarGoogle: "Google Kalender",
    calendarIcs: "Apple / Outlook",
  },
  gallery: { eyebrow: "Galeri", heading: "Momen" },
  story: { eyebrow: "Cerita", heading: "Perjalanan Kami" },
  envelope: {
    eyebrow: "Hadiah",
    heading: "Tanda Kasih",
    note: "Bila berkenan memberikan tanda kasih, dapat melalui kanal berikut.",
    copy: "Salin",
    copied: "Tersalin",
    giftAddress: "Alamat pengiriman",
    holder: "a.n.",
  },
  footer: { thanks: "Terima Kasih", by: "Dibuat dengan", brand: "Merriva" },
};

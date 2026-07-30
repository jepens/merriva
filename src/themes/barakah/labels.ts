import type { WeddingLabels } from "@/themes/_shared/wedding-sections";

export const WRONG_CATEGORY = "Tema ini khusus untuk undangan pernikahan.";

/** Label chrome tema Barakah (wedding islami, Indonesia). */
export const L: WeddingLabels = {
  hero: { eyebrow: "Walimatul 'Urs", scroll: "Gulir" },
  countdown: {
    eyebrow: "Menuju Hari Bahagia",
    done: "Hari yang dinanti telah tiba",
    days: "Hari",
    hours: "Jam",
    minutes: "Menit",
    seconds: "Detik",
  },
  couple: {
    eyebrow: "Kedua Mempelai",
    groom: "Mempelai Pria",
    bride: "Mempelai Wanita",
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
    eyebrow: "Rangkaian Acara",
    heading: "Waktu & Tempat",
    maps: "Lihat Lokasi",
    calendar: "Simpan ke Kalender",
    calendarGoogle: "Google Kalender",
    calendarIcs: "Apple / Outlook",
  },
  gallery: { eyebrow: "Galeri", heading: "Momen Kami" },
  story: { eyebrow: "Perjalanan Kami", heading: "Kisah Cinta" },
  envelope: {
    eyebrow: "Hadiah",
    heading: "Tanda Kasih",
    note: "Doa restu Anda adalah karunia terindah. Bila berkenan memberi tanda kasih, dapat melalui:",
    copy: "Salin Nomor",
    copied: "Tersalin",
    giftAddress: "Alamat pengiriman kado",
    holder: "a.n.",
  },
  footer: {
    thanks: "Jazakumullah Khairan",
    by: "Dibuat dengan",
    brand: "Merriva",
  },
};

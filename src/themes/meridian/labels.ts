/** Label chrome tema Meridian (wedding Art Deco gala, tier Story) — terpusat. */
export const L = {
  wrongCategory: "Tema ini khusus untuk undangan pernikahan.",
  cover: {
    eyebrow: "The Wedding Gala of",
    open: "Buka Undangan",
    hint: "Ketuk untuk membuka",
  },
  intro: {
    eyebrow: "Sebuah Perayaan",
    titleA: "Malam emas,",
    titleB: "janji abadi.",
    lead: "Dengan hormat, kami mengundang Anda menghadiri malam pernikahan kami — sebuah gala kecil untuk orang-orang yang paling kami sayangi.",
  },
  couple: {
    eyebrow: "Kedua Mempelai",
    bride: "The Bride",
    groom: "The Groom",
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
    eyebrow: "Counting Down",
    done: "Hari bahagia telah tiba 🥂",
    days: "Hari",
    hours: "Jam",
    minutes: "Menit",
    seconds: "Detik",
  },
  programme: {
    eyebrow: "Programme",
    maps: "Petunjuk Arah",
    calendar: "Simpan Kalender",
    calendarGoogle: "Google Kalender",
    calendarIcs: "Apple / Outlook",
    /** Angka romawi untuk indeks acara (I., II., III. …). */
    roman: (n: number) =>
      ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][n] ??
      String(n + 1),
  },
  gallery: { eyebrow: "Moments", caption: "Foto" },
  rsvp: { eyebrow: "RSVP" },
  gift: {
    eyebrow: "Wedding Gift",
    note: "Kehadiran Anda adalah kehormatan tertinggi. Bila berkenan memberi tanda kasih:",
    holder: "a.n.",
    address: "Alamat pengiriman kado",
    copy: "Salin",
    copied: "Tersalin",
  },
  footer: {
    by: "Crafted with",
    brand: "Merriva",
  },
} as const;

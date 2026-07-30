import type { InvitationData } from "@/types/invitation";

/** Data contoh pratinjau tema Noir (wedding dark-luxe) — mandiri (SVG data-URI). */
function swatch(from: string, to: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='800'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='800' height='800' fill='url(#g)'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
const photo = (from: string, to: string) => ({
  url: swatch(from, to),
  thumbUrl: swatch(from, to),
  width: 800,
  height: 800,
});

export const demoInvitationData: InvitationData = {
  slug: "demo",
  category: "wedding",
  eventDate: "2027-01-23",
  content: {
    category: "wedding",
    title: "Nadira & Arka",
    groom: {
      name: "Arka Dewangga",
      nickname: "Arka",
      fatherName: "Surya Dewangga",
      motherName: "Ratih Purnama",
      childOrder: "Putra kedua",
    },
    bride: {
      name: "Nadira Salsabila",
      nickname: "Nadira",
      fatherName: "Firman Hidayat",
      motherName: "Ayu Lestari",
      childOrder: "Putri pertama",
    },
    story: [
      {
        title: "Pertemuan",
        date: "Desember 2019",
        narrative:
          "Di bawah gemerlap lampu sebuah gala, dua pandangan bertemu dan enggan berpaling.",
      },
      {
        title: "Komitmen",
        date: "Februari 2022",
        narrative:
          "Sebuah janji diucapkan di tepi pantai saat senja, menandai babak baru.",
      },
      {
        title: "Lamaran",
        date: "Oktober 2026",
        narrative:
          "Di hadapan keluarga, cincin disematkan sebagai simbol keseriusan.",
      },
    ],
    greetingOpen:
      "Dengan penuh sukacita, kami mengundang Anda untuk merayakan malam istimewa pernikahan kami.",
    greetingClose:
      "Sebuah kehormatan bagi kami atas kehadiran dan restu yang Anda berikan.",
    quote: {
      text: "Dalam setiap cahaya, aku menemukan bayanganmu; dalam setiap malam, aku menemukan rumah.",
      source: "Untuk Nadira & Arka",
    },
    envelope: {
      enabled: true,
      banks: [
        { bank: "BNI", number: "0456789123", holder: "Nadira Salsabila" },
      ],
      ewallets: [
        { provider: "ShopeePay", number: "081244556677", holder: "Arka D." },
      ],
      giftAddress: "The Residence Tower, Jl. Sudirman No. 1, Jakarta Pusat",
    },
  },
  settings: {
    timezone: "Asia/Jakarta",
    sections: {},
    moderateGuestbook: false,
  },
  events: [
    {
      id: "demo-akad",
      name: "Pemberkatan",
      startAt: "2027-01-23T09:00:00.000Z", // 16.00 WIB
      endAt: "2027-01-23T10:00:00.000Z",
      venueName: "The Grand Ballroom",
      address: "Hotel Mulia, Jl. Asia Afrika, Senayan, Jakarta",
      mapsUrl: "https://maps.google.com/?q=-6.22,106.80",
    },
    {
      id: "demo-resepsi",
      name: "Gala Reception",
      startAt: "2027-01-23T12:00:00.000Z", // 19.00 WIB
      endAt: "2027-01-23T15:00:00.000Z",
      venueName: "The Grand Ballroom",
      address: "Hotel Mulia, Jl. Asia Afrika, Senayan, Jakarta",
      mapsUrl: "https://maps.google.com/?q=-6.22,106.80",
    },
  ],
  media: [
    photo("#14110f", "#1d1916"),
    photo("#c9a86a", "#8a6f3e"),
    photo("#1d1916", "#c9a86a"),
    photo("#3a332b", "#14110f"),
    photo("#e2ca92", "#c9a86a"),
    photo("#14110f", "#3a332b"),
  ].map((p, i) => ({ id: `demo-m${i}`, ...p })),
  music: null,
  watermark: true,
};

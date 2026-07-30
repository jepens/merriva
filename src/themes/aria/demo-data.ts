import type { InvitationData } from "@/types/invitation";

/** Data contoh pratinjau tema Aria (wedding minimalis) — mandiri (SVG data-URI). */
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
  eventDate: "2026-12-05",
  content: {
    category: "wedding",
    title: "Alina & Reza",
    groom: {
      name: "Reza Mahendra",
      nickname: "Reza",
      childOrder: "Putra pertama",
    },
    bride: {
      name: "Alina Prameswari",
      nickname: "Alina",
      childOrder: "Putri kedua",
    },
    story: [
      {
        title: "Awal",
        date: "2021",
        narrative:
          "Dua orang asing di kota yang sama, dipertemukan tanpa sengaja.",
      },
      {
        title: "Tumbuh",
        date: "2023",
        narrative:
          "Perjalanan, tawa, dan diam yang nyaman — kami memilih untuk terus bersama.",
      },
      {
        title: "Kini",
        date: "2026",
        narrative:
          "Satu janji, satu langkah baru. Terima kasih telah menjadi saksi.",
      },
    ],
    greetingOpen:
      "Dengan penuh syukur, kami mengundang Anda untuk berbagi kebahagiaan di hari pernikahan kami.",
    greetingClose:
      "Kehadiran dan doa Anda adalah hadiah terindah bagi kami berdua.",
    quote: {
      text: "Cinta bukan menatap satu sama lain, melainkan menatap ke arah yang sama.",
      source: "Antoine de Saint-Exupéry",
    },
    envelope: {
      enabled: true,
      banks: [
        { bank: "BCA", number: "8210345678", holder: "Alina Prameswari" },
      ],
      ewallets: [
        { provider: "OVO", number: "081377889900", holder: "Reza M." },
      ],
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
      name: "Akad",
      startAt: "2026-12-05T03:00:00.000Z", // 10.00 WIB
      endAt: "2026-12-05T04:00:00.000Z",
      venueName: "The Glasshouse",
      address: "Jl. Senopati No. 10, Kebayoran Baru, Jakarta Selatan",
      mapsUrl: "https://maps.google.com/?q=-6.24,106.81",
    },
    {
      id: "demo-resepsi",
      name: "Resepsi",
      startAt: "2026-12-05T11:00:00.000Z", // 18.00 WIB
      endAt: "2026-12-05T14:00:00.000Z",
      venueName: "The Glasshouse Rooftop",
      address: "Jl. Senopati No. 10, Kebayoran Baru, Jakarta Selatan",
      mapsUrl: "https://maps.google.com/?q=-6.24,106.81",
    },
  ],
  media: [
    photo("#e0dcd2", "#8a8478"),
    photo("#f6f5f1", "#c9c3b6"),
    photo("#1b1a17", "#8a8478"),
    photo("#efece4", "#b7b1a2"),
    photo("#c9c3b6", "#6f6a5f"),
    photo("#e0dcd2", "#1b1a17"),
  ].map((p, i) => ({ id: `demo-m${i}`, ...p })),
  music: null,
  watermark: true,
};

import type { InvitationData } from "@/types/invitation";

/** Data contoh pratinjau tema Verdant (wedding botanikal) — mandiri (SVG data-URI). */
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
  eventDate: "2027-04-18",
  content: {
    category: "wedding",
    title: "Sekar & Damar",
    groom: {
      name: "Damar Wicaksono",
      nickname: "Damar",
      fatherName: "Bambang Wicaksono",
      motherName: "Retno Wulandari",
      childOrder: "Putra pertama",
    },
    bride: {
      name: "Sekar Ayu Melati",
      nickname: "Sekar",
      fatherName: "Joko Prasetyo",
      motherName: "Endah Kusuma",
      childOrder: "Putri bungsu",
    },
    story: [
      {
        title: "Menanam Benih",
        date: "Musim Hujan 2020",
        narrative:
          "Bertemu di sebuah kelas berkebun, dua tangan yang gemar menyentuh tanah dan tumbuhan.",
      },
      {
        title: "Bertumbuh",
        date: "Musim Kemarau 2023",
        narrative:
          "Merawat mimpi bersama, seperti merawat taman — sabar, telaten, penuh cinta.",
      },
      {
        title: "Mekar",
        date: "Musim Semi 2027",
        narrative:
          "Kini bunga itu mekar sempurna, dan kami siap berbagi harinya.",
      },
    ],
    greetingOpen:
      "Bagai taman yang bersemi, kami merajut kasih dan bermaksud menyatukannya dalam ikatan pernikahan.",
    greetingClose:
      "Kehadiran dan doa Anda akan menjadi pupuk terindah bagi rumah tangga kami.",
    quote: {
      text: "Tumbuh bersama adalah bentuk cinta yang paling sabar.",
      source: "Untuk Sekar & Damar",
    },
    envelope: {
      enabled: true,
      banks: [
        {
          bank: "Mandiri",
          number: "1300088776655",
          holder: "Sekar Ayu Melati",
        },
      ],
      ewallets: [
        { provider: "DANA", number: "081355667788", holder: "Damar W." },
      ],
      giftAddress: "Jl. Kaliurang KM 12, Sleman, Yogyakarta",
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
      name: "Akad Nikah",
      startAt: "2027-04-18T02:00:00.000Z", // 09.00 WIB
      endAt: "2027-04-18T03:00:00.000Z",
      venueName: "Kebun Raya Taman Sari",
      address: "Jl. Kaliurang KM 12, Sleman, Yogyakarta",
      mapsUrl: "https://maps.google.com/?q=-7.68,110.41",
    },
    {
      id: "demo-resepsi",
      name: "Resepsi Taman",
      startAt: "2027-04-18T05:00:00.000Z", // 12.00 WIB
      endAt: "2027-04-18T08:00:00.000Z",
      venueName: "Greenhouse Taman Sari",
      address: "Jl. Kaliurang KM 12, Sleman, Yogyakarta",
      mapsUrl: "https://maps.google.com/?q=-7.68,110.41",
    },
  ],
  media: [
    photo("#46583a", "#5d7049"),
    photo("#869a6a", "#46583a"),
    photo("#bd8368", "#869a6a"),
    photo("#eae5d3", "#869a6a"),
    photo("#5d7049", "#3b402f"),
    photo("#f5f2e7", "#bd8368"),
  ].map((p, i) => ({ id: `demo-m${i}`, ...p })),
  music: null,
  watermark: true,
};

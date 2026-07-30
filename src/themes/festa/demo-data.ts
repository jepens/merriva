import type { InvitationData } from "@/types/invitation";

/** Data contoh pratinjau tema Festa (family) — mandiri (SVG data-URI). */
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
  category: "family",
  eventDate: "2026-09-20",
  content: {
    category: "family",
    eventName: "Syukuran Khitan Rafa",
    celebrant: "Muhammad Rafa Alfarizqi",
    parents: "Bpk. Andi Saputra & Ibu Dina Marlina",
    wishes: [
      {
        title: "Semoga Menjadi Anak Saleh",
        date: "Dari Kakek & Nenek",
        narrative:
          "Semoga Rafa tumbuh menjadi anak yang saleh, sehat, dan membanggakan keluarga.",
      },
      {
        title: "Berani & Tangguh",
        date: "Dari Om & Tante",
        narrative:
          "Selamat ya Rafa, kamu hebat dan berani! Semoga selalu ceria dan sehat selalu.",
      },
    ],
    greetingOpen:
      "Dengan penuh rasa syukur, kami mengundang Bapak/Ibu/Saudara/i untuk hadir dalam acara syukuran khitan putra kami.",
    greetingClose:
      "Atas kehadiran dan doa restunya, kami sekeluarga mengucapkan terima kasih.",
    quote: {
      text: "Setiap anak lahir membawa harapan dan kebahagiaan bagi keluarga.",
      source: "Keluarga Saputra",
    },
    envelope: {
      enabled: true,
      banks: [{ bank: "BRI", number: "339801020304", holder: "Dina Marlina" }],
      ewallets: [],
    },
  },
  settings: {
    timezone: "Asia/Jakarta",
    sections: {},
    moderateGuestbook: false,
  },
  events: [
    {
      id: "demo-acara",
      name: "Syukuran",
      startAt: "2026-09-20T03:00:00.000Z", // 10.00 WIB
      endAt: "2026-09-20T06:00:00.000Z",
      venueName: "Kediaman Keluarga Saputra",
      address: "Jl. Melati Indah No. 7, Bekasi, Jawa Barat",
      mapsUrl: "https://maps.google.com/?q=-6.24,106.99",
    },
  ],
  media: [
    photo("#c96f4a", "#e2a659"),
    photo("#e2a659", "#a8522e"),
    photo("#f8ecd9", "#c96f4a"),
    photo("#a8522e", "#c96f4a"),
    photo("#fdf7ee", "#e2a659"),
    photo("#c96f4a", "#5a3c2c"),
  ].map((p, i) => ({ id: `demo-m${i}`, ...p })),
  music: null,
  watermark: true,
};

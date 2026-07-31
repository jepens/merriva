import type { InvitationData } from "@/types/invitation";

/**
 * Data contoh pratinjau tema Festa (family, tier Craft) — acuan
 * `prototypes/family-warm-craft.html` (Tasyakuran Khitan Rafa). Foto galeri =
 * gradasi SVG data-URI hangat agar mandiri (tanpa request eksternal).
 */
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
  eventDate: "2026-12-20",
  content: {
    category: "family",
    eventName: "Tasyakuran Khitan",
    celebrant: "Muhammad Rafa Alfarizi",
    parents: "Bapak Andri Wijaya & Ibu Maya Kusuma",
    wishes: [
      {
        title: "Keluarga Budi",
        date: "Sahabat keluarga",
        narrative:
          "Selamat ya Rafa! Semoga jadi anak saleh, sehat selalu, dan makin pintar.",
      },
      {
        title: "Tante Rini",
        date: "Keluarga",
        narrative: "Rafa hebat! Tante bangga. Sampai ketemu hari Minggu ya 🤍",
      },
    ],
    greetingOpen:
      "Dengan penuh rasa syukur, kami mengundang Bapak/Ibu untuk hadir dalam tasyakuran khitan putra kami tercinta.",
    greetingClose:
      "Keluarga besar Wijaya menantikan kehadiran & doa terbaik Bapak/Ibu.",
    quote: {
      text: "Setiap anak membawa harapan dan kebahagiaan bagi keluarga.",
      source: "Keluarga Wijaya",
    },
    envelope: {
      enabled: true,
      banks: [{ bank: "BSI", number: "5566778899", holder: "Andri Wijaya" }],
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
      name: "Tasyakuran",
      startAt: "2026-12-20T03:00:00.000Z", // 10.00 WIB
      endAt: "2026-12-20T06:00:00.000Z",
      venueName: "Kediaman Keluarga Wijaya",
      address: "Jl. Melati Raya No. 45, Ciputat, Tangerang Selatan",
      mapsUrl: "https://maps.google.com/?q=-6.30,106.75",
    },
  ],
  media: [
    photo("#f5b93f", "#e5953f"),
    photo("#e56a4e", "#c9532f"),
    photo("#2e7d6b", "#1d5d4e"),
    photo("#f0a868", "#d97f42"),
    photo("#ffd98a", "#f5b93f"),
    photo("#e56a4e", "#f5b93f"),
  ].map((p, i) => ({ id: `demo-m${i}`, ...p })),
  music: null,
  watermark: true,
};

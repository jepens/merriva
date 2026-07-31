import type { InvitationData } from "@/types/invitation";

/**
 * Data contoh pratinjau tema Prisma (corporate, tier Signature) — mandiri (foto =
 * gradasi SVG data-URI, tanpa request eksternal). Acara "SYNERGY '26" mengikuti
 * `prototypes/prisma-signature.html` agar showcase menampilkan kekuatan tema.
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
  category: "corporate",
  eventDate: "2026-12-11",
  content: {
    category: "corporate",
    eventName: "SYNERGY '26",
    organizer: "PT Nusantara Kreasi Digital",
    description:
      "Sepuluh tahun membangun bersama. Malam ini kita rayakan pencapaian, apresiasi karya terbaik, dan buka lembar dekade berikutnya — Annual Gathering & Awards Night.",
    pic: {
      name: "People & Culture — NKD",
      phone: "+62 811 1000 260",
      email: "people@nkd.co.id",
    },
    agenda: [
      {
        title: "Registrasi & Welcome Drink",
        date: "18.30",
        narrative: "Tunjukkan QR tiket di gate untuk check-in cepat.",
      },
      {
        title: "Opening & Sambutan CEO",
        date: "19.00",
        narrative: "Kilas balik sepuluh tahun perjalanan NKD.",
      },
      {
        title: "Gala Dinner",
        date: "19.40",
        narrative: "Live acoustic session menemani santap malam.",
      },
      {
        title: "Awards Night",
        date: "20.30",
        narrative: "12 kategori penghargaan · nominasi dari semua divisi.",
      },
      {
        title: "DJ Set & After Party",
        date: "21.45",
        narrative: "Dresscode: Future Formal. Rayakan sampai puas.",
      },
    ],
    greetingOpen:
      "Dengan hormat, seluruh tim & karyawan diundang hadir dalam malam puncak SYNERGY '26.",
    greetingClose:
      "Sampai jumpa di lantai dansa — mari buka dekade berikutnya bersama.",
    quote: {
      text: "Satu dekade, satu tim.",
      source: "Annual Gathering & Awards Night",
    },
    envelope: { enabled: false, banks: [], ewallets: [] },
  },
  settings: {
    timezone: "Asia/Jakarta",
    sections: {},
    moderateGuestbook: false,
  },
  events: [
    {
      id: "demo-main",
      name: "Annual Gathering & Awards Night",
      startAt: "2026-12-11T11:30:00.000Z", // 18.30 WIB
      endAt: "2026-12-11T16:00:00.000Z", // 23.00 WIB
      venueName: "The Hall — Senayan City",
      address:
        "Jl. Asia Afrika Lot 19, Senayan, Jakarta Pusat · Parkir P3–P5 · Shuttle dari kantor 17.30",
      mapsUrl: "https://maps.google.com/?q=-6.226,106.799",
    },
  ],
  media: [
    photo("#7C5CFF", "#0A0A16"),
    photo("#41E2D8", "#12122A"),
    photo("#D8FF5F", "#0A0A16"),
    photo("#12122A", "#7C5CFF"),
    photo("#0A0A16", "#41E2D8"),
    photo("#2B2350", "#0A0A16"),
  ].map((p, i) => ({ id: `demo-m${i}`, ...p })),
  music: null,
  watermark: false,
};

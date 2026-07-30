import type { InvitationData } from "@/types/invitation";

/**
 * Data contoh pratinjau tema Meridian (corporate) — mandiri (foto = gradasi
 * SVG data-URI, tanpa request eksternal).
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
  eventDate: "2026-10-15",
  content: {
    category: "corporate",
    eventName: "Nusantara Tech Summit 2026",
    organizer: "PT Meridian Digital Nusantara",
    description:
      "Konferensi teknologi tahunan yang mempertemukan pemimpin industri, praktisi, dan inovator untuk membahas masa depan transformasi digital di Indonesia. Bergabunglah dalam sesi keynote, panel diskusi, dan peluang jejaring.",
    pic: {
      name: "Sekretariat Panitia",
      phone: "+62 812 3456 7890",
      email: "rsvp@nusantarasummit.id",
    },
    agenda: [
      {
        title: "Registrasi & Coffee Morning",
        date: "08.00 – 09.00 WIB",
        narrative:
          "Registrasi peserta, pengambilan lanyard, dan ramah tamah pagi.",
      },
      {
        title: "Keynote: Masa Depan AI di Indonesia",
        date: "09.00 – 10.30 WIB",
        narrative:
          "Pemaparan arah strategis adopsi kecerdasan buatan oleh pembicara utama.",
      },
      {
        title: "Panel: Transformasi Digital UMKM",
        date: "11.00 – 12.30 WIB",
        narrative:
          "Diskusi lintas sektor tentang digitalisasi usaha kecil dan menengah.",
      },
      {
        title: "Networking Lunch & Penutupan",
        date: "12.30 – 14.00 WIB",
        narrative: "Santap siang, jejaring antar peserta, dan sesi penutup.",
      },
    ],
    greetingOpen:
      "Dengan hormat, kami mengundang Bapak/Ibu untuk hadir dalam acara berikut.",
    greetingClose:
      "Kehadiran dan partisipasi Bapak/Ibu merupakan kehormatan bagi kami.",
    quote: {
      text: "Inovasi bukan tentang teknologi semata, melainkan tentang orang yang berani mengubah cara kerja.",
      source: "Tema Summit 2026",
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
      name: "Nusantara Tech Summit 2026",
      startAt: "2026-10-15T01:00:00.000Z", // 08.00 WIB
      endAt: "2026-10-15T07:00:00.000Z",
      venueName: "Ballroom, The Ritz-Carlton Jakarta",
      address: "Jl. DR. Ide Anak Agung Gde Agung, Kuningan, Jakarta Selatan",
      mapsUrl: "https://maps.google.com/?q=-6.224,106.809",
    },
  ],
  media: [
    photo("#17223a", "#0f1826"),
    photo("#2b3550", "#17223a"),
    photo("#bf9350", "#8f6a2e"),
    photo("#566072", "#17223a"),
    photo("#eee8da", "#bf9350"),
    photo("#0f1826", "#566072"),
  ].map((p, i) => ({ id: `demo-m${i}`, ...p })),
  music: null,
  watermark: false,
};

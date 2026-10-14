import { demoPhoto, demoPhotosFor } from "@/themes/_shared/demo-photos";
import type { InvitationData } from "@/types/invitation";

/**
 * Data contoh pratinjau tema Noir (wedding sinematik) — acuan
 * `prototypes/midnight-frame-story.html` (Damar & Sekar). Foto galeri = gradasi
 * SVG data-URI gelap agar mandiri (tanpa request eksternal).
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
  category: "wedding",
  eventDate: "2026-12-19",
  content: {
    category: "wedding",
    title: "Damar & Sekar",
    groom: {
      name: "Damar Wicaksana",
      nickname: "Damar",
      fatherName: "Rahmat Wicaksana",
      motherName: "Sari Utami",
      childOrder: "Putra pertama",
    },
    bride: {
      name: "Sekar Ayuningtyas",
      nickname: "Sekar",
      fatherName: "Bambang Prasetyo",
      motherName: "Ratna Dewi",
      childOrder: "Putri kedua",
    },
    story: [
      {
        title: "Take 01 — Perkenalan",
        date: "Bogor, 2019",
        narrative:
          "Dua pandangan bertemu di sebuah senja, dan enggan berpaling. Babak pertama sebuah kisah pun dimulai.",
      },
      {
        title: "Take 02 — Lamaran",
        date: "Oktober 2025",
        narrative:
          "Di hadapan keluarga, sebuah janji diucapkan — menandai bahwa kisah ini layak dilanjutkan ke layar lebar.",
      },
      {
        title: "Take 03 — Premiere",
        date: "Desember 2026",
        narrative:
          "Setelah tujuh tahun berbagi cerita, tibalah babak berikutnya: bersama, selamanya.",
      },
    ],
    greetingOpen:
      "Setelah tujuh tahun berbagi cerita, kami memutuskan untuk menulis babak berikutnya — bersama, selamanya.",
    greetingClose:
      "Sebuah kehormatan bagi kami bila Anda berkenan hadir dan menjadi bagian dari adegan penutup kisah ini.",
    quote: {
      text: "Dalam setiap bingkai, aku menemukan bayanganmu; dalam setiap gelap, aku menemukan rumah.",
      source: "Untuk Damar & Sekar",
    },
    envelope: {
      enabled: true,
      banks: [
        { bank: "Mandiri", number: "7710228833", holder: "Damar Wicaksana" },
      ],
      ewallets: [
        { provider: "OVO", number: "085711223344", holder: "Sekar A." },
      ],
      giftAddress: "Skyline Garden, Bogor Valley, Jawa Barat",
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
      startAt: "2026-12-19T01:00:00.000Z", // 08.00 WIB
      endAt: "2026-12-19T03:00:00.000Z",
      venueName: "Ballroom Hotel Salak The Heritage",
      address: "Jl. Ir. H. Juanda No.8, Bogor",
      mapsUrl: "https://maps.google.com/?q=-6.60,106.79",
    },
    {
      id: "demo-resepsi",
      name: "Resepsi",
      startAt: "2026-12-19T11:30:00.000Z", // 18.30 WIB
      endAt: "2026-12-19T14:00:00.000Z",
      venueName: "Skyline Garden, Bogor Valley",
      address: "Dresscode: Black tie & warna gelap",
      mapsUrl: "https://maps.google.com/?q=-6.60,106.80",
    },
  ],
  media:
    demoPhotosFor("noir") ??
    [
      photo("#2c2138", "#12101c"),
      photo("#37273a", "#0e0c14"),
      photo("#22293b", "#10131c"),
      photo("#3b2b26", "#141019"),
      photo("#241d30", "#0f0d16"),
      photo("#1a1622", "#2c2138"),
    ].map((p, i) => ({ id: `demo-m${i}`, ...p })),
  groomPhoto: demoPhoto(demoPhotosFor("noir")?.[0]?.url),
  bridePhoto: demoPhoto(demoPhotosFor("noir")?.[1]?.url),
  coverPhoto: demoPhoto(demoPhotosFor("noir")?.[2]?.url),
  music: null,
  watermark: true,
};

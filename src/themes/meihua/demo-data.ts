import { demoPhoto, demoPhotosFor } from "@/themes/_shared/demo-photos";
import type { InvitationData } from "@/types/invitation";

/**
 * Data contoh pratinjau tema Meihua (wedding Tionghoa) — acuan
 * `prototypes/meihua-story.html` (Clarissa & Kevin, Jakarta). Foto fallback =
 * gradasi SVG data-URI palet merah lacquer/emas.
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
  eventDate: "2027-03-14",
  content: {
    category: "wedding",
    title: "Clarissa & Kevin",
    bride: {
      name: "Clarissa Tanuwijaya",
      nickname: "Clarissa",
      fatherName: "Tanuwijaya Budiman",
      motherName: "Lily Kusuma",
      childOrder: "Putri kedua",
    },
    groom: {
      name: "Kevin Hartono",
      nickname: "Kevin",
      fatherName: "Hartono Wijaya",
      motherName: "Mei Lan",
      childOrder: "Putra sulung",
    },
    story: [
      {
        title: "Pertemuan",
        date: "2019",
        narrative:
          "Berkenalan saat perayaan Cap Go Meh keluarga besar di Glodok.",
      },
      {
        title: "Lamaran",
        date: "2026",
        narrative:
          "Kevin melamar di bawah pohon mei hua yang sedang mekar di Taipei.",
      },
      {
        title: "Pernikahan",
        date: "2027",
        narrative: "Dua keluarga bersatu; kebahagiaan menjadi berganda.",
      },
    ],
    greetingOpen:
      "Bersama keluarga besar Tanuwijaya dan Hartono, kami mengundang Anda menjadi saksi kebahagiaan kami.",
    greetingClose:
      "Merupakan kehormatan bagi kami dan keluarga apabila Anda berkenan hadir serta memberikan doa restu.",
    quote: {
      text: "Dua hati, dua keluarga — satu kebahagiaan yang berganda.",
      source: "Makna Shuāng Xǐ",
    },
    envelope: {
      enabled: true,
      banks: [
        { bank: "BCA", number: "5281188888", holder: "Clarissa Tanuwijaya" },
      ],
      ewallets: [
        { provider: "DANA", number: "081899998888", holder: "Kevin H." },
      ],
      giftAddress: "Jl. Kelapa Gading Permai III No. 8, Jakarta",
    },
  },
  settings: {
    timezone: "Asia/Jakarta",
    sections: {},
    moderateGuestbook: false,
  },
  events: [
    {
      id: "demo-sangjit",
      name: "Sangjit · Seserahan",
      startAt: "2027-02-28T03:00:00.000Z", // 10.00 WIB
      endAt: "2027-02-28T05:00:00.000Z",
      venueName: "Kediaman Keluarga Tanuwijaya",
      address: "Jl. Kelapa Gading Permai III No. 8, Jakarta",
      mapsUrl: "https://maps.google.com/?q=-6.16,106.9",
    },
    {
      id: "demo-dinner",
      name: "Holy Matrimony & Wedding Dinner",
      startAt: "2027-03-14T09:00:00.000Z", // 16.00 WIB
      endAt: "2027-03-14T13:00:00.000Z",
      venueName: "The Golden Phoenix Grand Ballroom",
      address: "Jl. Gajah Mada No. 188, Jakarta",
      mapsUrl: "https://maps.google.com/?q=-6.15,106.81",
    },
  ],
  media:
    demoPhotosFor("meihua") ??
    [
      photo("#c04a3c", "#701a16"),
      photo("#d89a4a", "#7c4a1a"),
      photo("#a53a2e", "#5e1613"),
      photo("#b3652f", "#6e3a14"),
      photo("#8e2a22", "#4a110e"),
      photo("#e2b13c", "#9c6b1a"),
    ].map((p, i) => ({ id: `demo-m${i}`, ...p })),
  groomPhoto: demoPhoto(demoPhotosFor("meihua")?.[0]?.url),
  bridePhoto: demoPhoto(demoPhotosFor("meihua")?.[1]?.url),
  coverPhoto: demoPhoto(demoPhotosFor("meihua")?.[2]?.url),
  music: null,
  watermark: true,
};

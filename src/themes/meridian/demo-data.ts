import { demoPhotosFor } from "@/themes/_shared/demo-photos";
import type { InvitationData } from "@/types/invitation";

/**
 * Data contoh pratinjau tema Meridian (wedding Art Deco gala, tier Story) —
 * acuan `prototypes/meridian-story.html` (Alina Prameswari & Devan Mahendra).
 * Mandiri: foto galeri = gradasi SVG data-URI navy/emas (tanpa request eksternal).
 * Waktu WIB disimpan sebagai UTC ISO (Sabtu 20 Feb 2027 16.00 WIB → 09.00 UTC).
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
  eventDate: "2027-02-20",
  content: {
    category: "wedding",
    title: "Alina Prameswari & Devan Mahendra",
    bride: {
      name: "Alina Prameswari",
      nickname: "Alina",
      fatherName: "Adrian Prameswari",
      motherName: "Karina Dewanti",
      childOrder: "Putri pertama",
    },
    groom: {
      name: "Devan Mahendra",
      nickname: "Devan",
      fatherName: "Yudha Mahendra",
      motherName: "Sofia Larasati",
      childOrder: "Putra kedua",
    },
    story: [],
    greetingOpen:
      "Dengan hormat, kami mengundang Anda menghadiri malam pernikahan kami — sebuah gala kecil untuk orang-orang yang paling kami sayangi.",
    greetingClose:
      "Kehadiran Anda adalah kehormatan tertinggi bagi kami. Sampai jumpa di malam bahagia.",
    quote: {
      text: "Dan di antara tanda-tanda kekuasaan-Nya, Dia menciptakan pasangan-pasangan untukmu agar kamu merasa tenteram.",
      source: "Q.S. Ar-Rum · 21",
    },
    envelope: {
      enabled: true,
      banks: [{ bank: "BCA", number: "3344556677", holder: "Devan Mahendra" }],
      ewallets: [
        { provider: "OVO", number: "081288997766", holder: "Alina Prameswari" },
      ],
      giftAddress: "The Langham Residence, SCBD Lot 8, Jakarta Selatan",
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
      startAt: "2027-02-20T09:00:00.000Z", // 16.00 WIB
      endAt: "2027-02-20T10:00:00.000Z",
      venueName: "The Langham Ballroom, SCBD",
      address: "Keluarga & kerabat dekat",
      mapsUrl: "https://maps.google.com/?q=-6.224,106.809",
    },
    {
      id: "demo-gala",
      name: "Gala Reception",
      startAt: "2027-02-20T12:00:00.000Z", // 19.00 WIB
      endAt: "2027-02-20T15:00:00.000Z", // 22.00 WIB
      venueName: "The Langham Grand Ballroom",
      address: "Dresscode: Black tie · aksen emas",
      mapsUrl: "https://maps.google.com/?q=-6.224,106.809",
    },
  ],
  media:
    demoPhotosFor("meridian") ??
    [
      photo("#2b3c5c", "#0d1626"),
      photo("#4a3d22", "#141018"),
      photo("#20365c", "#0a1120"),
      photo("#a97e35", "#0f1826"),
      photo("#d4b36a", "#4a3d22"),
      photo("#17223a", "#a97e35"),
    ].map((p, i) => ({ id: `demo-m${i}`, ...p })),
  music: null,
  watermark: true,
};

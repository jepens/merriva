import { demoPhoto, demoPhotosFor } from "@/themes/_shared/demo-photos";
import type { InvitationData } from "@/types/invitation";

/**
 * Data contoh pratinjau tema Marawa (wedding adat Minang) — acuan
 * `prototypes/marawa-story.html` (Puti Rahma & Malin, Padang). Foto fallback =
 * gradasi SVG data-URI palet maroon/emas/hitam.
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
  eventDate: "2027-02-06",
  content: {
    category: "wedding",
    title: "Rahma & Malin",
    bride: {
      name: "Puti Rahma Khairani, S.E.",
      nickname: "Puti Rahma",
      fatherName: "H. Dt. Rajo Batuah",
      motherName: "Hj. Syamsidar",
      childOrder: "Putri pertama",
    },
    groom: {
      name: "Malin Darmawan, M.M.",
      nickname: "Malin",
      fatherName: "Drs. Yusril Anwar",
      motherName: "Rosnidar",
      childOrder: "Putra kedua",
    },
    story: [
      {
        title: "Bertemu di Rantau",
        date: "2020",
        narrative:
          "Bertemu di perantauan Jakarta, dipertemukan komunitas sesama perantau Minang.",
      },
      {
        title: "Lamaran",
        date: "2025",
        narrative:
          "Keluarga datang melamar; kedua keluarga sepakat, ikatan diresmikan.",
      },
      {
        title: "Pernikahan",
        date: "2027",
        narrative: "Doa dan restu mengiringi langkah kami ke pelaminan.",
      },
    ],
    greetingOpen:
      "Dengan memohon rahmat Allah ﷻ serta restu keluarga besar, kami bermaksud melangsungkan pernikahan.",
    greetingClose:
      "Segala kehadiran dan doa restu Bapak/Ibu adalah kehormatan bagi keluarga kami.",
    quote: {
      text: "Adat bersendikan syariat, syariat bersendikan Kitabullah.",
      source: "Falsafah Minangkabau",
    },
    envelope: {
      enabled: true,
      banks: [
        {
          bank: "Bank Nagari",
          number: "1100223344",
          holder: "Puti Rahma Khairani",
        },
      ],
      ewallets: [
        { provider: "OVO", number: "081266778899", holder: "Malin D." },
      ],
      giftAddress: "Jl. Khatib Sulaiman No. 9, Padang",
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
      startAt: "2027-02-06T01:00:00.000Z", // 08.00 WIB
      endAt: "2027-02-06T03:00:00.000Z",
      venueName: "Masjid Raya Sumatera Barat",
      address: "Jl. Khatib Sulaiman, Padang",
      mapsUrl: "https://maps.google.com/?q=-0.92,100.36",
    },
    {
      id: "demo-baralek",
      name: "Resepsi",
      startAt: "2027-02-06T04:00:00.000Z", // 11.00 WIB
      endAt: "2027-02-06T09:00:00.000Z",
      venueName: "Istana Bung Hatta Ballroom",
      address: "Jl. Sudirman No. 35, Padang",
      mapsUrl: "https://maps.google.com/?q=-0.95,100.36",
    },
  ],
  media:
    demoPhotosFor("marawa") ??
    [
      photo("#7e2430", "#3a1218"),
      photo("#8a6b2e", "#473614"),
      photo("#55191f", "#2b0e13"),
      photo("#6e5524", "#3a2d12"),
      photo("#642027", "#331016"),
      photo("#4a1820", "#1a0a0d"),
    ].map((p, i) => ({ id: `demo-m${i}`, ...p })),
  groomPhoto: demoPhoto(demoPhotosFor("marawa")?.[0]?.url),
  bridePhoto: demoPhoto(demoPhotosFor("marawa")?.[1]?.url),
  coverPhoto: demoPhoto(demoPhotosFor("marawa")?.[2]?.url),
  music: null,
  watermark: true,
};

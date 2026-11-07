import { demoPhoto, demoPhotosFor } from "@/themes/_shared/demo-photos";
import type { InvitationData } from "@/types/invitation";

/**
 * Data contoh pratinjau tema Priangan (wedding adat Sunda) — acuan
 * `prototypes/priangan-story.html` (Anjani & Galih, Bandung). Foto fallback =
 * gradasi SVG data-URI palet pinus/gading/emas (mandiri, tanpa request
 * eksternal). Waktu WIB disimpan sebagai UTC.
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
  eventDate: "2027-01-23",
  content: {
    category: "wedding",
    title: "Anjani & Galih",
    bride: {
      name: "Anjani Puspitasari, S.Sn.",
      nickname: "Anjani",
      fatherName: "H. Dadang Suryana",
      motherName: "Hj. Euis Komariah",
      childOrder: "Putri bungsu",
    },
    groom: {
      name: "Galih Permana, S.T.",
      nickname: "Galih",
      fatherName: "Asep Hermawan",
      motherName: "Nyi Raden Mirna",
      childOrder: "Putra sulung",
    },
    story: [
      {
        title: "Pertemuan Pertama",
        date: "2021",
        narrative:
          "Bertemu pertama kali di sanggar angklung kampus — satu nada, dua hati yang saling menyelaraskan irama.",
      },
      {
        title: "Lamaran",
        date: "2024",
        narrative:
          "Keluarga Galih datang membawa niat baik; seserahan diterima dengan haru dan doa.",
      },
      {
        title: "Pernikahan",
        date: "2027",
        narrative:
          "Dengan doa restu kedua keluarga, kami melangkah ke jenjang pernikahan.",
      },
    ],
    greetingOpen:
      "Dengan rahmat Allah ﷻ dan restu kedua orang tua, kami bermaksud menyatukan dua hati dalam ikatan pernikahan.",
    greetingClose:
      "Terima kasih atas segala perhatiannya — merupakan kebahagiaan bagi kami apabila Bapak/Ibu berkenan hadir dan memberikan doa restu.",
    quote: {
      text: "Saling mengasihi, saling mengasah diri, saling menjaga.",
      source: "Falsafah Sunda",
    },
    envelope: {
      enabled: true,
      banks: [
        { bank: "BCA", number: "4372218890", holder: "Anjani Puspitasari" },
      ],
      ewallets: [
        { provider: "GoPay", number: "081322110099", holder: "Galih P." },
      ],
      giftAddress: "Jl. Ir. H. Juanda No. 72, Bandung 40132",
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
      startAt: "2027-01-23T01:00:00.000Z", // 08.00 WIB
      endAt: "2027-01-23T03:00:00.000Z",
      venueName: "Pendopo Dalem Sawala",
      address: "Jl. Ir. H. Juanda No. 72, Bandung",
      mapsUrl: "https://maps.google.com/?q=-6.89,107.61",
    },
    {
      id: "demo-resepsi",
      name: "Resepsi",
      startAt: "2027-01-23T04:00:00.000Z", // 11.00 WIB
      endAt: "2027-01-23T08:00:00.000Z",
      venueName: "Bale Pakuan Convention Hall",
      address: "Jl. Setiabudi No. 118, Bandung",
      mapsUrl: "https://maps.google.com/?q=-6.86,107.59",
    },
  ],
  media:
    demoPhotosFor("priangan") ??
    [
      photo("#4c7257", "#1f4231"),
      photo("#c2a14d", "#8a6f33"),
      photo("#39543b", "#1f4231"),
      photo("#7e9367", "#4a6345"),
      photo("#a78c45", "#6e5a2a"),
      photo("#56774f", "#2e5b41"),
    ].map((p, i) => ({ id: `demo-m${i}`, ...p })),
  groomPhoto: demoPhoto(demoPhotosFor("priangan")?.[0]?.url),
  bridePhoto: demoPhoto(demoPhotosFor("priangan")?.[1]?.url),
  coverPhoto: demoPhoto(demoPhotosFor("priangan")?.[2]?.url),
  music: null,
  watermark: true,
};

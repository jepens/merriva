import type { InvitationData } from "@/types/invitation";

/**
 * Data contoh untuk pratinjau tema tanpa undangan nyata (dipakai `/preview/demo`
 * & pengembangan tema). Foto galeri = gradasi SVG data-URI agar mandiri (tanpa
 * request eksternal).
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
  eventDate: "2026-11-08",
  content: {
    category: "wedding",
    title: "The Wedding of Rina & Bima",
    groom: {
      name: "Bima Arya Pratama",
      nickname: "Bima",
      fatherName: "Sujarwo",
      motherName: "Sri Lestari",
      childOrder: "Putra kedua",
    },
    bride: {
      name: "Rina Kartika Sari",
      nickname: "Rina",
      fatherName: "Hadi Santoso",
      motherName: "Wulandari",
      childOrder: "Putri pertama",
    },
    story: [
      {
        title: "Pertama Bertemu",
        date: "Maret 2019",
        narrative:
          "Kami dipertemukan di sebuah acara kampus. Sebuah percakapan singkat yang ternyata menjadi awal dari segalanya.",
      },
      {
        title: "Menjalin Hubungan",
        date: "Agustus 2020",
        narrative:
          "Setahun berlalu, kami memutuskan untuk melangkah bersama, saling menguatkan dalam suka dan duka.",
      },
      {
        title: "Lamaran",
        date: "Juni 2026",
        narrative:
          "Di hadapan kedua keluarga, sebuah janji diucapkan untuk melanjutkan ke jenjang yang lebih serius.",
      },
    ],
    greetingOpen:
      "Dengan memohon rahmat dan ridho Allah SWT, kami bermaksud menyelenggarakan pernikahan putra-putri kami.",
    greetingClose:
      "Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu.",
    quote: {
      text: "Dan di antara tanda-tanda kekuasaan-Nya, Dia menciptakan pasangan-pasangan untukmu dari jenismu sendiri, agar kamu cenderung dan merasa tenteram kepadanya.",
      source: "QS. Ar-Rum: 21",
    },
    envelope: {
      enabled: true,
      banks: [
        { bank: "BCA", number: "1234567890", holder: "Rina Kartika Sari" },
      ],
      ewallets: [
        { provider: "GoPay", number: "081234567890", holder: "Bima Arya" },
      ],
      giftAddress: "Jl. Melati No. 12, Sleman, Yogyakarta 55281",
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
      startAt: "2026-11-08T02:00:00.000Z", // 09.00 WIB
      endAt: "2026-11-08T03:00:00.000Z",
      venueName: "Masjid Agung Al-Ikhlas",
      address: "Jl. Kaliurang KM 5, Sleman, Yogyakarta",
      mapsUrl: "https://maps.google.com/?q=-7.75,110.37",
    },
    {
      id: "demo-resepsi",
      name: "Resepsi",
      startAt: "2026-11-08T04:00:00.000Z", // 11.00 WIB
      endAt: "2026-11-08T07:00:00.000Z",
      venueName: "Graha Sabha Pramana",
      address: "Bulaksumur, Caturtunggal, Depok, Sleman, Yogyakarta",
      mapsUrl: "https://maps.google.com/?q=-7.77,110.38",
    },
  ],
  media: [
    photo("#e8c8cb", "#b76e79"),
    photo("#f5e9e6", "#ad8a56"),
    photo("#d9b8a8", "#8c4b56"),
    photo("#e7d3c1", "#b76e79"),
    photo("#f0dcd8", "#927b78"),
    photo("#e8c8cb", "#8c4b56"),
  ].map((p, i) => ({ id: `demo-m${i}`, ...p })),
  music: null,
  watermark: true,
};

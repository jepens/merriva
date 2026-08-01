import type { InvitationData } from "@/types/invitation";

/**
 * Data contoh pratinjau tema Lumina — wedding "Tara & Gilang" (acuan
 * `prototypes/lumina-craft.html`). Tema universal ini tetap menyesuaikan konten
 * non-wedding; demo memakai wedding untuk memamerkan cover film & surat kecil.
 * Mandiri (foto galeri = gradasi taupe SVG data-URI, tanpa request eksternal).
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
  eventDate: "2027-04-11",
  content: {
    category: "wedding",
    title: "Tara & Gilang",
    groom: {
      name: "Gilang Saputra",
      nickname: "Gilang",
      fatherName: "Ardi Saputra",
      motherName: "Yulia",
      childOrder: "Putra pertama",
    },
    bride: {
      name: "Tara Widuri",
      nickname: "Tara",
      fatherName: "Seno Widuri",
      motherName: "Ratih",
      childOrder: "Putri kedua",
    },
    story: [
      {
        title: "Taman Kota",
        date: "2020",
        narrative:
          "Dua orang paling kalem bertemu di sebuah taman kota — awal dari tujuh musim hujan yang kami lewati bersama.",
      },
      {
        title: "Lamaran",
        date: "2026",
        narrative:
          "Dengan restu kedua keluarga, kami sepakat untuk melangkah ke babak yang lebih serius.",
      },
      {
        title: "Pulang ke Rumah yang Sama",
        date: "2027",
        narrative:
          "Kini kami memutuskan untuk pulang ke rumah yang sama, dan ingin berbagi harinya bersama Anda.",
      },
    ],
    greetingOpen:
      "Kepada orang-orang yang kami sayangi — setelah tujuh musim hujan bersama, kami memutuskan untuk pulang ke rumah yang sama. Dengan izin Allah dan restu keluarga, kami menikah. Datanglah, sebentar saja pun cukup; kehadiranmu adalah bagian dari cerita kami.",
    greetingClose: "Sampai jumpa di hari baik itu.",
    quote: {
      text: "Dan di antara tanda-tanda kekuasaan-Nya diciptakan-Nya untukmu pasangan hidup dari jenismu sendiri, supaya kamu merasa tenteram.",
      source: "Q.S. Ar-Rum · 21",
    },
    envelope: {
      enabled: true,
      banks: [
        { bank: "BCA", number: "009988776655", holder: "Gilang Saputra" },
      ],
      ewallets: [],
      giftAddress: "Rumah Kaca, Dago Pakar, Bandung, Jawa Barat",
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
      startAt: "2027-04-11T02:00:00.000Z", // 09.00 WIB
      endAt: "2027-04-11T03:00:00.000Z",
      venueName: "Rumah Kaca, Dago Pakar",
      address: "Dago Pakar, Bandung — untuk keluarga",
      mapsUrl: "https://maps.google.com/?q=-6.85,107.63",
    },
    {
      id: "demo-resepsi",
      name: "Resepsi Kebun",
      startAt: "2027-04-11T04:00:00.000Z", // 11.00 WIB
      endAt: "2027-04-11T07:00:00.000Z", // 14.00 WIB
      venueName: "Rumah Kaca, Dago Pakar",
      address: "Busana: warna-warna lembut",
      mapsUrl: "https://maps.google.com/?q=-6.85,107.63",
    },
  ],
  media: [
    photo("#c9bba4", "#6f6250"),
    photo("#b8aa97", "#4e463c"),
    photo("#d2c4ac", "#857357"),
    photo("#c4b49a", "#6b5c46"),
    photo("#b3a58f", "#584c3b"),
    photo("#e0d6c4", "#9a7b58"),
  ].map((p, i) => ({ id: `demo-m${i}`, ...p })),
  music: null,
  watermark: true,
};

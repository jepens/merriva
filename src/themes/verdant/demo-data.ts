import { demoPhoto, demoPhotosFor } from "@/themes/_shared/demo-photos";
import type { InvitationData } from "@/types/invitation";

/**
 * Data contoh pratinjau tema Verdant (wedding botanikal) — acuan
 * `prototypes/flora-atelier-story.html` (Anjani & Bayu). Foto galeri = gradasi
 * SVG data-URI hijau/earth agar mandiri (tanpa request eksternal).
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
    title: "Anjani & Bayu",
    groom: {
      name: "Bayu Segara",
      nickname: "Bayu",
      fatherName: "Hendra Segara",
      motherName: "Wulandari",
      childOrder: "Putra kedua",
    },
    bride: {
      name: "Anjani Paramita",
      nickname: "Anjani",
      fatherName: "Surya Paramita",
      motherName: "Handayani",
      childOrder: "Putri pertama",
    },
    story: [
      {
        title: "Menanam Benih",
        date: "Musim pertama, 2020",
        narrative:
          "Bertemu di sebuah kelas berkebun — dua tangan yang gemar menyentuh tanah dan tumbuhan.",
      },
      {
        title: "Bertunas",
        date: "2023",
        narrative:
          "Merawat mimpi bersama, seperti merawat taman: sabar, telaten, dan penuh cinta.",
      },
      {
        title: "Berbunga",
        date: "2027",
        narrative:
          "Kini bunga itu mekar sempurna, dan kami siap berbagi harinya bersama Anda.",
      },
    ],
    greetingOpen:
      "Dengan penuh syukur, kami mengundang Bapak/Ibu/Saudara/i untuk hadir di hari bahagia kami — tumbuh bersama, berakar selamanya.",
    greetingClose:
      "Kehadiran dan doa Anda akan menjadi pupuk terindah bagi rumah tangga kami.",
    quote: {
      text: "Ya Tuhanku, anugerahkanlah kepada kami pasangan dan keturunan sebagai penyejuk hati.",
      source: "Q.S. Al-Furqan · 74",
    },
    envelope: {
      enabled: true,
      banks: [{ bank: "BNI", number: "8890112233", holder: "Anjani Paramita" }],
      ewallets: [
        { provider: "DANA", number: "081399887766", holder: "Bayu Segara" },
      ],
      giftAddress: "Taman Anggrek, Kebun Raya Bogor, Jawa Barat",
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
      venueName: "Pendopo Agung Kebun Raya",
      address: "Jl. Ir. H. Juanda No.13, Bogor",
      mapsUrl: "https://maps.google.com/?q=-6.60,106.79",
    },
    {
      id: "demo-resepsi",
      name: "Resepsi Kebun",
      startAt: "2027-01-23T04:00:00.000Z", // 11.00 WIB
      endAt: "2027-01-23T07:00:00.000Z",
      venueName: "Taman Anggrek, Kebun Raya Bogor",
      address: "Dresscode: nuansa earth tone",
      mapsUrl: "https://maps.google.com/?q=-6.60,106.80",
    },
  ],
  media:
    demoPhotosFor("verdant") ??
    [
      photo("#aebb95", "#556243"),
      photo("#c9a98b", "#7a5b40"),
      photo("#9db1a2", "#48584d"),
      photo("#c8b183", "#6d5b35"),
      photo("#869a6a", "#46583a"),
      photo("#bd8368", "#869a6a"),
    ].map((p, i) => ({ id: `demo-m${i}`, ...p })),
  groomPhoto: demoPhoto(demoPhotosFor("verdant")?.[0]?.url),
  bridePhoto: demoPhoto(demoPhotosFor("verdant")?.[1]?.url),
  coverPhoto: demoPhoto(demoPhotosFor("verdant")?.[2]?.url),
  music: null,
  watermark: true,
};

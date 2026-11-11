import { demoPhoto, demoPhotosFor } from "@/themes/_shared/demo-photos";
import type { InvitationData, InvitationMediaView } from "@/types/invitation";

import { SLOT_FOTO_BERITA } from "./options";

/**
 * Data contoh tema Warta (koran retro) untuk katalog & `/preview/tema/warta`.
 * Memamerkan semua halaman koran: berita pembuka 2 kolom + foto berita utama
 * (slot `x-berita`), kutipan, profil mempelai berfoto, dua feature kisah,
 * kalender + hitung mundur, dua iklan acara di hari yang sama, arsip foto, dan
 * kupon amplop bertab (rekening + alamat kado). Edisi Indonesia:
 * `?variant=indonesia`. Foto meminjam set demo `eternal-rose` (kredit ikut —
 * lihat `_shared/demo-photos.ts`); fallback = gradasi abu-abu kertas koran.
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

const set = demoPhotosFor("warta");
// Urutan arsip: foto sampul (indeks 1) di akhir supaya feature kisah & arsip
// tak membuka dengan foto yang sama dengan halaman muka.
const media: InvitationMediaView[] = set
  ? [0, 2, 3, 4, 5, 1].map((i) => set[i]).filter(Boolean)
  : [
      photo("#cfcac0", "#6f6a62"),
      photo("#bdb7ac", "#4f4b45"),
      photo("#d8d3c9", "#7d776e"),
      photo("#a9a399", "#3f3b36"),
      photo("#c6c0b5", "#5c5751"),
      photo("#e0dbd1", "#8a847a"),
    ].map((p, i) => ({ id: `demo-m${i}`, ...p }));

// Foto berita utama (slot `x-berita`, lebar penuh 3:2 di halaman Berita): foto
// set yang tak dipakai sampul/mempelai/feature. Foto demo potret → titik fokus
// dinaikkan ke wajah, bukan tengah bingkai.
const fotoBerita = demoPhoto(set?.[4]?.url);
const berita = fotoBerita ? { ...fotoBerita, y: 0.06 } : null;

export const demoInvitationData: InvitationData = {
  slug: "demo",
  category: "wedding",
  eventDate: "2027-05-15",
  content: {
    category: "wedding",
    title: "Dimas & Sekar",
    groom: {
      name: "Adimas Prakoso, S.T.",
      nickname: "Dimas",
      fatherName: "Hartono Prakoso",
      motherName: "Endang Sulistyowati",
      childOrder: "Putra pertama",
    },
    bride: {
      name: "Sekar Ayuningtyas, S.Ds.",
      nickname: "Sekar",
      fatherName: "Bambang Wicaksono",
      motherName: "Retno Handayani",
      childOrder: "Putri kedua",
    },
    greetingOpen:
      "Dengan memohon rahmat dan ridha Tuhan Yang Maha Esa, kami bermaksud menyelenggarakan resepsi pernikahan kami. Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu kepada kedua mempelai di hari bahagia ini.",
    greetingClose:
      "Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Anda berkenan hadir dan memberikan doa restu. Terima kasih telah membaca kabar bahagia kami.",
    quote: {
      text: "Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan pasangan-pasangan untukmu dari jenismu sendiri, agar kamu cenderung dan merasa tenteram kepadanya.",
      source: "QS. Ar-Rūm : 21",
    },
    story: [
      {
        title: "Awal Mula",
        date: "Yogyakarta, enam tahun lalu.",
        narrative:
          "Kami dipertemukan seorang sahabat lama di sebuah pameran buku di Yogyakarta. Obrolan malam itu berlanjut lewat pesan singkat, lalu secangkir kopi, lalu perjalanan panjang yang sampai hari ini tak pernah benar-benar usai.",
      },
      {
        title: "Lamaran",
        date: "Sebuah cincin, di tempat yang sama.",
        narrative:
          "Enam tahun kemudian, di kota dan meja yang sama, sebuah cincin menjadi jawaban atas semua obrolan itu. Kami memutuskan untuk melanjutkannya seumur hidup.",
      },
    ],
    envelope: {
      enabled: true,
      banks: [
        {
          bank: "Bank Central Asia (BCA)",
          number: "8730512296",
          holder: "Sekar Ayuningtyas",
        },
        {
          bank: "Bank Mandiri",
          number: "1370019284551",
          holder: "Adimas Prakoso",
        },
      ],
      ewallets: [],
      giftAddress: "Jl. Prawirotaman No. 21, Mergangsan, Yogyakarta 55153",
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
      startAt: "2027-05-15T01:00:00.000Z", // 08.00 WIB
      endAt: "2027-05-15T03:00:00.000Z",
      venueName: "Pendopo Ndalem Kartika",
      address: "Jl. Prawirotaman No. 21, Yogyakarta",
      mapsUrl: "https://maps.google.com/?q=-7.8195,110.3693",
    },
    {
      id: "demo-resepsi",
      name: "Resepsi",
      startAt: "2027-05-15T04:00:00.000Z", // 11.00 WIB
      endAt: null,
      venueName: "Pendopo Ndalem Kartika",
      address: "Jl. Prawirotaman No. 21, Yogyakarta",
      mapsUrl: "https://maps.google.com/?q=-7.8195,110.3693",
    },
  ],
  media,
  groomPhoto: demoPhoto(set?.[3]?.url),
  bridePhoto: demoPhoto(set?.[5]?.url),
  coverPhoto: demoPhoto(set?.[1]?.url),
  themePhotos: berita ? { [SLOT_FOTO_BERITA]: berita } : undefined,
  music: null,
  watermark: true,
};

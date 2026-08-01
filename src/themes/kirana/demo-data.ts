import type { InvitationData } from "@/types/invitation";

/**
 * Data contoh pratinjau tema Kirana (wedding adat Jawa modern) — acuan
 * `prototypes/kirana-story.html` (Larasati & Panji — Dhaup Ageng, Surakarta).
 * Foto galeri = gradasi SVG data-URI palet sogan (coklat batik + krem lawas +
 * emas) agar mandiri (tanpa request eksternal). Waktu WIB disimpan sebagai UTC.
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
  eventDate: "2027-05-08",
  content: {
    category: "wedding",
    title: "Larasati & Panji",
    bride: {
      name: "Larasati Kusumawardhani",
      nickname: "Larasati",
      fatherName: "R. Harjono Kusumo",
      motherName: "Sri Rahayu",
      childOrder: "Putri pertama",
    },
    groom: {
      name: "Panji Wicaksono",
      nickname: "Panji",
      fatherName: "Bambang Wicaksono",
      motherName: "Endang Palupi",
      childOrder: "Putra kedua",
    },
    story: [
      {
        title: "Witing Tresna",
        date: "2019",
        narrative:
          "Berjumpa di sanggar tari keraton — dua langkah yang tanpa sengaja saling menyelaraskan irama gending.",
      },
      {
        title: "Semi Truntum",
        date: "2023",
        narrative:
          "Seperti motif truntum yang bersemi kembali, rasa itu tumbuh perlahan menjadi niat yang teguh.",
      },
      {
        title: "Dhaup Ageng",
        date: "2027",
        narrative:
          "Kini kami memohon doa restu untuk bersanding, menyatukan dua keluarga dalam satu rumah.",
      },
    ],
    greetingOpen:
      "Kanthi nyuwun berkah saking Gusti, kami mengundang Bapak/Ibu/Saudara/i untuk hadir dan memberikan doa restu di hari bahagia kami.",
    greetingClose:
      "Atur nuwun — merupakan kebahagiaan bagi kami apabila Bapak/Ibu berkenan rawuh paring pangestu.",
    quote: {
      text: "Witing tresna jalaran saka kulina.",
      source: "Paribasan Jawa",
    },
    envelope: {
      enabled: true,
      banks: [
        {
          bank: "Bank Jateng",
          number: "1122334455",
          holder: "Panji Wicaksono",
        },
      ],
      ewallets: [
        { provider: "DANA", number: "081234567890", holder: "Larasati K." },
      ],
      giftAddress: "Ndalem Joyokusuman, Gajahan, Pasar Kliwon, Surakarta",
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
      startAt: "2027-05-08T01:00:00.000Z", // 08.00 WIB
      endAt: "2027-05-08T02:00:00.000Z",
      venueName: "Pendopo Ndalem Joyokusuman",
      address: "Jl. Gajahan No.40, Pasar Kliwon, Surakarta",
      mapsUrl: "https://maps.google.com/?q=-7.58,110.82",
    },
    {
      id: "demo-panggih",
      name: "Upacara Panggih",
      startAt: "2027-05-08T03:00:00.000Z", // 10.00 WIB
      endAt: "2027-05-08T04:00:00.000Z",
      venueName: "Pendopo Utama",
      address:
        "Pertemuan pertama mempelai sebagai suami-istri — lempar sirih, wijikan, dan sinduran; simbol dua insan menuju satu rumah.",
      mapsUrl: null,
    },
    {
      id: "demo-resepsi",
      name: "Resepsi",
      startAt: "2027-05-08T04:00:00.000Z", // 11.00 WIB
      endAt: "2027-05-08T07:00:00.000Z",
      venueName: "Pendopo & Taman",
      address: "Busana: batik / nuansa sogan — tanpa motif parang, nyuwun sewu",
      mapsUrl: "https://maps.google.com/?q=-7.58,110.82",
    },
  ],
  media: [
    photo("#d8bc8a", "#8a6a3a"),
    photo("#c9a878", "#6b4a2b"),
    photo("#9c7e52", "#452d15"),
    photo("#b08d57", "#5d3f1e"),
    photo("#e5ce9e", "#9a7a35"),
    photo("#c09a4a", "#6b4a2b"),
  ].map((p, i) => ({ id: `demo-m${i}`, ...p })),
  music: null,
  watermark: true,
};

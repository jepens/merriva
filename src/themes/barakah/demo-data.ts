import type { InvitationData } from "@/types/invitation";

/**
 * Data contoh pratinjau tema Barakah (wedding islami elegan) — acuan
 * `prototypes/barakah-story.html` (Fatimah & Yusuf). Foto galeri = gradasi
 * SVG data-URI zamrud/emas/krem agar mandiri (tanpa request eksternal).
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
  eventDate: "2027-03-06",
  content: {
    category: "wedding",
    title: "Walimatul 'Ursy Fatimah & Yusuf",
    groom: {
      name: "Yusuf Rahman",
      nickname: "Yusuf",
      fatherName: "H. Abdul Rahman",
      motherName: "Hj. Nurhayati",
      childOrder: "Putra kedua",
    },
    bride: {
      name: "Fatimah Azzahra",
      nickname: "Fatimah",
      fatherName: "H. Ahmad Fauzi",
      motherName: "Hj. Siti Aminah",
      childOrder: "Putri pertama",
    },
    story: [
      {
        title: "Ta'aruf",
        date: "Syawal 1447 H",
        narrative:
          "Dipertemukan melalui proses ta'aruf yang dijaga, dengan niat menyempurnakan separuh agama.",
      },
      {
        title: "Khitbah",
        date: "Dzulqa'dah 1447 H",
        narrative:
          "Lamaran disampaikan di hadapan kedua keluarga, memohon keberkahan dan petunjuk dari Allah SWT.",
      },
      {
        title: "Akad Nikah",
        date: "Sya'ban 1448 H",
        narrative:
          "Insya Allah janji suci diikrarkan, menjadi keluarga yang sakinah, mawaddah, warahmah.",
      },
    ],
    greetingOpen:
      "Dengan memohon rahmat dan ridha Allah SWT, kami bermaksud menyelenggarakan pernikahan putra-putri kami.",
    greetingClose:
      "Merupakan suatu kehormatan bagi kami apabila Bapak/Ibu berkenan hadir dan memberikan doa restu.",
    quote: {
      text: "Barakallahu laka wa baraka 'alaika wa jama'a bainakuma fi khair.",
      source: "Doa untuk kedua mempelai · HR. Abu Dawud",
    },
    envelope: {
      enabled: true,
      banks: [
        {
          bank: "Bank Syariah Indonesia",
          number: "778899001122",
          holder: "Yusuf Rahman",
        },
      ],
      ewallets: [
        { provider: "GoPay", number: "081298765432", holder: "Fatimah A." },
      ],
      giftAddress: "Jl. Diponegoro No. 63, Bandung, Jawa Barat 40115",
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
      startAt: "2027-03-06T01:00:00.000Z", // 08.00 WIB
      endAt: "2027-03-06T03:00:00.000Z", // 10.00 WIB
      venueName: "Masjid Raya Al-Falah",
      address: "Jl. Diponegoro No. 63, Bandung",
      mapsUrl: "https://maps.google.com/?q=-6.9,107.61",
    },
    {
      id: "demo-walimah",
      name: "Walimatul 'Ursy",
      startAt: "2027-03-06T04:00:00.000Z", // 11.00 WIB
      endAt: "2027-03-06T07:00:00.000Z", // 14.00 WIB
      venueName: "Balai Sartika Convention Hall",
      address: "Tamu dimohon menjaga adab & kesopanan busana",
      mapsUrl: "https://maps.google.com/?q=-6.91,107.62",
    },
  ],
  media: [
    photo("#0e3b30", "#12493c"),
    photo("#c6a256", "#8a6d2f"),
    photo("#efe5cf", "#c6a256"),
    photo("#12493c", "#0e3b30"),
    photo("#f7f1e3", "#ddcfa8"),
    photo("#0e3b30", "#c6a256"),
  ].map((p, i) => ({ id: `demo-m${i}`, ...p })),
  music: null,
  watermark: true,
};

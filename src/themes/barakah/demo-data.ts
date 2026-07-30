import type { InvitationData } from "@/types/invitation";

/** Data contoh pratinjau tema Barakah (wedding islami) — mandiri (SVG data-URI). */
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
    title: "Walimatul 'Urs Fatimah & Yusuf",
    groom: {
      name: "Yusuf Abdurrahman",
      nickname: "Yusuf",
      fatherName: "H. Abdul Karim",
      motherName: "Hj. Aminah",
      childOrder: "Putra pertama",
    },
    bride: {
      name: "Fatimah Az-Zahra",
      nickname: "Fatimah",
      fatherName: "H. Ridwan Saleh",
      motherName: "Hj. Khadijah",
      childOrder: "Putri kedua",
    },
    story: [
      {
        title: "Ta'aruf",
        date: "Rajab 1447 H",
        narrative:
          "Dipertemukan melalui proses ta'aruf yang dijaga, dengan niat menyempurnakan separuh agama.",
      },
      {
        title: "Khitbah",
        date: "Sya'ban 1447 H",
        narrative:
          "Lamaran disampaikan di hadapan kedua keluarga, memohon keberkahan dari Allah SWT.",
      },
      {
        title: "Akad",
        date: "Ramadan 1447 H",
        narrative:
          "Insya Allah janji suci diikrarkan, menjadi keluarga sakinah.",
      },
    ],
    greetingOpen:
      "Dengan memohon rahmat dan ridho Allah SWT, kami bermaksud menyelenggarakan pernikahan putra-putri kami.",
    greetingClose:
      "Merupakan kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu.",
    quote: {
      text: "Dan di antara tanda-tanda kekuasaan-Nya ialah Dia menciptakan untukmu pasangan hidup dari jenismu sendiri, supaya kamu cenderung dan merasa tenteram kepadanya.",
      source: "QS. Ar-Rum: 21",
    },
    envelope: {
      enabled: true,
      banks: [
        {
          bank: "Bank Syariah Indonesia",
          number: "7001234567",
          holder: "Fatimah Az-Zahra",
        },
      ],
      ewallets: [
        { provider: "GoPay", number: "081298765432", holder: "Yusuf A." },
      ],
      giftAddress: "Jl. Anggrek No. 8, Depok, Jawa Barat 16412",
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
      startAt: "2026-11-08T01:00:00.000Z", // 08.00 WIB
      endAt: "2026-11-08T02:30:00.000Z",
      venueName: "Masjid Raya Al-Barakah",
      address: "Jl. Margonda Raya, Depok, Jawa Barat",
      mapsUrl: "https://maps.google.com/?q=-6.4,106.82",
    },
    {
      id: "demo-resepsi",
      name: "Resepsi",
      startAt: "2026-11-08T04:00:00.000Z", // 11.00 WIB
      endAt: "2026-11-08T07:00:00.000Z",
      venueName: "Gedung Serbaguna Al-Barakah",
      address: "Jl. Margonda Raya No. 20, Depok, Jawa Barat",
      mapsUrl: "https://maps.google.com/?q=-6.41,106.83",
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

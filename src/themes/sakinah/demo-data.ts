import type { InvitationData } from "@/types/invitation";

/**
 * Data contoh pratinjau tema Sakinah (wedding syar'i TANPA FOTO) — acuan
 * `prototypes/sakinah-craft.html` (Nadia & Fahri, Bandung). `media` KOSONG dan
 * seluruh foto null SECARA SENGAJA: tema ini tidak merender foto apa pun
 * (THEME-WAVE3 §3.3) — jangan "melengkapi" dengan foto demo.
 */
export const demoInvitationData: InvitationData = {
  slug: "demo",
  category: "wedding",
  eventDate: "2026-12-12",
  content: {
    category: "wedding",
    title: "Nadia & Fahri",
    bride: {
      name: "Nadia Rahmah, S.Pd.",
      nickname: "Nadia",
      fatherName: "H. Mahmud Hidayat",
      motherName: "Hj. Siti Aminah",
      childOrder: "Putri pertama",
    },
    groom: {
      name: "Fahri Alamsyah, S.T.",
      nickname: "Fahri",
      fatherName: "Ir. Bambang Sutrisno",
      motherName: "Ratna Dewi",
      childOrder: "Putra kedua",
    },
    story: [],
    greetingOpen:
      "Dengan memohon rahmat dan ridha Allah ﷻ, kami bermaksud menyelenggarakan pernikahan putra-putri kami. Merupakan kehormatan bagi kami apabila Bapak/Ibu berkenan hadir.",
    greetingClose:
      "Atas kehadiran dan doa restunya, kami ucapkan jazakumullahu khairan katsiran.",
    // Tanpa `quote`: ayat bawaan Ar-Rūm 21 (teks Arab + terjemahan yang sama)
    // hanya tampil bila quote kosong — mengisinya di sini menyembunyikan
    // teks Arab dari pratinjau.
    envelope: {
      enabled: true,
      banks: [
        {
          bank: "Bank Syariah Indonesia",
          number: "7215443321",
          holder: "Nadia Rahmah",
        },
      ],
      ewallets: [],
      giftAddress: "Jl. Cendana No. 18, Bandung 40115",
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
      startAt: "2026-12-12T01:00:00.000Z", // 08.00 WIB
      endAt: "2026-12-12T03:00:00.000Z",
      venueName: "Masjid Raya Al-Ikhlas",
      address: "Jl. Cendana No. 18, Bandung",
      mapsUrl: "https://maps.google.com/?q=-6.91,107.61",
    },
    {
      id: "demo-walimah",
      name: "Walimatul 'Ursy",
      startAt: "2026-12-12T04:00:00.000Z", // 11.00 WIB
      endAt: "2026-12-12T07:00:00.000Z",
      venueName: "Gedung Dakwah Al-Hikmah",
      address: "Jl. Merdeka No. 45, Bandung",
      mapsUrl: "https://maps.google.com/?q=-6.91,107.61",
    },
  ],
  media: [],
  groomPhoto: null,
  bridePhoto: null,
  coverPhoto: null,
  music: null,
  watermark: true,
};

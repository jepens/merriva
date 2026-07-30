import type { InvitationData } from "@/types/invitation";

/**
 * Data contoh pratinjau tema Lumina — sengaja kategori CORPORATE (bukan wedding)
 * untuk menunjukkan tema universal menyesuaikan konten non-wedding. Mandiri
 * (foto = gradasi SVG data-URI).
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
  category: "corporate",
  eventDate: "2026-11-28",
  content: {
    category: "corporate",
    eventName: "Malam Apresiasi & Ulang Tahun ke-25",
    organizer: "PT Cahaya Karya Bersama",
    description:
      "Sebuah malam penuh syukur merayakan seperempat abad perjalanan perusahaan, sekaligus mengapresiasi dedikasi seluruh keluarga besar Cahaya Karya.",
    pic: {
      name: "Panitia HUT ke-25",
      phone: "+62 21 5550 1234",
      email: "hut25@cahayakarya.co.id",
    },
    agenda: [
      {
        title: "Ramah Tamah",
        date: "18.30 WIB",
        narrative: "Registrasi tamu dan foto bersama di area penyambutan.",
      },
      {
        title: "Sambutan & Penghargaan",
        date: "19.30 WIB",
        narrative:
          "Sambutan direksi dan pemberian penghargaan karyawan teladan.",
      },
      {
        title: "Ramah Tamah & Hiburan",
        date: "20.30 WIB",
        narrative: "Santap malam, hiburan, dan undian doorprize.",
      },
    ],
    greetingOpen:
      "Dengan penuh sukacita, kami mengundang Bapak/Ibu untuk hadir dalam malam istimewa ini.",
    greetingClose:
      "Terima kasih atas dedikasi dan kebersamaan yang telah terjalin selama ini.",
    quote: {
      text: "Setiap pencapaian adalah hasil dari kerja sama yang tulus.",
      source: "Cahaya Karya Bersama",
    },
    envelope: { enabled: false, banks: [], ewallets: [] },
  },
  settings: {
    timezone: "Asia/Jakarta",
    sections: {},
    moderateGuestbook: false,
  },
  events: [
    {
      id: "demo-main",
      name: "Malam Apresiasi",
      startAt: "2026-11-28T11:30:00.000Z", // 18.30 WIB
      endAt: "2026-11-28T15:00:00.000Z",
      venueName: "Grand Ballroom, Hotel Indonesia Kempinski",
      address: "Jl. M.H. Thamrin No. 1, Jakarta Pusat",
      mapsUrl: "https://maps.google.com/?q=-6.193,106.823",
    },
  ],
  media: [
    photo("#262019", "#9a7b58"),
    photo("#9a7b58", "#7a5f40"),
    photo("#f0ebe1", "#9a7b58"),
    photo("#7c756a", "#262019"),
    photo("#faf8f4", "#9a7b58"),
    photo("#262019", "#7c756a"),
  ].map((p, i) => ({ id: `demo-m${i}`, ...p })),
  music: null,
  watermark: false,
};

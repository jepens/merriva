/**
 * Aset ornamen raster tema Kirana (hasil kurasi Canva, duotone emas-sogan,
 * latar transparan kecuali pita truntum). File di `public/ornaments/kirana/`
 * — total ±296 KB; semua selain gunungan (cover) dimuat lazy. Dimensi piksel
 * dicantumkan di pemakaian (`width`/`height`) agar bebas CLS.
 */
export const ORN = {
  /** 700×1050 — kayon ukiran penuh (cover; LCP, fetchPriority high). */
  gunungan: "/ornaments/kirana/gunungan.webp",
  /** 420×833 — wayang kulit putri, menghadap kanan. */
  wayangPutri: "/ornaments/kirana/wayang-putri.webp",
  /** 420×833 — wayang kulit putra, menghadap kiri. */
  wayangPutra: "/ornaments/kirana/wayang-putra.webp",
  /** 480×480 — sulur lung-lungan sudut, bidang asli kiri-bawah. */
  sulur: "/ornaments/kirana/sulur.webp",
  /** 234×175 — ubin pola truntum, seamless horizontal (dipakai via CSS). */
  truntum: "/ornaments/kirana/truntum.webp",
} as const;

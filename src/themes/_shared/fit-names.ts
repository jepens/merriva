/**
 * Pengepas nama mempelai (DECISIONS #107) — infrastruktur bersama tema.
 *
 * Nama satu kata yang lebar ("Muhammad", "Kusumawardhani") melampaui wadahnya
 * pada ukuran desain dan terpotong masker baris (atau meluap keluar layar). Lebar
 * huruf antar-nama berbeda jauh (m/w ±0,8em, i/l ±0,25em), jadi teksnya DIUKUR,
 * bukan ditebak dari jumlah huruf: hanya yang melampaui lebar KONTEN wadahnya
 * yang dikecilkan; nama yang muat tetap berukuran desain, kecuali yang pas tepat
 * (sisa presisi `konten()`) atau yang tumpukannya lebih tinggi dari bidang
 * ornamen (`kepasTinggi`). Ruang untuk tinta italic yang menjorok di tepi (kait
 * "f", titik "i") — juga aksen kapital di atas dan ekor di bawah — disediakan
 * CSS tema lewat padding + margin negatif pada masker nama, bukan cadangan besar
 * di sini (`fitToLine` menyisakan ≥2%; DECISIONS #111).
 *
 * Pasangan yang dikepas: `[el, wadah]` — `el` yang dikecilkan font-size-nya,
 * `wadah` yang lebar kontennya diukur. Teksnya diambil dari anak elemen pertama
 * wadah (pola masker `.x-line > span`) atau wadah itu sendiri (nama tanpa
 * masker). Syarat:
 * - wadah `display: block`/sejenisnya — elemen inline tak punya lebar konten;
 * - lebar wadah ditentukan kontainer, bukan seketat teks (`min-width: 0` pada
 *   item grid/flex baris, `stretch`/`width: 100%` pada item flex kolom): wadah
 *   fit-content melebar mengikuti kata terpanjangnya sendiri, jadi luapannya
 *   tak pernah terukur;
 * - letter-spacing ber-em dideklarasikan pada `el` atau di bawahnya, bukan pada
 *   leluhurnya: yang diwarisi adalah panjang mutlak hasil hitung leluhur, jadi
 *   ia tak ikut mengecil bersama font-size `el` dan nama yang dikepas tetap
 *   meluap;
 * - leluhur nama tak ber-scale/rotate selama pengepas jalan (pakai translate):
 *   lebar Range ikut transform, lebar konten tidak;
 * - satu `el` per nama — `fitToLine` mereset font-size `el` setiap dipanggil.
 */
export type PasanganNama = readonly [el: HTMLElement, wadah: HTMLElement];

const px = (cs: CSSStyleDeclaration, prop: string) =>
  parseFloat(cs.getPropertyValue(prop)) || 0;

/**
 * Ukuran KONTEN pecahan (tanpa padding & border) dari gaya terhitung. Bukan
 * clientWidth/clientHeight: keduanya dibulatkan ke bilangan bulat, dan pada
 * masker berpadding em pembulatan ±0,5 px itu mengecilkan nama yang sebenarnya
 * muat. Presisinya sekitar 1/32 px — padding terhitung belum dibulatkan ke
 * satuan tata letak 1/64 px, dan Chromium menyerialkan width & padding 6 angka
 * penting —, jadi nama yang pas TEPAT masih bisa dikecilkan ≥2% (0,7–2,4 px). Tak
 * terpengaruh transform; NaN bila elemen tak tertata (display:none).
 */
function konten(el: Element, sumbu: "width" | "height"): number {
  const cs = getComputedStyle(el);
  const [a, b] = sumbu === "width" ? ["left", "right"] : ["top", "bottom"];
  const kotak =
    cs.boxSizing === "border-box"
      ? px(cs, `padding-${a}`) +
        px(cs, `padding-${b}`) +
        px(cs, `border-${a}-width`) +
        px(cs, `border-${b}-width`)
      : 0;
  return parseFloat(cs.getPropertyValue(sumbu)) - kotak;
}

export function fitToLine(el: HTMLElement, line: HTMLElement): void {
  el.style.fontSize = "";
  const text = line.firstElementChild ?? line;
  const avail = konten(line, "width");
  if (!(avail > 0)) return;
  // Range atas TEKS-nya: kotak span blok selalu selebar wadah. Teks yang
  // membungkus memberi lebar baris terlebarnya, yaitu kata yang meluap.
  const range = document.createRange();
  range.selectNodeContents(text);
  const need = range.getBoundingClientRect().width;
  if (need > avail) {
    const size = parseFloat(getComputedStyle(el).fontSize);
    el.style.fontSize = `${Math.floor((size * avail * 0.98) / need)}px`;
  }
}

/** Tinggi kotak margin anak bidang (tinggi konten + padding, border, margin). */
function tinggiLuar(el: Element): number {
  const cs = getComputedStyle(el);
  return (
    konten(el, "height") +
    [
      "padding-top",
      "padding-bottom",
      "border-top-width",
      "border-bottom-width",
      "margin-top",
      "margin-bottom",
    ].reduce((s, p) => s + px(cs, p), 0)
  );
}

/**
 * Nama yang membungkus 3–4 baris (nama lengkap bergelar saat nama panggilan
 * kosong) bisa lebih tinggi dari bidang ornamen yang tingginya tetap, lalu
 * meluap menimpa tanggal. Bila tumpukan anak `bidang` (tanpa gap) melampaui
 * tinggi kontennya lebih dari 0,5 px (sisa sub-piksel), SEMUA `el` dikecilkan
 * dengan satu skala — pasangan tetap seimbang — yang dicari biner, karena
 * pembungkusan berubah tak linear terhadap ukuran. Dijalankan sesudah kepas
 * lebar dalam pass yang sama: `fitToLine` mereset font-size. Tumpukan yang muat
 * tak disentuh. Syarat `bidang`: tinggi pasti, tanpa gap (tak ikut dijumlah);
 * anaknya kotak blok yang ikut tata letak dan bertumpuk vertikal. Anak
 * display:contents, display:none, atau inline (di bidang blok) tanpa height
 * eksplisit tak bertinggi terhitung — tumpukannya tak terukur dan kepas tinggi
 * dilewati; dengan height eksplisit, nilai itu malah ikut terhitung. Masker di
 * trek grid auto diberi `max-content` (overflow:hidden boleh menyusut ke 0 di
 * sana, jadi tumpukannya terukur kurang).
 */
export function kepasTinggi(
  bidang: HTMLElement,
  pasangan: readonly PasanganNama[],
): void {
  const muat = konten(bidang, "height") + 0.5;
  const tumpukan = () =>
    Array.from(bidang.children).reduce((s, anak) => s + tinggiLuar(anak), 0);
  if (!(muat > 0.5) || !(tumpukan() > muat)) return;
  const dasar = pasangan.map(([el]) =>
    parseFloat(getComputedStyle(el).fontSize),
  );
  const skala = (k: number) =>
    pasangan.forEach(([el], i) => {
      el.style.fontSize = `${Math.floor(dasar[i] * k)}px`;
    });
  let lo = 0.3;
  let hi = 1;
  for (let i = 0; i < 10; i++) {
    const k = (lo + hi) / 2;
    skala(k);
    if (tumpukan() <= muat) lo = k;
    else hi = k;
  }
  skala(lo);
}

/**
 * Muat face yang dipakai `el` untuk `text`. Font tema `preload: false`, jadi
 * lebar akhirnya baru pasti sesudah face ini tiba; selesainya = ukur ulang.
 */
export function muatFont(el: Element, text: string): Promise<unknown> {
  if (!document.fonts) return Promise.resolve();
  const cs = getComputedStyle(el);
  return document.fonts.load(
    `${cs.fontStyle} ${cs.fontWeight} 16px ${cs.fontFamily}`,
    text,
  );
}

function kepasSemua(pasangan: readonly PasanganNama[]): void {
  for (const [el, wadah] of pasangan) fitToLine(el, wadah);
}

/**
 * Pengepas nama di SAMPUL. Pemicunya ResizeObserver pada dialog sampul
 * (`[role="dialog"]`, selayar): ia jalan sesudah tata letak dan SEBELUM lukisan
 * pada frame ketika sampul baru tampil (0×0 → selayar, saat cover-gate memasang
 * `is-js`) dan saat layar berubah ukuran — rAF terbukti telat satu frame.
 * Ukurannya tetap selayar, jadi mengecilkan nama tak memicu ulang dirinya.
 * Diulang begitu janji `muatFont` selesai — di Chromium itu bisa satu frame
 * sesudah face baru terlukis pada ukuran lama. `bidang`: wadah ornamen
 * bertinggi tetap tempat nama ditumpuk (tengah gunungan, lengkung mihrab) —
 * sesudah kepas lebar, tumpukannya dikepas ke tinggi bidang itu
 * (`kepasTinggi`). Mengembalikan pembersih untuk `useEffect`.
 */
export function pasangPengepasSampul(
  inner: HTMLElement,
  ambil: () => readonly PasanganNama[],
  teks: string,
  bidang?: HTMLElement | null,
): () => void {
  const sampul = inner.closest<HTMLElement>('[role="dialog"]') ?? inner;
  let live = true;
  const fit = () => {
    if (!live) return;
    const pasangan = ambil();
    kepasSemua(pasangan);
    if (bidang) kepasTinggi(bidang, pasangan);
  };
  const ro = new ResizeObserver(() => fit());
  ro.observe(sampul);
  const pertama = ambil()[0];
  if (pertama) muatFont(pertama[0], teks).then(fit, () => {});
  return () => {
    live = false;
    ro.disconnect();
  };
}

/**
 * Pengepas nama di ISI undangan (hero dsb.). Jalan saat mount — isi sudah
 * tertata di balik sampul, jadi tak ada lompatan yang terlihat — saat layar
 * berubah ukuran, dan saat atribut `style` akar tema berganti: editor tampilan
 * mengganti pasangan font langsung di iframe tanpa memuat ulang, lalu face yang
 * KINI dipakai dimuat dan diukur lagi begitu tiba.
 */
export function pasangPengepasIsi(
  root: HTMLElement,
  ambil: () => readonly PasanganNama[],
  teks: string,
): () => void {
  let live = true;
  const fit = () => {
    if (live) kepasSemua(ambil());
  };
  const ukur = () => {
    fit();
    const pertama = ambil()[0];
    if (pertama)
      muatFont(pertama[1].querySelector("em") ?? pertama[0], teks).then(
        fit,
        () => {},
      );
  };
  ukur();
  window.addEventListener("resize", fit);
  const mo = new MutationObserver(ukur);
  mo.observe(root, { attributes: true, attributeFilter: ["style"] });
  return () => {
    live = false;
    window.removeEventListener("resize", fit);
    mo.disconnect();
  };
}

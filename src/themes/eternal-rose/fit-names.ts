/**
 * Pengepas nama eternal-rose (DECISIONS #107), dipakai sampul & hero.
 *
 * Fraunces jauh lebih lebar dari font yang dulu keliru tampil, sehingga nama
 * satu kata yang lebar ("Muhammad", "Kusumawardhani") melampaui masker
 * `.er-line` dan terpotong. Lebar huruf antar-nama berbeda jauh (m/w ±0,8em,
 * i/l ±0,25em), jadi teksnya DIUKUR, bukan ditebak dari jumlah huruf: hanya yang
 * melampaui lebar KONTEN maskernya yang dikecilkan, sedangkan nama yang muat
 * tetap berukuran desain. Ruang untuk tinta italic yang menjorok di kedua tepi
 * (kait "f", titik "i") disediakan CSS lewat `padding-inline` masker nama, jadi
 * tak perlu cadangan besar di sini.
 */
export function fitToLine(el: HTMLElement, line: HTMLElement): void {
  el.style.fontSize = "";
  const text = line.firstElementChild;
  if (!text || line.clientWidth === 0) return;
  const cs = getComputedStyle(line);
  const avail =
    line.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
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

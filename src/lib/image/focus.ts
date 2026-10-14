/** Titik fokus (0..1) + perbesaran sebuah foto bernama. */
export interface Fokus {
  x: number;
  y: number;
  zoom: number;
}

function jepit(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Seretan layar → titik fokus baru (THEME-CONTRACT §3). MURNI, tanpa DOM.
 *
 * Pembaginya bukan lebar bingkai, melainkan LUAPAN NYATA foto di dalamnya.
 * Dengan `object-fit: cover`, seberapa jauh foto bisa digeser ditentukan
 * selisih ukuran terskala dengan bingkainya — foto yang nyaris sebentuk bingkai
 * hampir tak punya ruang gerak, sedangkan foto yang jauh lebih lebar punya
 * banyak. Memakai lebar bingkai sebagai pembagi membuat yang pertama terasa
 * melompat dan yang kedua terasa macet.
 *
 * Saat luapannya nol (foto persis sebentuk bingkai) tetapi sedang diperbesar,
 * pergeseran tetap mungkin karena `transform-origin` ikut bergerak — di situ
 * `bingkai × (zoom − 1)` yang menjadi pembaginya. Faktor `× zoom` terakhir
 * menjaga seretan tetap terasa 1:1 dengan jari: isi bingkai tampak `zoom` kali
 * lebih besar, jadi pergeserannya harus `zoom` kali lebih kecil.
 */
export function geserFokus(
  f: Fokus,
  dx: number,
  dy: number,
  bingkai: { w: number; h: number },
  alami: { w: number; h: number },
): { x: number; y: number } {
  const { w: bw, h: bh } = bingkai;
  const nw = alami.w || bw;
  const nh = alami.h || bh;

  const cover = Math.max(bw / nw, bh / nh);
  const z = f.zoom;
  const pembagiX = Math.max(nw * cover - bw, bw * (z - 1)) * z;
  const pembagiY = Math.max(nh * cover - bh, bh * (z - 1)) * z;

  // `> 0` memikul SELURUH penjagaan kasus merosot: bingkai yang belum terukur
  // (0 px pada render pertama) dan gambar yang belum termuat menghasilkan
  // pembagi 0 atau NaN, dan keduanya gagal di sini — jadi NaN tak pernah
  // tersimpan ke `content`. Penjaga `if` terpisah pernah ada di atas dan
  // terbukti tak punya satu pun masukan yang bisa menjalankannya.
  return {
    x: pembagiX > 0 ? jepit(f.x - dx / pembagiX) : f.x,
    y: pembagiY > 0 ? jepit(f.y - dy / pembagiY) : f.y,
  };
}

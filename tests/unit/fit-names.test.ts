import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fitToLine,
  kepasTinggi,
  pasangPengepasSampul,
} from "@/themes/_shared/fit-names";

/**
 * Pengepas nama tema (_shared/fit-names.ts, DECISIONS #107/#111). jsdom tak punya tata
 * letak, jadi ukuran yang dibaca pengepas disuntik di sini. Yang dikunci adalah
 * aritmetika yang pernah salah: ukuran dibanding lebar KONTEN masker (padding ruang
 * tinta dikurangkan) — tanpa itu nama selebar 95–100% wadah tak dikecilkan dan tinta
 * italic di tepinya terpotong —, lebar itu pecahan (bukan clientWidth yang dibulatkan),
 * nama yang muat tak disentuh, dan tumpukan nama yang lebih tinggi dari bidang ornamen
 * dikecilkan dengan satu skala sampai muat — sesudah kepas lebar, dari ukuran hasilnya,
 * dan sekali lagi begitu face nama tiba.
 */

/** Gaya terhitung tiruan: properti camelCase + `getPropertyValue` kebab-case. */
function gaya(map: Record<string, string>): CSSStyleDeclaration {
  return {
    ...map,
    getPropertyValue: (p: string) => map[p] ?? "",
  } as unknown as CSSStyleDeclaration;
}

function pasang(o: {
  width: number | "auto";
  padding: number;
  need: number;
  fontSize: number;
}) {
  const el = document.createElement("span");
  const line = document.createElement("span");
  const text = document.createElement("span");
  line.append(text);
  el.append(line);
  el.style.fontSize = "12px"; // sisa pengepasan sebelumnya — wajib direset
  vi.spyOn(window, "getComputedStyle").mockImplementation((node) =>
    node === line
      ? gaya({
          boxSizing: "border-box",
          width: o.width === "auto" ? "auto" : `${o.width}px`,
          "padding-left": `${o.padding}px`,
          "padding-right": `${o.padding}px`,
          "border-left-width": "0px",
          "border-right-width": "0px",
        })
      : gaya({ fontSize: `${o.fontSize}px` }),
  );
  // Range atas TEKS memberi lebar teksnya; atas wadah, kotak span bloknya yang
  // selebar wadah — nama yang muat pun tampak meluap.
  vi.spyOn(document, "createRange").mockImplementation(() => {
    let dipilih: Node | null = null;
    return {
      selectNodeContents: (n: Node) => {
        dipilih = n;
      },
      getBoundingClientRect: () => ({
        width: dipilih === text ? o.need : Number(o.width) || 0,
      }),
    } as unknown as Range;
  });
  return { el, line };
}

describe("fitToLine", () => {
  afterEach(() => vi.restoreAllMocks());

  it("nama yang muat di lebar konten tetap berukuran desain", () => {
    const { el, line } = pasang({
      width: 297.6,
      padding: 12.8,
      need: 250,
      fontSize: 64,
    });

    fitToLine(el, line);

    expect(el.style.fontSize).toBe("");
  });

  it("dibanding lebar KONTEN: lebih lebar dari konten tetapi muat di kotak berpadding → tetap dikecilkan", () => {
    // Konten 272 = 297,6 − 2×12,8. Teks 280 muat di kotak 297,6, tetapi tinta
    // italic-nya di tepi akan terpotong — inilah kasus "Abdurrauf".
    const { el, line } = pasang({
      width: 297.6,
      padding: 12.8,
      need: 280,
      fontSize: 64,
    });

    fitToLine(el, line);

    expect(el.style.fontSize).toBe(`${Math.floor((64 * 272 * 0.98) / 280)}px`);
  });

  it("lebar terpakai pecahan, bukan clientWidth yang dibulatkan: nama yang muat tak dikecilkan", () => {
    // Masker berpadding em selebar 319,375 px; clientWidth-nya 319. Konten
    // 319,375 − 2×12,8 = 293,775 ≥ 293,7 → muat. Dari clientWidth (konten 293,4)
    // nama ini dikecilkan 1–1,5 px — noir 344/368 px.
    const { el, line } = pasang({
      width: 319.375,
      padding: 12.8,
      need: 293.7,
      fontSize: 58.48,
    });
    Object.defineProperty(line, "clientWidth", { value: 319 });

    fitToLine(el, line);

    expect(el.style.fontSize).toBe("");
  });

  it("nama yang meluap dikecilkan sebanding, dibulatkan ke bawah", () => {
    const { el, line } = pasang({
      width: 272,
      padding: 0,
      need: 340,
      fontSize: 64,
    });

    fitToLine(el, line);

    expect(el.style.fontSize).toBe("50px"); // ⌊64 × 272 × 0,98 / 340⌋ = ⌊50,17⌋
  });

  it.each([
    // Toleransi lebar ditolak (DECISIONS #111): luapan sekecil apa pun dipangkas
    // masker. ⌊64 × 272 × 0,98 / 272,3⌋ = 62.
    ["luapan sub-piksel 0,3 px tetap dikecilkan", 272.3, "62px"],
    ["nama yang pas tepat tak dikecilkan", 272, ""],
  ])("%s", (_, need, harap) => {
    const { el, line } = pasang({ width: 272, padding: 0, need, fontSize: 64 });

    fitToLine(el, line);

    expect(el.style.fontSize).toBe(harap);
  });

  it("masker belum tertata (sampul display:none) → tak diubah", () => {
    const { el, line } = pasang({
      width: "auto",
      padding: 0,
      need: 340,
      fontSize: 64,
    });

    fitToLine(el, line);

    expect(el.style.fontSize).toBe("");
  });
});

/**
 * Bidang tiruan: nama — "&" — nama. Tiap nama (`el`) membungkus maskernya (`wadah`),
 * dua baris berline-height 1,14, jadi tingginya 2,28 × font-size teks yang sedang
 * berlaku: inline wadah, inline `el` (hasil pengepasan), atau ukuran dasar. "&" 34 px.
 */
function bidangUji(o: {
  tinggi: string;
  dasar: readonly [number, number];
  ampMargin?: number;
  ampTinggi?: string;
  inline?: string;
}) {
  const bidang = document.createElement("div");
  const n1 = document.createElement("span");
  const amp = document.createElement("span");
  const n2 = document.createElement("span");
  bidang.append(n1, amp, n2);
  const nama = [n1, n2];
  const wadah = nama.map((n) => n.appendChild(document.createElement("span")));
  if (o.inline) n1.style.fontSize = o.inline; // hasil kepas lebar
  const px = (el: HTMLElement) => parseFloat(el.style.fontSize);
  vi.spyOn(window, "getComputedStyle").mockImplementation((node) => {
    if (node === bidang)
      return gaya({ boxSizing: "border-box", height: o.tinggi });
    if (node === amp)
      return gaya({
        boxSizing: "border-box",
        height: o.ampTinggi ?? "34px",
        "margin-top": `${o.ampMargin ?? 0}px`,
        "margin-bottom": `${o.ampMargin ?? 0}px`,
      });
    const i = nama.indexOf(node as HTMLSpanElement);
    const fs = px(nama[i]) || o.dasar[i];
    return gaya({
      boxSizing: "border-box",
      fontSize: `${fs}px`,
      height: `${(px(wadah[i]) || fs) * 2.28}px`,
    });
  });
  return {
    bidang,
    n1,
    n2,
    pasangan: nama.map((n, i) => [n, wadah[i]] as const),
  };
}

describe("kepasTinggi", () => {
  afterEach(() => vi.restoreAllMocks());

  it("tumpukan yang muat di bidang tak disentuh", () => {
    // 2 × 2,28 × 20 + 34 = 125,2 ≤ 132,7.
    const { bidang, n1, n2, pasangan } = bidangUji({
      tinggi: "132.7px",
      dasar: [20, 20],
    });

    kepasTinggi(bidang, pasangan);

    expect(n1.style.fontSize).toBe("");
    expect(n2.style.fontSize).toBe("");
  });

  it("tumpukan yang meluap dikecilkan dengan SATU skala sampai muat", () => {
    // 2,28 × (⌊30k⌋ + ⌊40k⌋) + 34 ≤ 133,2 ⇔ ⌊30k⌋ + ⌊40k⌋ ≤ 43. Skala terbesar yang
    // memenuhi: tepat di bawah k = 19/30 → 18 px dan 25 px (tinggi 132,04).
    const { bidang, n1, n2, pasangan } = bidangUji({
      tinggi: "132.7px",
      dasar: [30, 40],
    });

    kepasTinggi(bidang, pasangan);

    expect(n1.style.fontSize).toBe("18px");
    expect(n2.style.fontSize).toBe("25px");
  });

  it("margin anak bidang ikut dihitung", () => {
    // Tanpa margin: 2 × 2,28 × 21 + 34 = 129,76 → muat. Dengan margin "&" 2 + 2 px:
    // 133,76 > 133,2 → dikecilkan; 2 × 2,28 × ⌊21k⌋ + 38 ≤ 133,2 ⇔ ⌊21k⌋ ≤ 20.
    const { bidang, n1, n2, pasangan } = bidangUji({
      tinggi: "132.7px",
      dasar: [21, 21],
      ampMargin: 2,
    });

    kepasTinggi(bidang, pasangan);

    expect(n1.style.fontSize).toBe("20px");
    expect(n2.style.fontSize).toBe("20px");
  });

  it("skala dihitung dari ukuran HASIL kepas lebar, bukan ukuran desain", () => {
    // n1 sudah dikepas lebar ke 25 px (desain 30): ⌊25k⌋ + ⌊40k⌋ ≤ 43 → k terbesar
    // tepat di bawah 0,68 → 16 px dan 27 px. Dari ukuran desain hasilnya 18/25.
    const { bidang, n1, n2, pasangan } = bidangUji({
      tinggi: "132.7px",
      dasar: [30, 40],
      inline: "25px",
    });

    kepasTinggi(bidang, pasangan);

    expect(n1.style.fontSize).toBe("16px");
    expect(n2.style.fontSize).toBe("27px");
  });

  it("anak bidang tanpa tinggi terhitung → kepas tinggi dilewati, bukan dihitung 0 atau turun ke 30%", () => {
    // Nama 40 px meluap (2 × 2,28 × 40 = 182,4 tanpa "&"), tetapi tinggi "&" "auto"
    // membuat tumpukan tak terukur.
    const { bidang, n1, n2, pasangan } = bidangUji({
      tinggi: "132.7px",
      dasar: [40, 40],
      ampTinggi: "auto",
    });

    kepasTinggi(bidang, pasangan);

    expect(n1.style.fontSize).toBe("");
    expect(n2.style.fontSize).toBe("");
  });

  it("tumpukan ≤0,5 px di atas tinggi bidang (sisa sub-piksel) → tak diubah", () => {
    // 2 × 2,28 × 20 + 41,9 = 133,1: 0,4 px di atas 132,7.
    const { bidang, n1, n2, pasangan } = bidangUji({
      tinggi: "132.7px",
      dasar: [20, 20],
      ampTinggi: "41.9px",
    });

    kepasTinggi(bidang, pasangan);

    expect(n1.style.fontSize).toBe("");
    expect(n2.style.fontSize).toBe("");
  });

  it.each(["auto", "0px"])(
    "bidang belum tertata (tinggi %s) → tak diubah",
    (tinggi) => {
      const { bidang, n1, n2, pasangan } = bidangUji({
        tinggi,
        dasar: [30, 40],
      });

      kepasTinggi(bidang, pasangan);

      expect(n1.style.fontSize).toBe("");
      expect(n2.style.fontSize).toBe("");
    },
  );
});

const jeda = () => new Promise((r) => setTimeout(r, 0));

/**
 * Sampul tiruan: dialog > inner > bidang (nama — "&" — nama), wadah 272 px, bidang
 * 132,7 px. Lebar teks sebanding font-size: n1 9,6 em dengan face cadangan (meluap),
 * n2 5 em (muat). `tibaFace(em)` mengganti lebar n1 lalu menyelesaikan janji
 * `document.fonts.load`.
 */
function sampulUji() {
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  const inner = document.createElement("div");
  const bidang = document.createElement("div");
  const n1 = document.createElement("span");
  const amp = document.createElement("span");
  const n2 = document.createElement("span");
  bidang.append(n1, amp, n2);
  inner.append(bidang);
  dialog.append(inner);
  document.body.append(dialog);
  const desain = new Map<HTMLElement, number>([
    [n1, 30],
    [n2, 40],
  ]);
  const fs = (el: HTMLElement) =>
    parseFloat(el.style.fontSize) || (desain.get(el) ?? 0);
  vi.spyOn(window, "getComputedStyle").mockImplementation((node) => {
    if (node === bidang)
      return gaya({ boxSizing: "border-box", height: "132.7px" });
    if (node === amp) return gaya({ boxSizing: "border-box", height: "34px" });
    const el = node as HTMLElement;
    return gaya({
      boxSizing: "border-box",
      width: "272px",
      fontSize: `${fs(el)}px`,
      height: `${fs(el) * 2.28}px`,
    });
  });
  let emN1 = 9.6;
  vi.spyOn(document, "createRange").mockImplementation(() => {
    let teks: Node | null = null;
    return {
      selectNodeContents: (n: Node) => {
        teks = n;
      },
      getBoundingClientRect: () => ({
        width: teks === n1 ? fs(n1) * emN1 : fs(n2) * 5,
      }),
    } as unknown as Range;
  });
  let ubahUkuran = () => {};
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: () => void) {
        ubahUkuran = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
  let selesai = () => {};
  const muat = new Promise<void>((r) => {
    selesai = () => r();
  });
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { load: () => muat },
  });

  const lepas = pasangPengepasSampul(
    inner,
    () => [
      [n1, n1],
      [n2, n2],
    ],
    "x",
    bidang,
  );
  return {
    n1,
    n2,
    lepas,
    ubahUkuran: () => ubahUkuran(),
    tibaFace: async (em: number) => {
      emN1 = em;
      selesai();
      await jeda();
    },
  };
}

describe("pasangPengepasSampul dengan bidang", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, "fonts");
    document.body.replaceChildren();
  });

  it("lebar dulu, lalu tinggi dengan satu skala dari ukuran hasilnya", () => {
    const s = sampulUji();

    s.ubahUkuran();
    s.lepas();

    // Lebar: n1 ⌊30 × 272 × 0,98 / 288⌋ = 27 px, n2 muat. Tinggi: 2,28 × (27 + 40)
    // + 34 > 133,2 → ⌊27k⌋ + ⌊40k⌋ ≤ 43 → k terbesar tepat di bawah 2/3 → 17/26.
    // Urutan terbalik atau bidang diabaikan → 27 px / tanpa inline.
    expect(s.n1.style.fontSize).toBe("17px");
    expect(s.n2.style.fontSize).toBe("26px");
  });

  it("face nama tiba sesudah sampul tampil → lebar & tinggi diukur ulang", async () => {
    const s = sampulUji();

    s.ubahUkuran();
    await jeda(); // face belum tiba: tak ada yang berubah
    expect(s.n1.style.fontSize).toBe("17px");
    expect(s.n2.style.fontSize).toBe("26px");
    await s.tibaFace(12);
    s.lepas();

    // n1 12 em → lebar ⌊30 × 272 × 0,98 / 360⌋ = 22 px; tinggi 2,28 × (22 + 40) + 34
    // > 133,2 → ⌊22k⌋ + ⌊40k⌋ ≤ 43 → k terbesar tepat di bawah 0,725 → 15/28.
    expect(s.n1.style.fontSize).toBe("15px");
    expect(s.n2.style.fontSize).toBe("28px");
  });

  it("sesudah lepas(), face yang tiba tak lagi menyentuh nama", async () => {
    const s = sampulUji();

    s.ubahUkuran();
    s.lepas();
    await s.tibaFace(12);

    expect(s.n1.style.fontSize).toBe("17px");
    expect(s.n2.style.fontSize).toBe("26px");
  });
});

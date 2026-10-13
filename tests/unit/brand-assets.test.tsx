import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { MerrivaLogo } from "@/components/brand/merriva-logo";

/**
 * Permukaan merek: ikon, manifest, dan logo di kode (DECISIONS #75).
 *
 * KENAPA TEST INI ADA. Aset merek membusuk TANPA SUARA — tak ada yang gagal
 * mem-build, tak ada galat runtime, hanya gambar yang perlahan tak lagi sama.
 * Dua kejadian nyata di repo ini:
 *
 *  1. `handoff/brand/merriva-logo-120.png` dirender dari ikon monogram "M"
 *     darurat, lalu logo resmi berganti menjadi mark "Gerbang". PNG-nya tidak
 *     ikut berganti dan nyaris diunggah ke layar consent Google sebagai logo
 *     resmi. Salinan logo di luar satu sumber kebenaran SELALU berakhir begitu.
 *  2. `icon.svg` yang disajikan ke setiap pengunjung 95% isinya metadata C2PA
 *     yang terbawa dari master — 8,9 KB untuk gambar 0,4 KB.
 *
 * Dan yang paling mahal bila terlewat: ikon di `src/app/` root akan DIWARISI
 * `/[slug]`, halaman undangan TAMU — sedangkan "tanpa watermark Merriva" adalah
 * fitur yang DIJUAL di paket Premium. Batas itu tak terlihat di mana pun selain
 * di sini.
 */

// Akar repo. BUKAN `import.meta.url`: environment test adalah jsdom, dan di
// sana `import.meta.url` bukan URL `file:` sehingga `fileURLToPath` melempar.
const ROOT = process.cwd();
const APP = join(ROOT, "src", "app");

/**
 * Pagar paling penting di berkas ini.
 *
 * Sebagian besar pemeriksaan batas paket Premium berbentuk "berkas ini TIDAK
 * boleh ada". Bila `ROOT` salah menunjuk, SEMUANYA lulus tanpa memeriksa apa
 * pun — test hijau yang tak menguji apa-apa justru lebih berbahaya daripada
 * tak ada test, karena ia menenangkan.
 */
describe("prasyarat", () => {
  it("ROOT menunjuk akar repo", () => {
    expect(existsSync(join(ROOT, "package.json"))).toBe(true);
    expect(existsSync(join(APP, "layout.tsx"))).toBe(true);
  });
});

/** Permukaan KAMI — tiap entri wajib punya `icon.svg` + `apple-icon.png`. */
const BERIKON = ["(marketing)", "(auth)", "(dashboard)", "(admin)", "preview"];

/**
 * Segmen yang punya halaman tetapi SENGAJA tanpa ikon Merriva. Daftar ini
 * pendek dengan alasan: menambah entri di sini berarti memutuskan sebuah
 * permukaan tidak bermerek — keputusan, bukan kelalaian.
 */
const TANPA_IKON: Record<string, string> = {
  "[slug]": "halaman undangan tamu — bebas watermark adalah fitur Premium",
};

const baca = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");
const bacaBiner = (...p: string[]) => readFileSync(join(ROOT, ...p));

/** Daftar chunk PNG (tipe + panjang), untuk memeriksa metadata yang menumpang. */
function chunkPng(buf: Buffer): string[] {
  const out: string[] = [];
  let i = 8;
  while (i + 8 <= buf.length) {
    const length = buf.readUInt32BE(i);
    const type = buf.toString("latin1", i + 4, i + 8);
    out.push(type);
    if (type === "IEND") break;
    i += 12 + length;
  }
  return out;
}

/** Ukuran PNG dari header IHDR. */
function ukuranPng(buf: Buffer): [number, number] {
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

/** Apakah direktori ini (atau turunannya) merender halaman? */
function punyaHalaman(dir: string): boolean {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (punyaHalaman(join(dir, e.name))) return true;
    } else if (e.name === "page.tsx" || e.name === "page.ts") {
      return true;
    }
  }
  return false;
}

afterEach(cleanup);

describe("ikon per route group", () => {
  it.each(BERIKON)("%s punya icon.svg + apple-icon.png", (rg) => {
    expect(existsSync(join(APP, rg, "icon.svg")), `${rg}/icon.svg`).toBe(true);
    expect(
      existsSync(join(APP, rg, "apple-icon.png")),
      `${rg}/apple-icon.png`,
    ).toBe(true);
  });

  it("tiap segmen berhalaman sudah diputuskan: berikon, atau sengaja tidak", () => {
    // Yang dijaga: route group BARU yang lupa diberi ikon. Gejalanya cuma
    // favicon kosong di tab — tak ada yang melaporkannya, dan tak ada test lain
    // yang melihatnya.
    const berhalaman = readdirSync(APP, { withFileTypes: true })
      .filter((e) => e.isDirectory() && punyaHalaman(join(APP, e.name)))
      .map((e) => e.name);
    expect(berhalaman.length).toBeGreaterThan(1);

    const terlupa = berhalaman.filter(
      (s) => !BERIKON.includes(s) && !(s in TANPA_IKON),
    );
    expect(terlupa).toEqual([]);
  });

  it("daftar di `pnpm brand:assets` sama persis dengan yang diuji di sini", () => {
    // Skrip-lah yang MENULIS ikon-ikon itu. Bila daftarnya bercabang dari
    // daftar ini, regenerasi diam-diam melewati satu route group dan ikonnya
    // membeku di versi logo yang lama — persis cara `handoff/brand` membusuk.
    const blok = /const ROUTE_GROUPS = \[([\s\S]*?)\];/.exec(
      baca("scripts", "build-brand-assets.mjs"),
    );
    expect(
      blok,
      "ROUTE_GROUPS tak ditemukan di build-brand-assets.mjs",
    ).not.toBe(null);
    const dariSkrip = [...blok![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect([...dariSkrip].sort()).toEqual([...BERIKON].sort());
  });
});

describe("batas paket Premium: `/[slug]` tak boleh mewarisi ikon Merriva", () => {
  it.each([
    "icon.svg",
    "icon.png",
    "icon.ico",
    "favicon.ico",
    "apple-icon.png",
    "opengraph-image.png",
    "opengraph-image.tsx",
  ])("tak ada src/app/%s (akan diwarisi semua rute)", (f) => {
    expect(existsSync(join(APP, f)), `src/app/${f}`).toBe(false);
  });

  it.each(["icon.svg", "apple-icon.png", "opengraph-image.png"])(
    "tak ada src/app/[slug]/%s",
    (f) => {
      expect(existsSync(join(APP, "[slug]", f))).toBe(false);
    },
  );

  it.each(["favicon.ico", "apple-touch-icon.png"])(
    "tak ada /public/%s — peramban memintanya dari ROOT untuk halaman tanpa <link>",
    (f) => {
      // Inilah celah yang mudah terlewat: tanpa `<link rel=icon>`, peramban dan
      // iOS "Add to Home Screen" jatuh ke `/favicon.ico` dan
      // `/apple-touch-icon.png` di root domain. Menaruh berkas di sana
      // mengembalikan watermark Merriva ke undangan tamu lewat pintu belakang.
      // Salinan kit-nya ada di `/public/icons/`, yang tak pernah diminta otomatis.
      expect(existsSync(join(ROOT, "public", f))).toBe(false);
    },
  );
});

describe("site.webmanifest", () => {
  const manifest = JSON.parse(baca("public", "site.webmanifest")) as {
    theme_color: string;
    background_color: string;
    display: string;
    icons: { src: string; sizes: string; type: string; purpose?: string }[];
  };

  it("tiap ikon yang dirujuk benar-benar ada, dan ukurannya sesuai klaim", () => {
    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const ikon of manifest.icons) {
      const rel = ikon.src.replace(/^\//, "");
      expect(existsSync(join(ROOT, "public", rel)), ikon.src).toBe(true);
      const [w, h] = ukuranPng(bacaBiner("public", rel));
      expect(`${w}x${h}`, `ukuran ${ikon.src}`).toBe(ikon.sizes);
    }
  });

  it("`theme_color` sama dengan `viewport.themeColor` di layout marketing", () => {
    // Keduanya mewarnai permukaan yang SAMA (bilah alamat Android) lewat dua
    // jalur berbeda. Saat berbeda, yang terlihat tergantung peramban — bug yang
    // hanya muncul di sebagian perangkat dan nyaris mustahil dilacak.
    const m = /themeColor:\s*"(#[0-9a-fA-F]{6})"/.exec(
      baca("src", "app", "(marketing)", "layout.tsx"),
    );
    expect(m, "viewport.themeColor tak ditemukan di layout marketing").not.toBe(
      null,
    );
    expect(manifest.theme_color.toLowerCase()).toBe(m![1].toLowerCase());
  });

  it("`display: browser` — manifest ini hanya ikon + warna, bukan PWA", () => {
    // Dinaikkan ke `standalone` HANYA bila dashboard sengaja dijadikan PWA
    // (DECISIONS #75). Perubahan tak sengaja memunculkan prompt "Instal aplikasi"
    // di halaman marketing.
    expect(manifest.display).toBe("browser");
  });
});

describe("aset turunan bersih dan berukuran benar", () => {
  const PNG_WAJIB: [string, number, number][] = [
    ["public/icons/favicon-16x16.png", 16, 16],
    ["public/icons/favicon-32x32.png", 32, 32],
    ["public/icons/favicon-48x48.png", 48, 48],
    ["public/icons/apple-touch-icon.png", 180, 180],
    ["src/app/(marketing)/apple-icon.png", 180, 180],
    ["src/app/(marketing)/opengraph-image.png", 1200, 630],
    ["public/og-default.png", 1200, 630],
  ];

  it.each(PNG_WAJIB)("%s berukuran %i×%i", (rel, w, h) => {
    expect(ukuranPng(bacaBiner(...rel.split("/")))).toEqual([w, h]);
  });

  it.each(PNG_WAJIB.map(([rel]) => rel))(
    "%s tak membawa chunk metadata",
    (rel) => {
      // `caBX` (content credentials C2PA) berukuran 5,7 KB di SETIAP berkas —
      // 93% dari favicon 16 px. Rasterisasi Chromium tidak menghasilkannya;
      // kehadirannya berarti sebuah berkas disalin manual, bukan di-generate.
      const menumpang = chunkPng(bacaBiner(...rel.split("/"))).filter((t) =>
        ["caBX", "iTXt", "tEXt", "zTXt", "eXIf"].includes(t),
      );
      expect(menumpang).toEqual([]);
    },
  );

  it.each(BERIKON)("%s/icon.svg ramping — gambar, bukan metadata", (rg) => {
    const svg = baca("src", "app", rg, "icon.svg");
    expect(svg).not.toContain("<metadata>");
    expect(svg.length, `${rg}/icon.svg terlalu besar`).toBeLessThan(4096);
  });

  it("OG marketing & fallback undangan adalah gambar yang sama", () => {
    // `/og-default.png` dipakai `api/og/[slug]` untuk undangan non-aktif.
    // Keduanya disalin dari master yang sama; bila berbeda, salah satunya basi.
    expect(
      bacaBiner("src", "app", "(marketing)", "opengraph-image.png"),
    ).toEqual(bacaBiner("public", "og-default.png"));
  });

  it("teks alternatif OG tersedia untuk pembaca layar", () => {
    const alt = baca("src", "app", "(marketing)", "opengraph-image.alt.txt");
    expect(alt.trim().length).toBeGreaterThan(10);
  });

  it("favicon.ico kit tersedia untuk formulir vendor yang menolak SVG", () => {
    expect(existsSync(join(ROOT, "public", "icons", "favicon.ico"))).toBe(true);
  });
});

describe("<MerrivaLogo/> tidak menyimpang dari master", () => {
  const master = baca("public", "brand", "merriva-mark.svg");

  const el = (tag: string, src: string) => {
    const m = new RegExp(`<${tag}\\b[^>]*>`).exec(src);
    expect(m, `<${tag}> tak ditemukan`).not.toBe(null);
    return m![0];
  };
  const atr = (el: string, name: string) => {
    const m = new RegExp(`\\b${name}="([^"]*)"`).exec(el);
    expect(m, `atribut ${name} tak ditemukan di ${el.slice(0, 40)}…`).not.toBe(
      null,
    );
    return m![1];
  };
  /** Hex terakhir dalam nilai — menangani `#241f2b` maupun `var(--x, #241f2b)`. */
  const hex = (v: string) => {
    const m = v.match(/#[0-9a-fA-F]{6}/g);
    expect(m, `tak ada warna hex di "${v}"`).not.toBe(null);
    return m![m!.length - 1].toLowerCase();
  };

  const svgKomponen = () => {
    const { container } = render(<MerrivaLogo variant="mark" />);
    return container.innerHTML;
  };

  it("bentuk lengkungan identik dengan public/brand/merriva-mark.svg", () => {
    // Satu-satunya salinan sah dari gambar logo di dalam kode. README merek
    // melarang menggambar ulang di tempat lain justru karena salinan menyimpang
    // diam-diam — dan tak ada orang yang membandingkan dua berkas secara rutin.
    expect(atr(el("path", svgKomponen()), "d")).toBe(
      atr(el("path", master), "d"),
    );
  });

  it("tebal goresan, titik, dan radius tile sama dengan master", () => {
    const k = svgKomponen();
    expect(Number(atr(el("path", k), "stroke-width"))).toBe(
      Number(atr(el("path", master), "stroke-width")),
    );
    for (const a of ["cx", "cy", "r"]) {
      expect(Number(atr(el("circle", k), a)), `circle ${a}`).toBe(
        Number(atr(el("circle", master), a)),
      );
    }
    expect(Number(atr(el("rect", k), "rx"))).toBe(
      Number(atr(el("rect", master), "rx")),
    );
  });

  it("warna bawaan token sama dengan warna master", () => {
    // Komponen memakai `var(--mrv-logo-*, #hex)`. Yang diuji adalah NILAI
    // CADANGANnya: itulah yang tampil di dashboard dan di email — konteks tanpa
    // token `.mrv` — sehingga paling mudah tertinggal saat palet berubah.
    const k = svgKomponen();
    expect(hex(atr(el("rect", k), "fill"))).toBe(
      hex(atr(el("rect", master), "fill")),
    );
    expect(hex(atr(el("path", k), "stroke"))).toBe(
      hex(atr(el("path", master), "stroke")),
    );
    expect(hex(atr(el("circle", k), "fill"))).toBe(
      hex(atr(el("circle", master), "fill")),
    );
  });
});

describe("<MerrivaLogo/> kontrak komponen", () => {
  const svgDari = (ui: ReactElement) =>
    render(ui).container.querySelector("svg")!;

  it("mark mengisi penuh tinggi lockup", () => {
    // `TILE_SCALE` dan `LOCKUP_H` adalah dua angka terpisah yang HARUS cocok;
    // mengubah satu saja membuat ikon menggantung di atas garis dasar wordmark,
    // dan di ukuran header 28 px selisih itu tak kentara sampai ada yang
    // memperbesarnya.
    const svg = svgDari(<MerrivaLogo />);
    const skala = Number(
      /scale\(([\d.]+)\)/.exec(
        svg.querySelector("g")!.getAttribute("transform")!,
      )![1],
    );
    const tinggiViewBox = Number(svg.getAttribute("viewBox")!.split(" ")[3]);
    expect(skala * 64).toBeCloseTo(tinggiViewBox, 1);
  });

  it("tinggi eksplisit menjaga rasio — logo tak pernah melar", () => {
    const svg = svgDari(<MerrivaLogo height={26} />);
    const [, , vbW, vbH] = svg.getAttribute("viewBox")!.split(" ").map(Number);
    const w = Number(svg.getAttribute("width"));
    expect(Number(svg.getAttribute("height"))).toBe(26);
    expect(w / 26).toBeCloseTo(vbW / vbH, 2);
  });

  it("varian `mark` persegi, `wordmark` tanpa ikon", () => {
    expect(
      svgDari(<MerrivaLogo variant="mark" />).getAttribute("viewBox"),
    ).toBe("0 0 64 64");
    const wordmark = svgDari(<MerrivaLogo variant="wordmark" />);
    expect(wordmark.querySelector("rect")).toBe(null);
    expect(wordmark.querySelector("circle")).toBe(null);
  });

  it("bawaannya tersembunyi dari pembaca layar", () => {
    // Pemakainya adalah <Link> yang sudah ber-`aria-label` (lihat site-header,
    // site-footer, layout auth & dashboard). Tanpa `aria-hidden`, pembaca layar
    // mengumumkan tautan brand dua kali.
    const svg = svgDari(<MerrivaLogo />);
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("role")).toBe(null);
    expect(svg.querySelector("title")).toBe(null);
  });

  it("dengan `title`, logo berdiri sendiri sebagai gambar bernama", () => {
    const svg = svgDari(<MerrivaLogo title="Merriva" />);
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-hidden")).toBe(null);
    expect(svg.querySelector("title")!.textContent).toBe("Merriva");
  });
});

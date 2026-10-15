/**
 * Kontrak lintas-tema untuk kustomisasi (Fase G). Berjalan atas SELURUH tema di
 * registry → menangkap tema baru yang lupa mendeklarasikan `preview`, peta var
 * yang menyimpang dari yang dirender, ATAU id section/nilai gaya tanpa label
 * Indonesia (regresi tab "Bagian"/"Gaya"). Data murni (registry + copy) → tanpa
 * mock. Ini jaring pengaman kelas bug yang ditemukan audit customizer.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { copy } from "@/lib/copy";
import { themeCatalogMeta } from "@/themes/catalog-meta";
import { demoDataRegistry } from "@/themes/demo-data-registry";
import { themeRegistry } from "@/themes/registry";
import { themeOptionsRegistry } from "@/themes/theme-options-registry";

import { isKnownSection, isThemeSpecificSection } from "./section-vocab";
import { MEDIA_SLOT_IDS } from "./theme-options";

import { appearanceStyle } from "./appearance-style";
import { resolveAppearance } from "./resolve";
import type { PreviewVarToken } from "./theme-options";

const TOKENS: readonly PreviewVarToken[] = [
  "accent",
  "accentText",
  "onAccent",
  "paper",
  "ink",
  "disp",
  "body",
];

const themes = Object.entries(themeOptionsRegistry);
const sectionLabels = copy.appearance.sectionLabels as Record<string, string>;
const styleLabels = copy.appearance.styleLabels as Record<string, string>;

describe.each(themes)("kontrak tema '%s'", (_slug, opt) => {
  it("mendeklarasikan preview map yang valid", () => {
    expect(opt.preview).toBeDefined();
    expect(opt.preview.root).toMatch(/^[a-z][a-z-]*$/);
    expect(opt.preview.vars.length).toBeGreaterThan(0);
  });

  it("preview.vars: nama '--x' unik, token dikenal, memuat accent", () => {
    const names = opt.preview.vars.map((v) => v.name);
    expect(new Set(names).size).toBe(names.length);
    for (const v of opt.preview.vars) {
      expect(v.name.startsWith("--")).toBe(true);
      expect(TOKENS).toContain(v.token);
    }
    expect(opt.preview.vars.some((v) => v.token === "accent")).toBe(true);
  });

  it("appearanceStyle menghasilkan TEPAT var yang dideklarasikan (non-kosong)", () => {
    const style = appearanceStyle(
      opt.preview.vars,
      resolveAppearance(opt, null),
    );
    const keys = Object.keys(style);
    expect(keys.slice().sort()).toEqual(
      opt.preview.vars
        .map((v) => v.name)
        .slice()
        .sort(),
    );
    for (const [, value] of Object.entries(style)) {
      expect(String(value).length).toBeGreaterThan(0);
    }
  });

  it("setiap id section punya label Indonesia (tab Bagian)", () => {
    for (const s of opt.sections) {
      expect(
        sectionLabels[s.id],
        `label section '${s.id}' hilang`,
      ).toBeTruthy();
    }
  });

  it("setiap nilai gaya punya label (tab Gaya)", () => {
    for (const values of Object.values(opt.styles)) {
      for (const val of values) {
        expect(styleLabels[val], `label gaya '${val}' hilang`).toBeTruthy();
      }
    }
  });
});

/**
 * Kontrak tema v2 (THEME-CONTRACT §5) — yang dulu hanya hidup di dokumen.
 *
 * Alasan konkret test ini ada: `lumina` mendeklarasikan layar pembukanya
 * `toggle: true`, padahal CUSTOMIZER-SPEC §3 mewajibkan hero & rsvp selalu
 * tampil. Itu lolos lint, typecheck, dan seluruh unit test selama berbulan-bulan
 * karena tak ada satu pun yang memeriksanya. Tema ke-30 harus sama amannya
 * dengan tema ke-11, dan satu-satunya cara adalah CI yang menolak.
 */
describe.each(themes)("kontrak v2 tema '%s'", (slug, opt) => {
  it("punya `hero`: selalu tampil, tak bisa diurut ulang", () => {
    const hero = opt.sections.find((s) => s.id === "hero");
    expect(hero, `${slug} tak punya section 'hero'`).toBeDefined();
    expect(hero?.toggle, `${slug}: hero tak boleh bisa disembunyikan`).toBe(
      false,
    );
    expect(hero?.reorder, `${slug}: hero tak boleh bisa dipindah`).toBe(false);
  });

  it("punya `rsvp` yang tak bisa disembunyikan", () => {
    const rsvp = opt.sections.find((s) => s.id === "rsvp");
    expect(rsvp, `${slug} tak punya section 'rsvp'`).toBeDefined();
    expect(rsvp?.toggle).toBe(false);
  });

  it("semua id section ada di kosakata kanonik, atau `x-` + label", () => {
    for (const s of opt.sections) {
      expect(
        isKnownSection(s.id),
        `${slug}: id '${s.id}' di luar kosakata — pakai nama kanonik, atau awali 'x-' bila memang khas tema ini`,
      ).toBe(true);
      if (isThemeSpecificSection(s.id)) {
        expect(
          s.label,
          `${slug}: section khas '${s.id}' wajib punya label sendiri`,
        ).toBeTruthy();
      }
    }
  });

  it("tak ada id section ganda", () => {
    const ids = opt.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("terdaftar lengkap: komponen, demo-data, dan poster katalog", () => {
    // Satu registry yang terlewat = tema yang tampil di katalog tetapi gagal
    // dirender, atau sebaliknya. Tak terlihat sampai ada yang membukanya.
    expect(themeRegistry[slug], `${slug} tak ada di themeRegistry`).toBeTypeOf(
      "function",
    );
    expect(demoDataRegistry[slug], `${slug} tak punya demo-data`).toBeTypeOf(
      "function",
    );
    expect(
      themeCatalogMeta[slug],
      `${slug} tak punya entri catalog-meta`,
    ).toBeDefined();
  });
});

describe("registry tema saling konsisten", () => {
  it("setiap tema di `themeRegistry` punya options", () => {
    const tanpaOptions = Object.keys(themeRegistry).filter(
      (slug) => !themeOptionsRegistry[slug],
    );
    expect(tanpaOptions).toEqual([]);
  });
});

describe("peta label section", () => {
  it("memuat label untuk setiap id kanonik yang DIPAKAI tema", () => {
    const dipakai = new Set(
      themes.flatMap(([, opt]) =>
        opt.sections
          .map((s) => s.id)
          .filter((id) => !isThemeSpecificSection(id)),
      ),
    );
    const tanpaLabel = [...dipakai].filter((id) => !sectionLabels[id]);
    expect(tanpaLabel).toEqual([]);
  });

  it("tak menyimpan label yatim — sinonim lama harus ikut dibuang", () => {
    // Entri yatim membuat sinonim terasa masih sah dan mengundang tema
    // berikutnya memakainya lagi.
    const dipakai = new Set(
      themes.flatMap(([, opt]) => opt.sections.map((s) => s.id)),
    );
    const yatim = Object.keys(sectionLabels).filter((id) => !dipakai.has(id));
    expect(yatim).toEqual([]);
  });
});
/**
 * Slot media (THEME-CONTRACT §2). Editor merender bidang unggah PERSIS dari
 * daftar ini, jadi id yang salah ketik tidak menampilkan galat apa pun — ia
 * hanya membuat bidangnya hilang, atau muncul untuk foto yang tak pernah
 * dirender. Keduanya baru ketahuan dari keluhan pemilik.
 */
describe.each(themes)("slot media tema '%s'", (slug, opt) => {
  const slots = opt.media?.slots ?? [];

  it("id slot dikenal, atau `x-` + label", () => {
    const dikenal = new Set<string>(MEDIA_SLOT_IDS);
    for (const s of slots) {
      const khas = isThemeSpecificSection(s.id);
      expect(
        dikenal.has(s.id) || khas,
        `${slug}: slot media '${s.id}' di luar daftar`,
      ).toBe(true);
      if (khas) {
        expect(
          s.label,
          `${slug}: slot khas '${s.id}' wajib punya label`,
        ).toBeTruthy();
      }
    }
  });

  it("rasio wadah masuk akal", () => {
    // Di luar 0,4–2,5 hampir pasti salah tulis (mis. 400/5 alih-alih 4/5), dan
    // akibatnya bingkai penyesuaian di editor tak menyerupai tema sama sekali.
    for (const s of slots) {
      expect(s.aspect, `${slug}: aspect slot '${s.id}'`).toBeGreaterThan(0.4);
      expect(s.aspect, `${slug}: aspect slot '${s.id}'`).toBeLessThan(2.5);
    }
  });

  it("tak ada id slot ganda", () => {
    const ids = slots.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("deklarasi slot dan render foto berjalan bersama", () => {
    // Docstring di atas sudah menyebut kedua kegagalannya; yang dijaga baru
    // ejaan id-nya. Ini menutup SIMETRINYA, dan keduanya senyap:
    //
    //  · deklarasi TANPA render → bidang unggah muncul di editor, pemilik
    //    mengunggah foto mempelainya, dan foto itu tak pernah tampil di
    //    undangan. Tak ada galat; pemilik menyangka dirinya salah pakai.
    //  · render TANPA deklarasi → tema menggambar wadah foto yang tak akan
    //    pernah terisi, karena bidang unggahnya tak pernah dirender. Inilah
    //    keadaan `aria` dan `lumina` sampai 15 Okt 2026: keduanya punya
    //    section mempelai lengkap, tetapi fotonya mustahil dipasang.
    //
    // Dipindai SELURUH `.tsx` tema, bukan hanya `sections.tsx` — tema boleh
    // merender fotonya dari berkas lain, dan pemindaian yang terlalu sempit
    // akan menuduh tema yang sehat.
    const dir = join(process.cwd(), "src", "themes", slug);
    const merender = readdirSync(dir)
      .filter((f) => f.endsWith(".tsx"))
      .some((f) => readFileSync(join(dir, f), "utf8").includes("fotoStyle"));

    expect(
      slots.length > 0,
      merender
        ? `${slug}: merender foto tetapi tak mendeklarasikan slot media — bidang unggahnya tak akan pernah muncul`
        : `${slug}: mendeklarasikan slot media tetapi tak merender foto — unggahan pemilik tak akan pernah tampil`,
    ).toBe(merender);
  });
});

describe("seed katalog", () => {
  it("setiap tema di registry punya baris seed `themes`", () => {
    // Tema yang kodenya ada tetapi barisnya tak pernah di-seed TIDAK akan
    // gagal apa pun: ia hanya tak punya `theme_id`, jadi tak bisa dipilih saat
    // membuat undangan dan tak muncul di katalog — tanpa satu pun galat.
    const dir = join(process.cwd(), "supabase", "migrations");
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .join("\n");

    const tanpaSeed = Object.keys(themeRegistry).filter(
      (slug) => !sql.includes(`'${slug}'`),
    );
    expect(tanpaSeed).toEqual([]);
  });
});

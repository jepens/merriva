/**
 * Validator server `settings.custom` (CUSTOMIZER-SPEC §5) — Zod, dibangun
 * DARI options schema tema (satu sumber kebenaran). Whitelist ketat:
 * nilai di luar schema DITOLAK, bukan "dibersihkan diam-diam".
 *
 * Keamanan: `accent` dirender ke CSS variable → hex divalidasi regex ketat
 * (cegah injeksi CSS). Gating paket ditegakkan DI SINI (server), bukan UI.
 *
 * Pemakaian di server action:
 *   const schema = buildCustomSettingsSchema(getThemeOptions(slug), { premium });
 *   const custom = schema.parse(input); // lempar 400 bila gagal
 */
import { z } from "zod";

import type { CustomSettings, ThemeOptions } from "./theme-options";

const HEX_RE = /^#[0-9a-f]{6}$/i;

export interface GatingContext {
  /** true bila paket undangan = Premium (packages.limits). */
  premium: boolean;
}

export function buildCustomSettingsSchema(
  options: ThemeOptions,
  { premium }: GatingContext,
) {
  const variantIds = options.variants.map((v) => v.id);
  const allFontIds = options.fontPairs.map((f) => f.id);
  /** Basic hanya boleh pasangan font bawaan (index 0). */
  const allowedFontIds = premium ? allFontIds : allFontIds.slice(0, 1);
  const sectionIds = options.sections.map((s) => s.id);

  const sectionEntry = z.strictObject({
    id: z.string().refine((id) => sectionIds.includes(id), {
      message: "section tidak dikenal tema ini",
    }),
    visible: z.boolean(),
  });

  const stylesShape: Record<string, z.ZodType<string>> = {};
  for (const [key, values] of Object.entries(options.styles)) {
    /** Basic hanya boleh gaya bawaan (index 0). */
    const allowed = premium ? [...values] : [...values.slice(0, 1)];
    stylesShape[key] = z.string().refine((v) => allowed.includes(v), {
      message: `gaya '${key}' tidak diizinkan untuk paket/tema ini`,
    });
  }

  return z
    .strictObject({
      v: z.literal(1),
      variant: z.string().refine((v) => variantIds.includes(v), {
        message: "varian tidak dikenal tema ini",
      }),
      accent: z
        .string()
        .regex(HEX_RE, "warna aksen harus format #rrggbb")
        .nullable(),
      fontPair: z.string().refine((f) => allowedFontIds.includes(f), {
        message: "pasangan font tidak diizinkan untuk paket/tema ini",
      }),
      sections: z.array(sectionEntry),
      styles: z.strictObject(stylesShape),
      motion: z.enum(["full", "calm"]),
      grain: z.boolean(),
    })
    .superRefine((val, ctx) => {
      // accent custom: hanya Premium DAN tema mendukung
      if (val.accent !== null) {
        if (!options.supports.customAccent) {
          ctx.addIssue({
            code: "custom",
            path: ["accent"],
            message: "tema ini tidak mendukung warna aksen custom",
          });
        } else if (!premium) {
          ctx.addIssue({
            code: "custom",
            path: ["accent"],
            message: "warna aksen custom khusus paket Premium",
          });
        }
      }
      // motion/grain hanya bila didukung tema (nilai non-default ditolak)
      if (!options.supports.motion && val.motion !== "full") {
        ctx.addIssue({
          code: "custom",
          path: ["motion"],
          message: "tema ini tidak mendukung pengaturan motion",
        });
      }
      if (!options.supports.grain && val.grain !== true) {
        ctx.addIssue({
          code: "custom",
          path: ["grain"],
          message: "tema ini tidak mendukung pengaturan corak",
        });
      }
      // sections harus PERMUTASI LENGKAP (tanpa duplikat, tanpa yang hilang)
      const seen = new Set(val.sections.map((s) => s.id));
      if (
        val.sections.length !== sectionIds.length ||
        seen.size !== sectionIds.length ||
        !sectionIds.every((id) => seen.has(id))
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["sections"],
          message: "sections harus memuat semua section tema tepat satu kali",
        });
        return; // aturan posisi/visibilitas di bawah butuh permutasi valid
      }
      for (const opt of options.sections) {
        const idx = val.sections.findIndex((s) => s.id === opt.id);
        const entry = val.sections[idx];
        if (!entry) continue;
        if (!opt.toggle && !entry.visible) {
          ctx.addIssue({
            code: "custom",
            path: ["sections", idx, "visible"],
            message: `section '${opt.id}' wajib tampil`,
          });
        }
        if (!opt.reorder) {
          const originalIdx = sectionIds.indexOf(opt.id);
          if (idx !== originalIdx) {
            ctx.addIssue({
              code: "custom",
              path: ["sections", idx],
              message: `section '${opt.id}' tidak boleh dipindah`,
            });
          }
        }
      }
    });
}

/** Parse + ketik hasil sebagai CustomSettings (bentuk §2). */
export function parseCustomSettings(
  options: ThemeOptions,
  gating: GatingContext,
  input: unknown,
): CustomSettings {
  return buildCustomSettingsSchema(options, gating).parse(
    input,
  ) as CustomSettings;
}

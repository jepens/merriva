import type { ComponentType } from "react";

import type { InvitationData } from "@/types/invitation";

/**
 * Kontrak sistem tema (SPEC §7.1 / ARCHITECTURE §5).
 * Komponen tema menerima props hasil parse Zod dari `invitations.content`
 * (tipe `InvitationData` di `@/types/invitation`) dan DILARANG mengambil data
 * sendiri. Mengubah kontrak props = keputusan "tanya dulu" (berdampak semua tema).
 */
export type { InvitationData };

export interface ThemeComponentProps {
  data: InvitationData;
}

export interface ThemeModule {
  default: ComponentType<ThemeComponentProps>;
}

/**
 * Registry tema: slug tema (= folder `src/themes/{slug}/`) → dynamic import komponen.
 * Menambah tema = tambah folder + satu baris di sini + seed metadata `themes`.
 * Tema pertama (`eternal-rose`, wedding) ditambahkan di M1.5.
 */
export const themeRegistry: Record<string, () => Promise<ThemeModule>> = {
  "eternal-rose": () => import("./eternal-rose"),
  meridian: () => import("./meridian"),
  barakah: () => import("./barakah"),
};

export function getThemeLoader(
  slug: string,
): (() => Promise<ThemeModule>) | null {
  return themeRegistry[slug] ?? null;
}

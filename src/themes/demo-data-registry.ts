import type { InvitationData } from "@/types/invitation";

/**
 * Registry data contoh per tema (untuk katalog & pratinjau `/preview/tema/{slug}`).
 * Sejalan dgn `themeRegistry` — tiap tema menyimpan `demo-data.ts` kategori yang
 * sesuai (wedding/corporate/family) agar showcase menampilkan konten realistis.
 */
export const demoDataRegistry: Record<
  string,
  () => Promise<{ demoInvitationData: InvitationData }>
> = {
  "eternal-rose": () => import("./eternal-rose/demo-data"),
  meridian: () => import("./meridian/demo-data"),
  barakah: () => import("./barakah/demo-data"),
  aria: () => import("./aria/demo-data"),
  verdant: () => import("./verdant/demo-data"),
  noir: () => import("./noir/demo-data"),
  festa: () => import("./festa/demo-data"),
  lumina: () => import("./lumina/demo-data"),
};

export function getThemeDemoLoader(
  slug: string,
): (() => Promise<{ demoInvitationData: InvitationData }>) | null {
  return demoDataRegistry[slug] ?? null;
}

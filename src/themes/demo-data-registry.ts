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
  prisma: () => import("./prisma/demo-data"),
  kirana: () => import("./kirana/demo-data"),
  priangan: () => import("./priangan/demo-data"),
  marawa: () => import("./marawa/demo-data"),
  sakinah: () => import("./sakinah/demo-data"),
  meihua: () => import("./meihua/demo-data"),
  warta: () => import("./warta/demo-data"),
};

export function getThemeDemoLoader(
  slug: string,
): (() => Promise<{ demoInvitationData: InvitationData }>) | null {
  // `hasOwn`: slug dari URL; kunci warisan (`constructor` dst.) bukan tema.
  return Object.hasOwn(demoDataRegistry, slug) ? demoDataRegistry[slug] : null;
}

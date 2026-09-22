/**
 * Tautan ke editor undangan, opsional langsung membuka satu langkah lewat
 * `?langkah=` (DECISIONS #44). SATU tempat untuk pemetaan nama langkah di URL
 * (bahasa Indonesia, seperti rute dashboard lainnya) → kunci langkah editor,
 * supaya halaman yang menautkan dan editor yang membacanya tak bisa berselisih.
 *
 * Sengaja tanpa impor: dipakai halaman server dan aman di bundle klien.
 */
const STEP_PARAMS = {
  jadwal: "schedule",
} as const;

export type EditorStepParam = keyof typeof STEP_PARAMS;

export function editorHref(
  invitationId: string,
  langkah?: EditorStepParam,
): string {
  const base = `/dashboard/undangan/${invitationId}/edit`;
  return langkah ? `${base}?langkah=${langkah}` : base;
}

/**
 * Nilai `?langkah=` → kunci langkah editor, atau `undefined` bila tak dikenal
 * (editor lalu membuka langkah pertama seperti biasa). Hanya string tunggal
 * yang diterima; `?langkah=a&langkah=b` (array) diabaikan.
 */
export function stepKeyFromParam(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return Object.hasOwn(STEP_PARAMS, value)
    ? STEP_PARAMS[value as EditorStepParam]
    : undefined;
}

/**
 * Penyusun `appearance.style` (CSS var) dari peta `preview.vars` sebuah tema +
 * hasil `resolveAppearance`. Dipakai BERSAMA render server (theme `index.tsx`)
 * dan editor pratinjau (Fase G) → SATU sumber pemetaan token→CSS var, sehingga
 * pratinjau editor mustahil menyimpang (drift) dari render publik. Kunci var
 * custom (`--x`) di-cast ke `CSSProperties` (React mengizinkan properti custom).
 */
import type { CSSProperties } from "react";

import type { ResolvedAppearance } from "./resolve";
import type { PreviewVar, PreviewVarToken } from "./theme-options";

function tokenValue(token: PreviewVarToken, r: ResolvedAppearance): string {
  switch (token) {
    case "accent":
      return r.accent;
    case "accentText":
      return r.accentText;
    case "onAccent":
      return r.onAccent;
    case "paper":
      return r.paper;
    case "ink":
      return r.ink;
    case "disp":
      return r.dispVar;
    case "body":
      return r.bodyVar;
  }
}

export function appearanceStyle(
  vars: readonly PreviewVar[],
  r: ResolvedAppearance,
): CSSProperties {
  const style: Record<string, string> = {};
  for (const v of vars) style[v.name] = tokenValue(v.token, r);
  return style as CSSProperties;
}

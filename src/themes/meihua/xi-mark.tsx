/**
 * 囍 dipakai dua sisi: cover (klien) dan sections (server). Sengaja berkas
 * sendiri tanpa impor: selama `XiMark` tinggal di `sections.tsx`, impor dari
 * `cover.tsx` ("use client") menyeret SELURUH modul sections beserta
 * dependensinya ke JS klien. Komponen klien semua tema berbagi entry
 * `/[slug]`, jadi setiap undangan — apa pun temanya — ikut menanggungnya:
 * +35,5 KB gz (85,9 vs 50,4 KB; `pnpm bundle:report`, 1 Nov 2026).
 */

/** 囍 (shuāngxǐ) line-art — selalu SVG, selalu utuh (THEME-WAVE3 §3.4). */
export function XiMark({ className }: { className?: string }) {
  return (
    <svg
      className={`mh-xi${className ? ` ${className}` : ""}`}
      viewBox="0 0 196 196"
      aria-hidden
      focusable="false"
    >
      <g>
        <path d="M54 50 H90 M72 42 V58" />
        <path d="M58 70 H86" />
        <path d="M62 80 H82 V92 H62 Z" />
        <path d="M52 102 H92" />
        <path d="M62 108 L58 114 M82 108 L86 114" />
        <path d="M60 120 H84 V144 H60 Z" />
      </g>
      <g>
        <path d="M106 50 H142 M124 42 V58" />
        <path d="M110 70 H138" />
        <path d="M114 80 H134 V92 H114 Z" />
        <path d="M104 102 H144" />
        <path d="M114 108 L110 114 M134 108 L138 114" />
        <path d="M112 120 H136 V144 H112 Z" />
      </g>
      <path d="M92 132 H104" />
    </svg>
  );
}

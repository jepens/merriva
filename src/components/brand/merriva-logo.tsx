import type { SVGProps } from "react";

/**
 * Logo Merriva — mark "Gerbang" (dua lengkungan + titik marigold) dan wordmark.
 *
 * SVG INLINE, bukan `<img>`, supaya warnanya mengikuti konteks lewat CSS:
 * wordmark memakai `currentColor`, sedangkan tile / goresan / titik membaca
 * `--mrv-logo-tile`, `--mrv-logo-stroke`, `--mrv-logo-dot` (default: tile plum,
 * goresan krem, titik marigold). `.mrv-band-dark` di marketing.css membalik
 * tile menjadi krem — satu komponen untuk header, footer, panel auth, dashboard.
 *
 * Huruf sudah DI-OUTLINE (Bricolage Grotesque 700, opsz 64) sehingga logo tidak
 * bergantung pada font termuat dan identik dengan master
 * `public/brand/merriva-logo.svg`. Angka path di bawah berasal dari master itu —
 * bila logonya berubah, ganti dari master (lihat `public/brand/README.md`),
 * jangan disunting manual.
 *
 * Nama aksesibel: default `aria-hidden` karena pemakainya adalah `<Link>` yang
 * sudah ber-`aria-label`; beri `title` bila SVG berdiri sendiri.
 */

type Variant = "lockup" | "mark" | "wordmark";

interface MerrivaLogoProps extends Omit<
  SVGProps<SVGSVGElement>,
  "height" | "width"
> {
  /** `lockup` = ikon + wordmark (default) · `mark` = ikon saja · `wordmark` = teks saja. */
  variant?: Variant;
  /** Tinggi dalam px; lebar mengikuti rasio. Default mengikuti CSS (`.mrv-brand svg`). */
  height?: number;
  /** Nama aksesibel bila logo berdiri sendiri (tanpa induk ber-label). */
  title?: string;
}

const LOCKUP_W = 476.79;
const LOCKUP_H = 102.56;
const TILE_SCALE = 1.6025;
const WORDMARK_BOX = {
  x: 138.26,
  y: 15.17,
  w: 338.53,
  h: 72.22,
};

const MARK_PATH =
  "M12.5 51V31.5a9.75 9.75 0 0 1 19.5 0V51M32 31.5a9.75 9.75 0 0 1 19.5 0V51";
const WORDMARK_LETTERS =
  "M138.29 87.39V57.38L138.26 34.88H150.3L150.06 54.59H151.33Q152.29 47.11 154.43 42.48Q156.58 37.85 159.99 35.67Q163.39 33.49 168.07 33.49Q172.99 33.49 176.1 35.85Q179.2 38.21 180.76 42.87Q182.32 47.53 182.37 54.56H183.52Q184.5 47.11 186.82 42.49Q189.14 37.86 192.74 35.68Q196.34 33.49 201.07 33.49Q205.26 33.49 208.36 35.08Q211.46 36.66 213.56 39.8Q215.67 42.95 216.7 47.7Q217.73 52.45 217.73 58.75V87.39H203.29V60.28Q203.29 55.51 202.5 52.35Q201.7 49.19 200.07 47.64Q198.43 46.09 195.87 46.09Q192.7 46.09 190.28 48.56Q187.85 51.02 186.46 55.65Q185.07 60.29 185.01 66.87V87.39H170.92V60.18Q170.92 55.37 170.09 52.28Q169.26 49.19 167.59 47.64Q165.92 46.09 163.39 46.09Q160.28 46.09 157.9 48.41Q155.52 50.72 154.13 55.37Q152.74 60.01 152.69 66.91V87.39ZM250.02 88.77Q243.12 88.77 238.13 86.8Q233.14 84.83 229.88 81.24Q226.61 77.65 225.03 72.78Q223.45 67.91 223.45 62.1Q223.45 56.19 225.03 51Q226.62 45.81 229.79 41.88Q232.96 37.94 237.78 35.72Q242.6 33.49 249.04 33.49Q255.33 33.49 260.01 35.62Q264.7 37.76 267.68 41.73Q270.66 45.7 271.82 51.17Q272.97 56.65 272.22 63.37L232.58 63.87V55.83L262.3 55.4L259.07 59.84Q259.63 54.91 258.54 51.58Q257.45 48.25 255.05 46.56Q252.66 44.86 249.09 44.86Q245.18 44.86 242.54 46.89Q239.9 48.93 238.61 52.67Q237.33 56.41 237.33 61.58Q237.33 70.01 240.64 74.03Q243.96 78.04 250.09 78.04Q252.89 78.04 254.77 77.28Q256.65 76.53 257.83 75.23Q259.02 73.94 259.58 72.25Q260.14 70.57 260.24 68.72L273.2 70.26Q273.02 73.85 271.68 77.16Q270.33 80.47 267.58 83.08Q264.83 85.68 260.5 87.23Q256.17 88.77 250.02 88.77ZM279.28 87.39V60.63L279.26 34.88H291.6L291.38 55.13H292.65Q293.32 47.36 295.16 42.66Q297.01 37.95 300.07 35.82Q303.13 33.68 307.3 33.68Q308.69 33.68 310.23 34Q311.78 34.31 313.43 35.04L312.75 50.69Q310.88 49.71 308.99 49.27Q307.1 48.82 305.48 48.82Q301.88 48.82 299.33 50.79Q296.78 52.75 295.35 56.54Q293.92 60.34 293.66 65.78V87.39ZM318.28 87.39V60.63L318.26 34.88H330.6L330.38 55.13H331.65Q332.32 47.36 334.16 42.66Q336.01 37.95 339.07 35.82Q342.13 33.68 346.3 33.68Q347.69 33.68 349.23 34Q350.78 34.31 352.43 35.04L351.75 50.69Q349.88 49.71 347.99 49.27Q346.1 48.82 344.48 48.82Q340.88 48.82 338.33 50.79Q335.78 52.75 334.35 56.54Q332.92 60.34 332.66 65.78V87.39ZM357.29 87.39V34.88H371.69V87.39ZM392.83 87.39 375.82 34.92H391.41L402.12 75.6H403L413.93 34.92H428.77L411.73 87.39ZM443.4 88.77Q439.25 88.77 435.75 87.24Q432.25 85.71 430.13 82.49Q428.02 79.28 428.02 74.21Q428.02 69.6 429.79 66.62Q431.56 63.65 434.74 61.82Q437.93 59.99 442.09 58.94Q446.25 57.88 450.99 57.11Q455.46 56.31 457.87 55.77Q460.27 55.23 461.24 54.32Q462.2 53.42 462.2 51.74Q462.2 48.57 459.94 46.7Q457.68 44.83 453.63 44.83Q451.08 44.83 448.67 45.76Q446.26 46.69 444.64 48.8Q443.01 50.92 442.72 54.51L429.87 52.36Q430.32 47.09 432.45 43.48Q434.58 39.86 437.97 37.66Q441.36 35.46 445.51 34.48Q449.65 33.49 454.06 33.49Q461.56 33.49 466.48 36.14Q471.4 38.79 473.85 44.03Q476.3 49.27 476.3 57.09V66.38Q476.31 69.82 476.37 73.36Q476.43 76.9 476.54 80.41Q476.64 83.92 476.79 87.39H464.11Q464.01 84.06 463.92 80.46Q463.82 76.85 463.79 72.93H462.69Q461.85 77.3 459.25 80.91Q456.65 84.52 452.63 86.64Q448.61 88.77 443.4 88.77ZM449.24 78.17Q451.23 78.17 453.34 77.42Q455.45 76.66 457.33 75.1Q459.22 73.54 460.56 71.05Q461.89 68.57 462.3 65.15L462.25 60.44L464.77 60.36Q463.52 61.7 461.37 62.48Q459.21 63.26 456.68 63.7Q454.14 64.14 451.6 64.62Q449.05 65.1 446.94 65.91Q444.82 66.73 443.54 68.13Q442.25 69.53 442.25 71.98Q442.25 74.91 444.22 76.54Q446.19 78.17 449.24 78.17Z";
const WORDMARK_TITTLE =
  "M364.45 29.11Q360.25 29.11 358.03 27.33Q355.81 25.55 355.81 22.17Q355.81 18.72 358.03 16.94Q360.26 15.17 364.45 15.17Q368.73 15.17 370.95 16.97Q373.17 18.77 373.17 22.18Q373.17 25.49 370.94 27.3Q368.72 29.11 364.45 29.11Z";

function Mark({ scaled }: { scaled: boolean }) {
  return (
    <g transform={scaled ? `scale(${TILE_SCALE})` : undefined}>
      <rect
        width="64"
        height="64"
        rx="14"
        fill="var(--mrv-logo-tile, #241f2b)"
      />
      <path
        d={MARK_PATH}
        fill="none"
        stroke="var(--mrv-logo-stroke, #efe7da)"
        strokeWidth="6.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32.0" cy="14.0" r="5.2" fill="var(--mrv-logo-dot, #c68a3c)" />
    </g>
  );
}

function Wordmark() {
  return (
    <>
      <path d={WORDMARK_LETTERS} fill="currentColor" />
      <path d={WORDMARK_TITTLE} fill="var(--mrv-logo-dot, #c68a3c)" />
    </>
  );
}

export function MerrivaLogo({
  variant = "lockup",
  height,
  title,
  ...rest
}: MerrivaLogoProps) {
  const viewBox =
    variant === "mark"
      ? "0 0 64 64"
      : variant === "wordmark"
        ? `${WORDMARK_BOX.x} ${WORDMARK_BOX.y} ${WORDMARK_BOX.w} ${WORDMARK_BOX.h}`
        : `0 0 ${LOCKUP_W} ${LOCKUP_H}`;
  const ratio =
    variant === "mark"
      ? 1
      : variant === "wordmark"
        ? WORDMARK_BOX.w / WORDMARK_BOX.h
        : LOCKUP_W / LOCKUP_H;
  const size =
    height === undefined
      ? {}
      : { height, width: Math.round(height * ratio * 100) / 100 };
  const a11y = title
    ? { role: "img" as const }
    : { "aria-hidden": true as const, focusable: "false" as const };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      {...size}
      {...a11y}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {variant === "mark" ? (
        <Mark scaled={false} />
      ) : variant === "wordmark" ? (
        <Wordmark />
      ) : (
        <>
          <Mark scaled />
          <Wordmark />
        </>
      )}
    </svg>
  );
}

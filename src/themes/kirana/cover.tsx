"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { useCoverGate } from "@/themes/_shared/cover-gate";
import { pasangPengepasSampul } from "@/themes/_shared/fit-names";

import { L } from "./labels";

function Line({ children }: { children: ReactNode }) {
  return (
    <span className="kr-line">
      <span>{children}</span>
    </span>
  );
}

// Path gunungan (kayon) line-art — disederhanakan & simetris dari prototipe.
const GUNUNGAN_OUTER =
  "M125 8 C 112 30 96 42 84 62 C 70 84 76 104 66 126 C 56 150 64 172 58 196 C 52 222 66 250 92 268 C 106 278 116 284 125 292 C 134 284 144 278 158 268 C 184 250 198 222 192 196 C 186 172 194 150 184 126 C 174 104 180 84 166 62 C 154 42 138 30 125 8 Z";
const GUNUNGAN_INNER =
  "M125 34 C 117 50 106 60 98 76 C 88 94 93 110 85 128 C 77 148 84 166 79 186 C 74 208 86 232 106 248 C 114 254 120 260 125 266 C 130 260 136 254 144 248 C 164 232 176 208 171 186 C 166 166 173 148 165 128 C 157 110 162 94 152 76 C 144 60 133 50 125 34 Z";
const GUNUNGAN_STEM =
  "M125 292 V 240 M105 250 C 112 238 118 236 125 226 C 132 236 138 238 145 250";

/**
 * Visual cover Kirana (klien) — gunungan (kayon) line-art menggambar diri +
 * nama mempelai di dalamnya, latar pola truntum. Membaca `useCoverGate()` untuk
 * nama tamu & aksi buka. Entrance DIMILIKI JS via WAAPI (sinkron saat mount →
 * tak menunggu gsap; LCP aman), digerbangi `motionOn`. TANPA WebGL (tier Story).
 * Wipe cover (clip-path) digerakkan CSS `.is-open` di cover-gate.
 */
export function KiranaCover({
  brideName,
  groomName,
  dateLabel,
}: {
  brideName: string;
  groomName: string;
  dateLabel: string | null;
}) {
  const { open, opened, recipientName, motionOn } = useCoverGate();
  const innerRef = useRef<HTMLDivElement>(null);
  const gununganRef = useRef<SVGSVGElement>(null);

  // Mask-reveal baris (translateY) — state tersembunyi dimiliki JS (§0.4).
  useEffect(() => {
    if (!motionOn) return;
    const root = innerRef.current;
    if (!root) return;
    const spans = root.querySelectorAll<HTMLElement>(".kr-line > span");
    const anims: Animation[] = [];
    spans.forEach((el, i) => {
      el.style.visibility = "visible";
      anims.push(
        el.animate(
          [{ transform: "translateY(150%)" }, { transform: "translateY(0)" }],
          {
            duration: 1050,
            easing: "cubic-bezier(0.22,1,0.36,1)",
            fill: "both",
            delay: 900 + i * 90,
          },
        ),
      );
    });
    return () => anims.forEach((a) => a.cancel());
  }, [motionOn]);

  // Gunungan menggambar diri (strokeDashoffset L → 0).
  useEffect(() => {
    if (!motionOn) return;
    const svg = gununganRef.current;
    if (!svg) return;
    const paths = svg.querySelectorAll<SVGPathElement>("path");
    const anims: Animation[] = [];
    paths.forEach((p, i) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
      anims.push(
        p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], {
          duration: 2200,
          easing: "cubic-bezier(0.65,0,0.35,1)",
          fill: "both",
          delay: 200 + i * 250,
        }),
      );
    });
    return () => anims.forEach((a) => a.cancel());
  }, [motionOn]);

  // Nama yang lebih lebar dari tengah gunungan pada ukuran desain terpotong
  // masker `.kr-line` — kecilkan HANYA nama itu; nama yang membungkus sampai
  // lebih tinggi dari tengah gunungan dikecilkan bersama (_shared/fit-names.ts).
  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    return pasangPengepasSampul(
      inner,
      () =>
        Array.from(inner.querySelectorAll<HTMLElement>(".kr-gn-name"))
          .map((el) => [el, el.querySelector<HTMLElement>(".kr-line")] as const)
          .filter(
            (p): p is readonly [HTMLElement, HTMLElement] => p[1] !== null,
          ),
      brideName + groomName,
      inner.querySelector<HTMLElement>(".kr-gn-center"),
    );
  }, [brideName, groomName]);

  return (
    <>
      <div className="kr-truntum" aria-hidden />
      <div className="kr-cover__inner" ref={innerRef}>
        <p className="kr-cover__eyebrow">
          <Line>{L.cover.eyebrow}</Line>
        </p>

        <div className="kr-gunungan-wrap">
          <svg
            className="kr-gunungan"
            ref={gununganRef}
            viewBox="0 0 250 300"
            aria-hidden
          >
            <path d={GUNUNGAN_OUTER} />
            <path className="kr-gn-sg" d={GUNUNGAN_INNER} />
            <path className="kr-gn-sg" d={GUNUNGAN_STEM} />
          </svg>
          <div className="kr-gn-center">
            <span className="kr-gn-name">
              <Line>{brideName}</Line>
            </span>
            <span className="kr-line">
              <span className="kr-gn-amp">&amp;</span>
            </span>
            <span className="kr-gn-name">
              <Line>{groomName}</Line>
            </span>
          </div>
        </div>

        {dateLabel ? (
          <p className="kr-cover__date">
            <Line>{dateLabel}</Line>
          </p>
        ) : null}

        <div className="kr-guest">
          <small>{L.cover.recipient}</small>
          <strong>{recipientName ?? L.cover.recipientFallback}</strong>
        </div>

        <Line>
          <button
            type="button"
            className="kr-open"
            onClick={open}
            tabIndex={opened ? -1 : 0}
          >
            {L.cover.open}
          </button>
        </Line>
        <p className="kr-cover__hint">{L.cover.hint}</p>
      </div>
    </>
  );
}

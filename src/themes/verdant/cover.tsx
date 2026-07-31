"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { copy } from "@/lib/copy";
import { useCoverGate } from "@/themes/_shared/cover-gate";

import { L } from "./labels";

function Line({ children }: { children: ReactNode }) {
  return (
    <span className="vd-line">
      <span>{children}</span>
    </span>
  );
}

/**
 * Visual cover Verdant (klien) — halaman buku sketsa: wreath botani SVG yang
 * MENGGAMBAR DIRINYA saat entrance (sekali, bukan scrub), lalu nama mask-reveal.
 * Semua entrance DIMILIKI JS via WAAPI (sinkron saat mount → LCP aman, tanpa
 * gsap). TANPA WebGL (tier Story). Wipe cover digerakkan CSS `.is-open`.
 */
export function VerdantCover({
  groomName,
  brideName,
  dateLabel,
}: {
  groomName: string;
  brideName: string;
  dateLabel: string | null;
}) {
  const { open, opened, recipientName, motionOn } = useCoverGate();
  const innerRef = useRef<HTMLDivElement>(null);
  const wreathRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!motionOn) return;
    const anims: Animation[] = [];

    // Wreath menggambar diri (strokeDashoffset L → 0), berlapis.
    const paths = wreathRef.current?.querySelectorAll<SVGPathElement>("path");
    paths?.forEach((p, i) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
      anims.push(
        p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], {
          duration: 2100,
          easing: "cubic-bezier(0.65,0,0.35,1)",
          fill: "both",
          delay: 200 + i * 120,
        }),
      );
    });

    // Nama mask-reveal setelah wreath mulai tumbuh.
    const spans =
      innerRef.current?.querySelectorAll<HTMLElement>(".vd-line > span");
    spans?.forEach((el, i) => {
      el.style.visibility = "visible";
      anims.push(
        el.animate(
          [{ transform: "translateY(115%)" }, { transform: "translateY(0)" }],
          {
            duration: 1100,
            easing: "cubic-bezier(0.22,1,0.36,1)",
            fill: "both",
            delay: 900 + i * 90,
          },
        ),
      );
    });

    return () => anims.forEach((a) => a.cancel());
  }, [motionOn]);

  const c = copy.public.cover;

  return (
    <div className="vd-cover__inner" ref={innerRef}>
      <span className="vd-eyebrow vd-eyebrow--sage">
        <Line>{L.cover.eyebrow}</Line>
      </span>
      <div className="vd-cover__wreathwrap">
        <svg
          className="vd-wreath"
          viewBox="0 0 300 300"
          aria-hidden
          focusable="false"
          ref={wreathRef}
        >
          <path d="M150 22 C 80 22, 26 76, 26 150 C 26 200, 52 244, 96 266" />
          <path d="M150 22 C 220 22, 274 76, 274 150 C 274 200, 248 244, 204 266" />
          <path d="M60 84 q -18 -4 -24 -20 q 20 -2 24 20 M40 130 q -20 2 -30 -12 q 18 -8 30 12 M36 182 q -18 8 -32 0 q 12 -16 32 0" />
          <path d="M240 84 q 18 -4 24 -20 q -20 -2 -24 20 M260 130 q 20 2 30 -12 q -18 -8 -30 12 M264 182 q 18 8 32 0 q -12 -16 -32 0" />
          <path
            className="vd-terra"
            d="M96 266 q 8 14 26 16 q -2 -18 -26 -16 M204 266 q -8 14 -26 16 q 2 -18 26 -16"
          />
          <path
            className="vd-terra"
            d="M150 290 m -7 0 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0"
          />
        </svg>
        <div className="vd-cover__center">
          <span className="vd-cover__name">
            <Line>{groomName}</Line>
          </span>
          <span className="vd-cover__amp">
            <Line>&amp;</Line>
          </span>
          <span className="vd-cover__name">
            <Line>{brideName}</Line>
          </span>
        </div>
      </div>
      {dateLabel ? (
        <p className="vd-cover__date">
          <Line>{dateLabel}</Line>
        </p>
      ) : null}
      <div className="vd-guest">
        <small>{c.recipient}</small>
        <strong>{recipientName ?? c.recipientFallback}</strong>
      </div>
      <Line>
        <button
          type="button"
          className="vd-open"
          onClick={open}
          tabIndex={opened ? -1 : 0}
        >
          {L.cover.open}
        </button>
      </Line>
      <p className="vd-cover__hint">{L.cover.hint}</p>
    </div>
  );
}

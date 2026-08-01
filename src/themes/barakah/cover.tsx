"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { copy } from "@/lib/copy";
import { useCoverGate } from "@/themes/_shared/cover-gate";

import { L } from "./labels";

function Line({ children }: { children: ReactNode }) {
  return (
    <span className="bk-line">
      <span>{children}</span>
    </span>
  );
}

/**
 * Visual cover Barakah (klien) — lengkung mihrab (ogee arch) + bintang segi-8
 * (khatam) yang MENGGAMBAR DIRINYA saat entrance, lalu nama mask-reveal. Semua
 * entrance DIMILIKI JS via WAAPI (sinkron saat mount → LCP aman, tanpa gsap).
 * TANPA WebGL (tier Story). Wipe cover (clip-path) digerakkan CSS `.is-open`.
 */
export function BarakahCover({
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
  const archRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!motionOn) return;
    const anims: Animation[] = [];

    // Lengkung mihrab + bintang khatam menggambar diri (strokeDashoffset L → 0).
    const shapes = archRef.current?.querySelectorAll<
      SVGPathElement | SVGRectElement | SVGCircleElement
    >("path, rect, circle");
    shapes?.forEach((s, i) => {
      const len = s.getTotalLength();
      if (!len) return;
      s.style.strokeDasharray = String(len);
      s.style.strokeDashoffset = String(len);
      anims.push(
        s.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], {
          duration: 1900,
          easing: "cubic-bezier(0.65,0,0.35,1)",
          fill: "both",
          delay: 200 + i * 90,
        }),
      );
    });

    // Nama mask-reveal setelah lengkung mulai tergambar.
    const spans =
      innerRef.current?.querySelectorAll<HTMLElement>(".bk-line > span");
    spans?.forEach((el, i) => {
      el.style.visibility = "visible";
      anims.push(
        el.animate(
          [{ transform: "translateY(115%)" }, { transform: "translateY(0)" }],
          {
            duration: 1050,
            easing: "cubic-bezier(0.22,1,0.36,1)",
            fill: "both",
            delay: 800 + i * 90,
          },
        ),
      );
    });

    return () => anims.forEach((a) => a.cancel());
  }, [motionOn]);

  const c = copy.public.cover;

  return (
    <div className="bk-cover__inner" ref={innerRef}>
      <span className="bk-bismillah">
        <Line>{L.cover.bismillah}</Line>
      </span>

      <div className="bk-arch">
        <svg
          className="bk-arch__svg"
          viewBox="0 0 280 340"
          aria-hidden
          focusable="false"
          ref={archRef}
        >
          {/* Lengkung mihrab (ogee) luar & dalam */}
          <path d="M28 330 V150 C28 96 62 72 104 56 C124 48 136 36 140 18 C144 36 156 48 176 56 C218 72 252 96 252 150 V330" />
          <path
            className="bk-arch__em"
            d="M44 330 V154 C44 106 74 84 112 69 C128 62 137 52 140 38 C143 52 152 62 168 69 C206 84 236 106 236 154 V330"
          />
          {/* Bintang segi-8 (khatam): dua persegi bertumpuk */}
          <g transform="translate(140 300)">
            <rect x="-16" y="-16" width="32" height="32" />
            <rect
              x="-16"
              y="-16"
              width="32"
              height="32"
              transform="rotate(45)"
            />
          </g>
          <circle className="bk-arch__em" cx="140" cy="300" r="5" />
        </svg>
        <div className="bk-arch__center">
          <span className="bk-cover__name">
            <Line>{groomName}</Line>
          </span>
          <span className="bk-cover__amp">
            <Line>&amp;</Line>
          </span>
          <span className="bk-cover__name">
            <Line>{brideName}</Line>
          </span>
        </div>
      </div>

      {dateLabel ? (
        <p className="bk-cover__date">
          <Line>{dateLabel}</Line>
        </p>
      ) : null}

      <div className="bk-star" aria-hidden>
        <svg viewBox="0 0 24 24">
          <path d="M12 1 L14.5 9.5 L23 12 L14.5 14.5 L12 23 L9.5 14.5 L1 12 L9.5 9.5 Z" />
        </svg>
      </div>

      <div className="bk-guest">
        <small>{c.recipient}</small>
        <strong>{recipientName ?? c.recipientFallback}</strong>
      </div>

      <Line>
        <button
          type="button"
          className="bk-open"
          onClick={open}
          tabIndex={opened ? -1 : 0}
        >
          {L.cover.open}
        </button>
      </Line>
      <p className="bk-cover__hint">{L.cover.hint}</p>
    </div>
  );
}

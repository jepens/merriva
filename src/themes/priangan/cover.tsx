"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { useCoverGate } from "@/themes/_shared/cover-gate";

import { L } from "./labels";

function Line({ children }: { children: ReactNode }) {
  return (
    <span className="pg-line">
      <span>{children}</span>
    </span>
  );
}

/**
 * Visual cover Priangan (klien, tier Story) — SIGER (mahkota pengantin Sunda)
 * line-art berjari runcing menggambar diri + awan Priangan melayang. Entrance
 * DIMILIKI JS via WAAPI (sinkron saat mount, tak menunggu gsap; LCP aman),
 * digerbangi `motionOn`. Wipe cover digerakkan CSS `.is-open` di cover-gate.
 * Budaya (THEME-WAVE3 §3.1): siger — BUKAN gunungan/wayang, BUKAN kujang.
 */
export function PrianganCover({
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
  const sigerRef = useRef<SVGSVGElement>(null);
  const cloudARef = useRef<HTMLSpanElement>(null);
  const cloudBRef = useRef<HTMLSpanElement>(null);

  // Mask-reveal baris — state tersembunyi dimiliki JS (§0.4).
  useEffect(() => {
    if (!motionOn) return;
    const root = innerRef.current;
    if (!root) return;
    const spans = root.querySelectorAll<HTMLElement>(".pg-line > span");
    const anims: Animation[] = [];
    spans.forEach((el, i) => {
      el.style.visibility = "visible";
      anims.push(
        el.animate(
          [{ transform: "translateY(115%)" }, { transform: "translateY(0)" }],
          {
            duration: 1000,
            easing: "cubic-bezier(0.22,1,0.36,1)",
            fill: "both",
            delay: 850 + i * 90,
          },
        ),
      );
    });
    return () => anims.forEach((a) => a.cancel());
  }, [motionOn]);

  // Siger menggambar diri (strokeDashoffset L → 0).
  useEffect(() => {
    if (!motionOn) return;
    const svg = sigerRef.current;
    if (!svg) return;
    const paths = svg.querySelectorAll<SVGPathElement>("path, circle");
    const anims: Animation[] = [];
    paths.forEach((p, i) => {
      const len =
        "getTotalLength" in p && typeof p.getTotalLength === "function"
          ? p.getTotalLength()
          : 60;
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
      anims.push(
        p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], {
          duration: 1400,
          easing: "cubic-bezier(0.65,0,0.35,1)",
          fill: "both",
          delay: 150 + i * 120,
        }),
      );
    });
    return () => anims.forEach((a) => a.cancel());
  }, [motionOn]);

  // Awan melayang (yoyo, transform saja; nilai = prototipe). Bukan tugas fx:
  // gsap baru jalan SETELAH sampul dibuka dan hanya menyapu `.pg-stage`.
  useEffect(() => {
    if (!motionOn) return;
    const anims = [cloudARef.current, cloudBRef.current].map((el, i) =>
      el?.animate(
        [
          { transform: "translate(0, 0)" },
          { transform: `translate(${i % 2 ? -26 : 26}px, 8px)` },
        ],
        {
          duration: 7000 + i * 2000,
          easing: "cubic-bezier(0.37,0,0.63,1)", // ≈ sine.inOut
          iterations: Infinity,
          direction: "alternate",
        },
      ),
    );
    return () => anims.forEach((a) => a?.cancel());
  }, [motionOn]);

  return (
    <>
      <span className="pg-cloud pg-cloud--a" ref={cloudARef} aria-hidden>
        <CloudSvg />
      </span>
      <span className="pg-cloud pg-cloud--b" ref={cloudBRef} aria-hidden>
        <CloudSvg />
      </span>
      <div className="pg-cover__inner" ref={innerRef}>
        <svg
          className="pg-siger"
          ref={sigerRef}
          viewBox="0 0 230 120"
          aria-hidden
        >
          <path d="M22 112 H208" />
          <path d="M115 112 C104 86 106 48 115 16 C124 48 126 86 115 112" />
          <path d="M78 112 C70 94 72 66 82 48 C90 66 90 94 84 112" />
          <path d="M152 112 C160 94 158 66 148 48 C140 66 140 94 146 112" />
          <path d="M46 112 C40 100 42 82 50 70 C56 82 56 100 52 112" />
          <path d="M184 112 C190 100 188 82 180 70 C174 82 174 100 178 112" />
          <circle cx="115" cy="78" r="3.4" />
          <circle cx="81" cy="86" r="2.4" />
          <circle cx="149" cy="86" r="2.4" />
          <path
            d="M58 104 C66 98 74 98 80 104 M150 104 C156 98 164 98 172 104"
            opacity=".75"
          />
        </svg>
        <p className="pg-cover__eyebrow">
          <Line>{L.cover.eyebrow}</Line>
        </p>
        <h1 className="pg-cover__names">
          <Line>{brideName}</Line>
          <span className="pg-line">
            <span className="pg-cover__sareng">sareng</span>
          </span>
          <Line>{groomName}</Line>
        </h1>
        {dateLabel ? (
          <p className="pg-cover__date">
            <Line>{dateLabel}</Line>
          </p>
        ) : null}
        <div className="pg-guest">
          <small>{L.cover.recipient}</small>
          <strong>{recipientName ?? L.cover.recipientFallback}</strong>
        </div>
        <Line>
          <button
            type="button"
            className="pg-open"
            onClick={open}
            tabIndex={opened ? -1 : 0}
          >
            {L.cover.open}
          </button>
        </Line>
        <p className="pg-cover__hint">{L.cover.hint}</p>
      </div>
    </>
  );
}

function CloudSvg() {
  return (
    <svg viewBox="0 0 120 52" aria-hidden focusable="false">
      <path d="M12 40c-8 0-12-6-9-12 2-5 8-7 13-5 1-8 9-14 18-12 6 1 11 6 12 11 4-3 10-3 14 0 3-7 11-10 18-7 6 2 10 8 9 14 5 0 9 4 9 8 0 2-1 3-3 3Z" />
    </svg>
  );
}

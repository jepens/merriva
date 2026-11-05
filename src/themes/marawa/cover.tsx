"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { useCoverGate } from "@/themes/_shared/cover-gate";
import { pasangPengepasSampul } from "@/themes/_shared/fit-names";

import { L } from "./labels";

function Line({ children }: { children: ReactNode }) {
  return (
    <span className="mw-line">
      <span>{children}</span>
    </span>
  );
}

// Siluet atap bagonjong: empat puncak runcing melengkung, satu goresan.
const GONJONG_MAIN =
  "M8 94 C32 88 42 58 48 24 C54 58 62 80 80 86 C96 90 104 68 110 44 C116 68 126 88 140 88 C154 88 164 68 170 44 C176 68 184 90 200 86 C218 80 226 58 232 24 C238 58 248 88 272 94";

/**
 * Visual cover Marawa (klien, tier Story, dark) — siluet atap BAGONJONG rumah
 * gadang menggambar diri, nama Cinzel, pita marawa di tepi. Entrance DIMILIKI
 * JS via WAAPI (tak menunggu gsap; LCP aman), digerbangi `motionOn`. Wipe
 * cover digerakkan CSS `.is-open`. Budaya (THEME-WAVE3 §3.2): gonjong selalu
 * runcing ke atas.
 */
export function MarawaCover({
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
  const gonjongRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!motionOn) return;
    const root = innerRef.current;
    if (!root) return;
    const spans = root.querySelectorAll<HTMLElement>(".mw-line > span");
    const anims: Animation[] = [];
    spans.forEach((el, i) => {
      el.style.visibility = "visible";
      anims.push(
        el.animate(
          [{ transform: "translateY(150%)" }, { transform: "translateY(0)" }],
          {
            duration: 1000,
            easing: "cubic-bezier(0.22,1,0.36,1)",
            fill: "both",
            delay: 950 + i * 90,
          },
        ),
      );
    });
    return () => anims.forEach((a) => a.cancel());
  }, [motionOn]);

  // Nama yang lebih lebar dari sampul pada ukuran desain terpotong masker
  // `.mw-line` — kecilkan HANYA baris nama itu (_shared/fit-names.ts). Baris
  // pertama & terakhir h1 = nama; baris tengahnya "jo".
  useEffect(() => {
    const inner = innerRef.current;
    const h1 = inner?.querySelector<HTMLElement>(".mw-cover__names");
    if (!inner || !h1) return;
    return pasangPengepasSampul(
      inner,
      () =>
        [h1.firstElementChild, h1.lastElementChild]
          .filter((l): l is HTMLElement => l instanceof HTMLElement)
          .map((l) => [l, l] as const),
      brideName + groomName,
    );
  }, [brideName, groomName]);

  useEffect(() => {
    if (!motionOn) return;
    const svg = gonjongRef.current;
    if (!svg) return;
    const paths = svg.querySelectorAll<SVGPathElement>("path");
    const anims: Animation[] = [];
    paths.forEach((p, i) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
      anims.push(
        p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], {
          duration: 1700,
          easing: "cubic-bezier(0.65,0,0.35,1)",
          fill: "both",
          delay: 200 + i * 240,
        }),
      );
    });
    return () => anims.forEach((a) => a.cancel());
  }, [motionOn]);

  return (
    <div className="mw-cover__inner" ref={innerRef}>
      <svg
        className="mw-gonjong"
        ref={gonjongRef}
        viewBox="0 0 280 110"
        aria-hidden
      >
        <path d={GONJONG_MAIN} />
        <path d="M36 94 H244" opacity=".6" />
      </svg>
      <p className="mw-cover__eyebrow">
        <Line>{L.cover.eyebrow}</Line>
      </p>
      <h1 className="mw-cover__names">
        <Line>{brideName}</Line>
        <span className="mw-line">
          <span className="mw-cover__jo">{L.cover.jo}</span>
        </span>
        <Line>{groomName}</Line>
      </h1>
      {dateLabel ? (
        <p className="mw-cover__date">
          <Line>{dateLabel}</Line>
        </p>
      ) : null}
      <div className="mw-guest">
        <small>{L.cover.recipient}</small>
        <strong>{recipientName ?? L.cover.recipientFallback}</strong>
      </div>
      <Line>
        <button
          type="button"
          className="mw-open"
          onClick={open}
          tabIndex={opened ? -1 : 0}
        >
          {L.cover.open}
        </button>
      </Line>
      <p className="mw-cover__hint">{L.cover.hint}</p>
    </div>
  );
}

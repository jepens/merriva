"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { copy } from "@/lib/copy";
import { useCoverGate } from "@/themes/_shared/cover-gate";
import { pasangPengepasSampul } from "@/themes/_shared/fit-names";

import { L } from "./labels";

function Line({ children }: { children: ReactNode }) {
  return (
    <span className="nr-line">
      <span>{children}</span>
    </span>
  );
}

/**
 * Visual cover Noir (klien) — layar bioskop: dua bilah letterbox + layar bercahaya.
 * Membaca `useCoverGate()` untuk nama tamu & aksi buka. Entrance mask-reveal
 * DIMILIKI JS via WAAPI (sinkron saat mount → tak menunggu gsap; LCP aman). TANPA
 * WebGL (tier Story). Penutupan letterbox digerakkan CSS `.is-open` (di cover-gate).
 */
export function NoirCover({
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

  useEffect(() => {
    if (!motionOn) return;
    const root = innerRef.current;
    if (!root) return;
    const spans = root.querySelectorAll<HTMLElement>(".nr-line > span");
    const anims: Animation[] = [];
    spans.forEach((el, i) => {
      el.style.visibility = "visible";
      anims.push(
        el.animate(
          [{ transform: "translateY(150%)" }, { transform: "translateY(0)" }],
          {
            duration: 1200,
            easing: "cubic-bezier(0.22,1,0.36,1)",
            fill: "both",
            delay: 300 + i * 100,
          },
        ),
      );
    });
    return () => anims.forEach((a) => a.cancel());
  }, [motionOn]);

  // Nama yang lebih lebar dari sampul pada ukuran desain terpotong masker
  // `.nr-line` — kecilkan HANYA nama itu (_shared/fit-names.ts).
  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    return pasangPengepasSampul(
      inner,
      () =>
        Array.from(inner.querySelectorAll<HTMLElement>(".nr-cover__name"))
          .map((el) => [el, el.querySelector<HTMLElement>(".nr-line")] as const)
          .filter(
            (p): p is readonly [HTMLElement, HTMLElement] => p[1] !== null,
          ),
      groomName + brideName,
    );
  }, [groomName, brideName]);

  const c = copy.public.cover;

  return (
    <>
      <div className="nr-cover__bar nr-cover__bar--top" aria-hidden>
        <small>{L.cover.presents}</small>
      </div>
      <div className="nr-cover__bar nr-cover__bar--bottom" aria-hidden>
        <small>{L.cover.tagline}</small>
      </div>
      <div className="nr-cover__screen" aria-hidden />

      <div className="nr-cover__inner" ref={innerRef}>
        <p className="nr-eyebrow nr-eyebrow--gold">
          <Line>{L.hero.eyebrow}</Line>
        </p>
        <div className="nr-cover__names">
          <span className="nr-cover__name">
            <Line>{groomName}</Line>
          </span>
          <span className="nr-cover__amp">
            <Line>&amp;</Line>
          </span>
          <span className="nr-cover__name">
            <Line>{brideName}</Line>
          </span>
        </div>
        {dateLabel ? (
          <p className="nr-cover__date">
            <Line>{dateLabel}</Line>
          </p>
        ) : null}
        <div className="nr-cover__rule" aria-hidden />
        <div className="nr-guest">
          <small>{c.recipient}</small>
          <strong>{recipientName ?? c.recipientFallback}</strong>
        </div>
        <Line>
          <button
            type="button"
            className="nr-open"
            onClick={open}
            tabIndex={opened ? -1 : 0}
          >
            ▶&nbsp;&nbsp;{L.cover.open}
          </button>
        </Line>
        <p className="nr-cover__hint">{L.cover.hint}</p>
      </div>
    </>
  );
}

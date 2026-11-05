"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { copy } from "@/lib/copy";
import { useCoverGate } from "@/themes/_shared/cover-gate";
import { pasangPengepasSampul } from "@/themes/_shared/fit-names";

import { L } from "./labels";

/** Baris bermask (`.mrd-line`) — state tersembunyi diisi JS via WAAPI (§0.4). */
function Line({ children }: { children: ReactNode }) {
  return (
    <span className="mrd-line">
      <span>{children}</span>
    </span>
  );
}

/**
 * Visual cover Meridian (klien) — gala Art Deco: sunburst emas yang MENGGAMBAR
 * diri, bingkai bertingkat bersudut, nama shimmer. Membaca `useCoverGate()` untuk
 * nama tamu & aksi buka. Dua entrance DIMILIKI JS (tak menunggu gsap → LCP aman,
 * digerbangi `motionOn`):
 *  - mask-reveal baris (`.mrd-line > span`, WAAPI translateY 150%→0)
 *  - sunburst rays menggambar (`stroke-dashoffset` L→0 per garis)
 * Penutupan (wipe clip-path) disetir CSS `.is-open` di cover-gate.
 */
export function MeridianCover({
  brideName,
  groomName,
  dateLabel,
}: {
  brideName: string;
  groomName: string;
  dateLabel: string | null;
}) {
  const { open, opened, recipientName, motionOn } = useCoverGate();
  const rootRef = useRef<HTMLDivElement>(null);
  const raysRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!motionOn) return;
    const anims: Animation[] = [];

    // Sunburst: tiap garis menggambar diri (stroke-dashoffset L → 0).
    const rays = raysRef.current;
    if (rays) {
      const lines = rays.querySelectorAll<SVGLineElement>("line");
      lines.forEach((ln, i) => {
        const len = ln.getTotalLength();
        ln.style.strokeDasharray = String(len);
        ln.style.strokeDashoffset = String(len);
        anims.push(
          ln.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], {
            duration: 1500,
            easing: "cubic-bezier(0.22,1,0.36,1)",
            fill: "both",
            delay: 150 + i * 70,
          }),
        );
      });
    }

    // Mask-reveal baris teks.
    const root = rootRef.current;
    if (root) {
      const spans = root.querySelectorAll<HTMLElement>(".mrd-line > span");
      spans.forEach((el, i) => {
        el.style.visibility = "visible";
        anims.push(
          el.animate(
            [{ transform: "translateY(150%)" }, { transform: "translateY(0)" }],
            {
              duration: 1100,
              easing: "cubic-bezier(0.22,1,0.36,1)",
              fill: "both",
              delay: 700 + i * 90,
            },
          ),
        );
      });
    }

    return () => anims.forEach((a) => a.cancel());
  }, [motionOn]);

  // Nama yang lebih lebar dari sampul pada ukuran desain terpotong masker
  // `.mrd-line` — kecilkan HANYA nama itu (_shared/fit-names.ts).
  useEffect(() => {
    const stage = rootRef.current;
    if (!stage) return;
    return pasangPengepasSampul(
      stage,
      () =>
        Array.from(stage.querySelectorAll<HTMLElement>(".mrd-cover__name"))
          .map(
            (el) => [el, el.querySelector<HTMLElement>(".mrd-line")] as const,
          )
          .filter(
            (p): p is readonly [HTMLElement, HTMLElement] => p[1] !== null,
          ),
      brideName + groomName,
    );
  }, [brideName, groomName]);

  const c = copy.public.cover;

  return (
    <div className="mrd-cover__stage" ref={rootRef}>
      <svg
        className="mrd-rays"
        ref={raysRef}
        viewBox="0 0 560 300"
        aria-hidden
        preserveAspectRatio="xMidYMax meet"
      >
        <line className="mrd-rays__lt" x1="280" y1="300" x2="280" y2="10" />
        <line x1="280" y1="300" x2="180" y2="24" />
        <line x1="280" y1="300" x2="380" y2="24" />
        <line x1="280" y1="300" x2="96" y2="60" />
        <line x1="280" y1="300" x2="464" y2="60" />
        <line x1="280" y1="300" x2="30" y2="120" />
        <line x1="280" y1="300" x2="530" y2="120" />
        <line x1="280" y1="300" x2="0" y2="210" />
        <line x1="280" y1="300" x2="560" y2="210" />
      </svg>

      <div className="mrd-deco-frame" aria-hidden>
        <i className="mrd-corner mrd-corner--tl" />
        <i className="mrd-corner mrd-corner--tr" />
        <i className="mrd-corner mrd-corner--bl" />
        <i className="mrd-corner mrd-corner--br" />
      </div>

      <div className="mrd-cover__inner">
        <p className="mrd-eyebrow mrd-eyebrow--gold">
          <Line>{L.cover.eyebrow}</Line>
        </p>
        <div className="mrd-cover__names">
          <span className="mrd-cover__name">
            <Line>{brideName}</Line>
          </span>
          <span className="mrd-cover__amp mrd-shimmer">
            <Line>&amp;</Line>
          </span>
          <span className="mrd-cover__name">
            <Line>{groomName}</Line>
          </span>
        </div>
        {dateLabel ? (
          <p className="mrd-cover__date">
            <Line>{dateLabel}</Line>
          </p>
        ) : null}
        <div className="mrd-divider" aria-hidden>
          <i />
        </div>
        <div className="mrd-guest">
          <small>{c.recipient}</small>
          <strong>{recipientName ?? c.recipientFallback}</strong>
        </div>
        <Line>
          <button
            type="button"
            className="mrd-open"
            onClick={open}
            tabIndex={opened ? -1 : 0}
          >
            {L.cover.open}
          </button>
        </Line>
        <p className="mrd-cover__hint">{L.cover.hint}</p>
      </div>
    </div>
  );
}

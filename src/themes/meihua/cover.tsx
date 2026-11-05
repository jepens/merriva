"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { useCoverGate } from "@/themes/_shared/cover-gate";
import { pasangPengepasSampul } from "@/themes/_shared/fit-names";

import { L } from "./labels";
import { XiMark } from "./xi-mark";

function Line({ children }: { children: ReactNode }) {
  return (
    <span className="mh-line">
      <span>{children}</span>
    </span>
  );
}

/**
 * Visual cover Meihua (klien, tier Story) — 囍 line-art (SVG, THEME-WAVE3
 * §3.4: selalu utuh, bukan teks CJK) menggambar diri dalam medali cincin yang
 * berputar pelan. Entrance DIMILIKI JS via WAAPI (tak menunggu gsap; LCP
 * aman), digerbangi `motionOn`. Wipe cover digerakkan CSS `.is-open`.
 */
export function MeihuaCover({
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
  const medalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!motionOn) return;
    const root = innerRef.current;
    if (!root) return;
    const spans = root.querySelectorAll<HTMLElement>(".mh-line > span");
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
            delay: 1050 + i * 90,
          },
        ),
      );
    });
    return () => anims.forEach((a) => a.cancel());
  }, [motionOn]);

  // Nama yang lebih lebar dari sampul pada ukuran desain terpotong masker
  // `.mh-line` — kecilkan HANYA baris nama itu (_shared/fit-names.ts). Baris
  // pertama & terakhir h1 = nama; baris tengahnya "&".
  useEffect(() => {
    const inner = innerRef.current;
    const h1 = inner?.querySelector<HTMLElement>(".mh-cover__names");
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

  // 囍 menggambar diri + cincin berputar pelan.
  useEffect(() => {
    if (!motionOn) return;
    const medal = medalRef.current;
    if (!medal) return;
    const paths = medal.querySelectorAll<SVGPathElement>(".mh-xi path");
    const anims: Animation[] = [];
    paths.forEach((p, i) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
      anims.push(
        p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], {
          duration: 800,
          easing: "cubic-bezier(0.65,0,0.35,1)",
          fill: "both",
          delay: 250 + i * 110,
        }),
      );
    });
    const ring = medal.querySelector<SVGSVGElement>(".mh-ring");
    if (ring) {
      anims.push(
        ring.animate([{ rotate: "0deg" }, { rotate: "360deg" }], {
          duration: 120000,
          iterations: Infinity,
        }),
      );
    }
    return () => anims.forEach((a) => a.cancel());
  }, [motionOn]);

  return (
    <div className="mh-cover__inner" ref={innerRef}>
      <div className="mh-medal" ref={medalRef}>
        <svg className="mh-ring" viewBox="0 0 196 196" aria-hidden>
          <circle cx="98" cy="98" r="94" />
          <circle cx="98" cy="98" r="86" strokeDasharray="3 6" opacity=".7" />
        </svg>
        <XiMark />
      </div>
      <p className="mh-cover__eyebrow">
        <Line>{L.cover.eyebrow}</Line>
      </p>
      <h1 className="mh-cover__names">
        <Line>{brideName}</Line>
        <span className="mh-line">
          <span className="mh-cover__amp">&amp;</span>
        </span>
        <Line>{groomName}</Line>
      </h1>
      {dateLabel ? (
        <p className="mh-cover__date">
          <Line>{dateLabel}</Line>
        </p>
      ) : null}
      <div className="mh-guest">
        <small>{L.cover.recipient}</small>
        <strong>{recipientName ?? L.cover.recipientFallback}</strong>
      </div>
      <Line>
        <button
          type="button"
          className="mh-open"
          onClick={open}
          tabIndex={opened ? -1 : 0}
        >
          {L.cover.open}
        </button>
      </Line>
      <p className="mh-cover__hint">{L.cover.hint}</p>
    </div>
  );
}

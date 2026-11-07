"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { useCoverGate } from "@/themes/_shared/cover-gate";
import { pasangPengepasSampul } from "@/themes/_shared/fit-names";

import { L } from "./labels";
import { ORN } from "./ornaments";

function Line({ children }: { children: ReactNode }) {
  return (
    <span className="kr-line">
      <span>{children}</span>
    </span>
  );
}

/**
 * Visual cover Kirana (klien) — gunungan (kayon) ukiran emas-sogan (aset raster
 * `public/ornaments/kirana/`, latar transparan) + nama mempelai di bawahnya,
 * latar pola truntum. Membaca `useCoverGate()` untuk nama tamu & aksi buka.
 * Entrance DIMILIKI JS via WAAPI (sinkron saat mount → tak menunggu gsap; LCP
 * aman), digerbangi `motionOn`. TANPA WebGL (tier Story). Wipe cover
 * (clip-path) digerakkan CSS `.is-open` di cover-gate.
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
  const gununganRef = useRef<HTMLImageElement>(null);

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

  // Gunungan muncul: fade + naik + scale halus (pengganti efek stroke-draw
  // line-art lama — aset kini raster ukiran penuh).
  useEffect(() => {
    if (!motionOn) return;
    const img = gununganRef.current;
    if (!img) return;
    const anim = img.animate(
      [
        { opacity: 0, transform: "translateY(16px) scale(0.965)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ],
      {
        duration: 1500,
        easing: "cubic-bezier(0.22,1,0.36,1)",
        fill: "both",
        delay: 150,
      },
    );
    return () => anim.cancel();
  }, [motionOn]);

  // Nama yang lebih lebar dari bidang nama pada ukuran desain terpotong masker
  // `.kr-line` — kecilkan HANYA nama itu (_shared/fit-names.ts).
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={gununganRef}
            className="kr-gunungan-foto"
            src={ORN.gunungan}
            alt=""
            width={700}
            height={1050}
            fetchPriority="high"
            decoding="async"
          />
        </div>

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

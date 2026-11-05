"use client";

import { useEffect, useRef } from "react";

import { copy } from "@/lib/copy";
import { useCoverGate } from "@/themes/_shared/cover-gate";
import { pasangPengepasSampul } from "@/themes/_shared/fit-names";

import { L } from "./labels";

/**
 * Visual cover Lumina (klien, tier Craft) — kartu film soft-minimal: bingkai
 * film tipis ganda, tanggal ber-spasi, sprig garis, nama serif (Spectral),
 * surat singkat, kartu tamu, tombol garis. Membaca `useCoverGate()` untuk nama
 * tamu & aksi buka. TANPA gsap/canvas. Entrance ringan via CSS (`.is-js`),
 * dinetralkan saat reduced-motion. Wipe cover (fade) digerakkan CSS `.is-open`.
 */
export function LuminaCover({
  titleLines,
  sub,
  dateLabel,
}: {
  titleLines: string[];
  sub?: string;
  dateLabel: string | null;
}) {
  const { open, opened, recipientName } = useCoverGate();
  const innerRef = useRef<HTMLDivElement>(null);
  const c = copy.public.cover;
  const twoLine = titleLines.length > 1;
  const teks = titleLines.join(" ");

  // Kata nama yang lebih lebar dari sampul pada ukuran desain meluap keluar
  // layar — kecilkan HANYA nama itu (_shared/fit-names.ts). Tanpa masker:
  // elemen nama sendiri yang menjadi wadahnya (judul satu baris: div-nya).
  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    return pasangPengepasSampul(
      inner,
      () =>
        Array.from(
          inner.querySelectorAll<HTMLElement>(
            ".lm-cover__name, .lm-cover__names:not(.lm-cover__names--pair)",
          ),
        ).map((el) => [el, el] as const),
      teks,
    );
  }, [teks]);

  return (
    <>
      <div className="lm-cover__frame" aria-hidden />
      <div className="lm-cover__inner" ref={innerRef}>
        {dateLabel ? <div className="lm-cover__date">{dateLabel}</div> : null}
        <svg
          className="lm-sprig"
          viewBox="0 0 54 40"
          aria-hidden
          focusable="false"
        >
          <path d="M27 38 C 27 24 27 14 27 4 M27 16 C 20 14 15 9 14 3 M27 16 C 34 14 39 9 40 3 M27 26 C 22 25 18 21 17 17 M27 26 C 32 25 36 21 37 17" />
        </svg>
        <div
          className={
            twoLine
              ? "lm-cover__names lm-cover__names--pair"
              : "lm-cover__names"
          }
        >
          {twoLine ? (
            <>
              <span className="lm-cover__name">{titleLines[0]}</span>
              <span className="lm-cover__amp" aria-hidden>
                &amp;
              </span>
              <span className="lm-cover__name">{titleLines[1]}</span>
            </>
          ) : (
            titleLines[0]
          )}
        </div>
        {sub ? <p className="lm-cover__sub">{sub}</p> : null}
        <div className="lm-cover__guest">
          {c.recipient}
          <b>{recipientName ?? c.recipientFallback}</b>
        </div>
        <div>
          <button
            type="button"
            className="lm-open"
            onClick={open}
            tabIndex={opened ? -1 : 0}
          >
            {L.cover.open}
          </button>
        </div>
      </div>
    </>
  );
}

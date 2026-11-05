"use client";

import { useEffect, useRef } from "react";

import { copy } from "@/lib/copy";
import { useCoverGate } from "@/themes/_shared/cover-gate";
import { pasangPengepasSampul } from "@/themes/_shared/fit-names";

import { L } from "./labels";

/**
 * Visual cover Aria (klien, tier Craft) — minimalis galeri: nomor kecil, dua
 * nama serif, garis merah tunggal, tanggal, tamu, tombol garis-bawah. Membaca
 * `useCoverGate()`. TANPA canvas/gsap. Entrance ringan via CSS (`.is-js`),
 * dinonaktifkan saat reduced-motion. Wipe cover (fade) digerakkan CSS `.is-open`.
 */
export function AriaCover({
  groomName,
  brideName,
  dateLabel,
}: {
  groomName: string;
  brideName: string;
  dateLabel: string | null;
}) {
  const { open, opened, recipientName } = useCoverGate();
  const innerRef = useRef<HTMLDivElement>(null);

  // Nama yang lebih lebar dari sampul pada ukuran desain meluap keluar layar —
  // kecilkan HANYA nama itu (_shared/fit-names.ts). Tanpa masker: elemen nama
  // sendiri yang menjadi wadahnya.
  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    return pasangPengepasSampul(
      inner,
      () =>
        Array.from(inner.querySelectorAll<HTMLElement>(".ar-cover__name")).map(
          (el) => [el, el] as const,
        ),
      groomName + brideName,
    );
  }, [groomName, brideName]);

  const c = copy.public.cover;

  return (
    <div className="ar-cover__inner" ref={innerRef}>
      <span className="ar-cover__no">{L.cover.eyebrow}</span>
      <div className="ar-cover__names">
        <div className="ar-cover__name">{groomName}</div>
        <div className="ar-cover__amp">&amp;</div>
        <div className="ar-cover__name">{brideName}</div>
      </div>
      <div className="ar-cover__redline" aria-hidden />
      {dateLabel ? <div className="ar-cover__date">{dateLabel}</div> : null}
      <div className="ar-cover__guest">
        {c.recipient}
        <b>{recipientName ?? c.recipientFallback}</b>
      </div>
      <div>
        <button
          type="button"
          className="ar-open"
          onClick={open}
          tabIndex={opened ? -1 : 0}
        >
          {L.cover.open}
        </button>
      </div>
    </div>
  );
}

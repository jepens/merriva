"use client";

import { useEffect, useRef } from "react";

import { copy } from "@/lib/copy";
import { useCoverGate } from "@/themes/_shared/cover-gate";
import { pasangPengepasSampul } from "@/themes/_shared/fit-names";

import { L } from "./labels";

/**
 * Visual cover Festa (klien, tier Craft) — ceria: blob mengambang (CSS), badge
 * acara, nama besar perayaan, chip tanggal, kartu tamu. Membaca `useCoverGate()`
 * untuk nama tamu & aksi buka. TANPA gsap/canvas di sini (confetti ada di `fx`).
 * Entrance ringan via CSS (`.is-js`), dinonaktifkan saat reduced-motion.
 */
export function FestaCover({
  eventName,
  bigName,
  chips,
}: {
  eventName: string;
  bigName: string;
  chips: string[];
}) {
  const { open, opened, recipientName } = useCoverGate();
  const innerRef = useRef<HTMLDivElement>(null);
  const c = copy.public.cover;

  // Kata nama yang lebih lebar dari sampul pada ukuran desain meluap keluar
  // layar — kecilkan HANYA nama itu (_shared/fit-names.ts). Tanpa masker:
  // wadah yang diukur = elemen nama itu sendiri.
  useEffect(() => {
    const inner = innerRef.current;
    const name = inner?.querySelector<HTMLElement>(".ft-cover__name");
    if (!inner || !name) return;
    return pasangPengepasSampul(inner, () => [[name, name]], bigName);
  }, [bigName]);

  return (
    <>
      <div className="ft-blob ft-blob--1" aria-hidden />
      <div className="ft-blob ft-blob--2" aria-hidden />
      <div className="ft-blob ft-blob--3" aria-hidden />
      <div className="ft-cover__inner" ref={innerRef}>
        <span className="ft-badge">{eventName}</span>
        <div className="ft-cover__name">{bigName}</div>
        {chips.length > 0 ? (
          <div className="ft-chips">
            {chips.map((ch, i) => (
              <span
                key={i}
                className={i === 1 ? "ft-chip ft-chip--sun" : "ft-chip"}
              >
                {ch}
              </span>
            ))}
          </div>
        ) : null}
        <div className="ft-guest">
          <small>{c.recipient}</small>
          <strong>{recipientName ?? c.recipientFallback}</strong>
        </div>
        <button
          type="button"
          className="ft-open"
          onClick={open}
          tabIndex={opened ? -1 : 0}
        >
          {L.cover.open}
        </button>
      </div>
    </>
  );
}

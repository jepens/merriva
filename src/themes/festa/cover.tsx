"use client";

import { copy } from "@/lib/copy";
import { useCoverGate } from "@/themes/_shared/cover-gate";

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
  const c = copy.public.cover;

  return (
    <>
      <div className="ft-blob ft-blob--1" aria-hidden />
      <div className="ft-blob ft-blob--2" aria-hidden />
      <div className="ft-blob ft-blob--3" aria-hidden />
      <div className="ft-cover__inner">
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

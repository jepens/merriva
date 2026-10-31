"use client";

import { useCoverGate } from "@/themes/_shared/cover-gate";

import { L } from "./labels";

/**
 * Visual cover Sakinah (klien, tier Craft) — bismillah (Amiri), nama mempelai,
 * bintang-8 sudut, kartu tamu, tombol buka. TANPA gsap/canvas/foto. Entrance
 * ringan via CSS (`.is-js.is-motion`), dinetralkan saat reduced-motion. Wipe
 * cover (fade) digerakkan CSS `.is-open` di cover-gate.
 */
export function SakinahCover({
  brideName,
  groomName,
  dateLabel,
}: {
  brideName: string;
  groomName: string;
  dateLabel: string | null;
}) {
  const { open, opened, recipientName } = useCoverGate();

  return (
    <>
      <span className="sk-cstar sk-cstar--a" aria-hidden>
        <i />
        <b />
      </span>
      <span className="sk-cstar sk-cstar--b" aria-hidden>
        <i />
        <b />
      </span>
      <div className="sk-cover__inner">
        <p className="sk-ar sk-cover__bismillah" lang="ar" dir="rtl">
          {L.cover.bismillah}
        </p>
        <p className="sk-cover__eyebrow">{L.cover.eyebrow}</p>
        <h1 className="sk-cover__names">
          {brideName}
          <em aria-hidden>&amp;</em>
          {groomName}
        </h1>
        {dateLabel ? <p className="sk-cover__date">{dateLabel}</p> : null}
        <div className="sk-guest">
          <small>{L.cover.recipient}</small>
          <strong>{recipientName ?? L.cover.recipientFallback}</strong>
        </div>
        <button
          type="button"
          className="sk-open"
          onClick={open}
          tabIndex={opened ? -1 : 0}
        >
          {L.cover.open}
        </button>
      </div>
    </>
  );
}

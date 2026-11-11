"use client";

import { useEffect, useRef } from "react";

import { useCoverGate } from "@/themes/_shared/cover-gate";
import { pasangPengepasSampul } from "@/themes/_shared/fit-names";
import { fotoStyle } from "@/themes/_shared/foto";
import type { PhotoView } from "@/types/invitation";

import { DEKOR, L, type Edisi } from "./labels";

/**
 * Halaman muka koran (klien, tier Craft): kop blackletter, baris edisi, pita
 * ticker berjalan (CSS), judul utama Anton, foto halftone, keterangan foto,
 * kartu tamu, tombol "Baca Selengkapnya". TANPA gsap/canvas — entrance & wipe
 * (halaman muka terangkat ke atas) digerakkan CSS `.is-motion`/`.is-open`.
 *
 * Bahasa kop & judul = `edisi` pilihan SERVER (varian tersimpan, DECISIONS
 * #130) — satu bahasa saja, tak dirender ganda seperti judul section: pengepas
 * nama mengukur teks judul, dan editor Tampilan langsung membuka sampul.
 */
export function WartaCover({
  groomName,
  brideName,
  dateLabel,
  tickerLine,
  photo,
  edisi,
}: {
  groomName: string;
  brideName: string;
  dateLabel: string | null;
  tickerLine: string[];
  photo: PhotoView | null;
  /** Bahasa kop & judul sampul (varian tersimpan). */
  edisi: Edisi;
}) {
  const { open, opened, recipientName } = useCoverGate();
  const innerRef = useRef<HTMLDivElement>(null);
  const D = DEKOR[edisi];
  const headline = D.cover.headline(groomName, brideName);

  // Nama satu kata yang sangat panjang tak boleh meluap keluar layar di
  // 320 px: judul dikecilkan HANYA bila kata terlebarnya melampaui wadah
  // (_shared/fit-names.ts). Wadah = blok judul selebar kolom.
  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    return pasangPengepasSampul(
      inner,
      () => {
        const el = inner.querySelector<HTMLElement>(".wt-cover__headline");
        return el ? [[el, el] as const] : [];
      },
      headline,
    );
  }, [headline]);

  // Pita ticker: isi digandakan supaya geser −50% berulang mulus.
  const tick = tickerLine.length > 0 ? tickerLine : [D.cover.saveTheDate];
  const run = (
    <span className="wt-ticker__run">
      {tick.map((t, i) => (
        <span key={i}>
          <i aria-hidden>★</i> {t}{" "}
        </span>
      ))}
    </span>
  );

  return (
    <div className="wt-cover__inner" ref={innerRef}>
      <header className="wt-mast">
        <h1 className="wt-mast__title">{D.masthead}</h1>
        <div className="wt-mast__rule" aria-hidden />
        <div className="wt-mast__dateline">
          <span>{D.edition}</span>
          {dateLabel ? <span>{dateLabel}</span> : null}
          <span>{D.free}</span>
        </div>
      </header>

      <div className="wt-ticker">
        <p className="wt-sr">{tick.join(" · ")}</p>
        <div className="wt-ticker__track" aria-hidden>
          {run}
          {run}
        </div>
      </div>

      <h2 className="wt-cover__headline">{headline}</h2>

      <figure className="wt-cover__photo">
        <div className="wt-photo wt-photo--bleed">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.url}
              alt=""
              fetchPriority="high"
              style={{ width: "100%", height: "100%", ...fotoStyle(photo) }}
            />
          ) : (
            <span className="wt-photo__mono" aria-hidden>
              {groomName.trim()[0] ?? "•"}&amp;{brideName.trim()[0] ?? "•"}
            </span>
          )}
        </div>
        <figcaption className="wt-cover__caption">
          {/* Keterangan foto hanya bila memang ada foto (bukan monogram). */}
          {photo ? <em>{L.cover.caption}</em> : <span />}
          {/* Halaman berita (hero) terkunci di depan → selalu halaman 2. */}
          <span>{D.cover.continued(2)}</span>
        </figcaption>
      </figure>

      <div className="wt-guest">
        <small>{L.cover.recipient}</small>
        <strong>{recipientName ?? L.cover.recipientFallback}</strong>
      </div>

      <button
        type="button"
        className="wt-open"
        onClick={open}
        tabIndex={opened ? -1 : 0}
      >
        {L.cover.open}
      </button>
    </div>
  );
}

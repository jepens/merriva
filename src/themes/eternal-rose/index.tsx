import {
  Cormorant_Garamond,
  Figtree,
  Fraunces,
  Instrument_Sans,
  Jost,
  Marcellus,
} from "next/font/google";
import type { ReactNode } from "react";

import { GuestbookSection } from "@/components/public/guestbook/guestbook-section";
import { appearanceStyle } from "@/lib/customizer/appearance-style";
import { resolveAppearance } from "@/lib/customizer/resolve";
import {
  formatDateOnly,
  formatEventDateTime,
  localToUtc,
} from "@/lib/datetime";
import { isSectionVisible, type SectionKey } from "@/lib/validation/content";
import { CoverGate } from "@/themes/_shared/cover-gate";
import { Lightbox } from "@/themes/_shared/lightbox";
import type { ThemeComponentProps } from "@/themes/registry";

// CSS tema TIDAK di-import di sini: ia dikirim sebagai aset statis lewat
// `<ThemeStyles slug="eternal-rose" />` supaya undangan tak mengunduh stylesheet
// kesepuluh tema (AUDIT PER-2 / DECISIONS #31). Sumbernya tetap ./eternal-rose.css
import { EternalRoseCover } from "./cover";
import { EternalRoseFx } from "./fx";
import { eternalRoseOptions } from "./options";
import {
  Couple,
  CountdownBlock,
  Envelope,
  Footer,
  Gallery,
  Hero,
  Marquee,
  QuoteBlock,
  Schedule,
  Story,
} from "./sections";

// Self-hosted (next/font) → tanpa request eksternal saat runtime (WebView/LCP).
// Tiga PASANGAN font kurasi (kustomisasi Fase G, maks 3 — anggaran font).
// @font-face pasangan non-default tetap terbit tetapi tak di-fetch bila tak dipakai.
// SEMUA instance `preload:false` (AUDIT-2026-09-04 PER-1): `next/font` meng-emit
// `<link rel=preload as=font>` untuk SETIAP tema yang tergabung di graph modul
// `/[slug]`, bukan hanya tema yang dipakai — 116 berkas / 2,03 MB per pembukaan
// undangan. Tanpa preload, `@font-face` + `unicode-range` tetap terbit dan
// browser hanya mengunduh slice yang benar-benar dipakai.
const dispA = Fraunces({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--er-disp-a",
  display: "swap",
  preload: false,
});
const bodyA = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--er-body-a",
  display: "swap",
  preload: false,
});
const dispB = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--er-disp-b",
  display: "swap",
  preload: false,
});
const bodyB = Jost({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--er-body-b",
  display: "swap",
  preload: false,
});
const dispC = Marcellus({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--er-disp-c",
  display: "swap",
  preload: false,
});
const bodyC = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--er-body-c",
  display: "swap",
  preload: false,
});

const FONT_VARS = [
  dispA.variable,
  bodyA.variable,
  dispB.variable,
  bodyB.variable,
  dispC.variable,
  bodyC.variable,
].join(" ");

const firstInitial = (s: string) => (s.trim()[0] ?? "•").toUpperCase();

/** Section yang bisa disembunyikan lewat toggle lama (`settings.sections`). */
const LEGACY_TOGGLE = new Set<SectionKey>([
  "countdown",
  "schedule",
  "gallery",
  "story",
  "envelope",
  "rsvp",
]);
const isLegacyToggle = (id: string): id is SectionKey =>
  LEGACY_TOGGLE.has(id as SectionKey);

/**
 * Tema "eternal-rose" (wedding, tier Signature) — acuan
 * `prototypes/eternal-rose-signature.html`. SERVER component: section dirender
 * di server (SSR/ISR) lalu dibungkus `CoverGate` (klien) yang memegang cover +
 * musik (`coverMode:'theme'`). TIDAK mengambil data sendiri (SPEC §7.1).
 *
 * Kustomisasi (Fase G): bila `settings.custom` ada, `resolveAppearance` memetakan
 * varian/aksen/font/gaya/urutan → CSS var + data-atribut + urutan section (DOM
 * order). Penjaga kontras dihitung di server (aman dirender). Tanpa `custom`,
 * tema render IDENTIK seperti sebelumnya (tak ada override; toggle lama dipakai).
 */
export default function EternalRose({ data }: ThemeComponentProps) {
  const rootClass = `er ${FONT_VARS}`;
  const { settings } = data;

  if (data.content.category !== "wedding") {
    return (
      <div className={rootClass}>
        <section className="er-section er-center">
          <p className="er-lead">Tema ini khusus untuk undangan pernikahan.</p>
        </section>
      </div>
    );
  }

  const content = data.content;
  const groomName =
    content.groom.nickname || content.groom.name || "Mempelai Pria";
  const brideName =
    content.bride.nickname || content.bride.name || "Mempelai Wanita";

  const firstEvent = data.events[0];
  const heroDateLabel = firstEvent
    ? (() => {
        const f = formatEventDateTime(firstEvent.startAt, settings.timezone);
        return f ? `${f.weekday}, ${f.date}` : null;
      })()
    : data.eventDate
      ? (() => {
          const f = formatDateOnly(data.eventDate);
          return f ? `${f.weekday}, ${f.date}` : null;
        })()
      : null;

  const countdownTarget =
    firstEvent?.startAt ??
    (data.eventDate
      ? localToUtc(`${data.eventDate}T00:00`, settings.timezone)
      : null);

  const hasQuote = Boolean(content.quote?.text);
  const envelope = content.envelope;
  const hasEnvelope =
    envelope.enabled &&
    (envelope.banks.length > 0 ||
      envelope.ewallets.length > 0 ||
      Boolean(envelope.giftAddress));

  const marqueeText = `${groomName} & ${brideName}${
    heroDateLabel ? ` — ${heroDateLabel}` : ""
  }`;

  // Kustomisasi terpandu (Fase G). custom absen → resolved null → render bawaan.
  const custom = settings.custom ?? null;
  const resolved = custom
    ? resolveAppearance(eternalRoseOptions, custom)
    : null;

  // Peta section → node. Node mengembalikan null bila datanya kosong (mis. galeri
  // tanpa foto) → "visible" hanya mengatur toggle, tak pernah menampilkan kosong.
  const sectionNodes: Record<string, ReactNode> = {
    hero: (
      <Hero
        monogram={`${firstInitial(groomName)} ♥ ${firstInitial(brideName)}`}
        groomName={groomName}
        brideName={brideName}
        greetingOpen={content.greetingOpen}
      />
    ),
    quote: hasQuote ? <QuoteBlock quote={content.quote} /> : null,
    couple: (
      <Couple
        groom={content.groom}
        bride={content.bride}
        groomPhoto={data.groomPhotoUrl}
        bridePhoto={data.bridePhotoUrl}
      />
    ),
    countdown: countdownTarget ? (
      <CountdownBlock targetIso={countdownTarget} />
    ) : null,
    schedule:
      data.events.length > 0 ? (
        <Schedule
          events={data.events}
          tz={settings.timezone}
          slug={data.slug}
        />
      ) : null,
    gallery:
      data.media.length > 0 ? (
        <Lightbox media={data.media}>
          <Gallery media={data.media} />
        </Lightbox>
      ) : null,
    story: content.story.length > 0 ? <Story story={content.story} /> : null,
    envelope: hasEnvelope ? (
      <Envelope envelope={envelope} slug={data.slug} />
    ) : null,
    rsvp: (
      <section className="er-section">
        <div className="er-inner">
          <GuestbookSection slug={data.slug} />
        </div>
      </section>
    ),
  };

  // Urutan render (DOM order). Dengan custom → dari resolver; tanpa custom →
  // urutan bawaan + toggle lama (`isSectionVisible`) → identik dgn sebelumnya.
  const order = resolved
    ? resolved.sections
    : eternalRoseOptions.sections.map((s) => ({
        id: s.id,
        visible: isLegacyToggle(s.id) ? isSectionVisible(settings, s.id) : true,
      }));

  const grainOn = resolved ? resolved.grain : true;

  const appearance = resolved
    ? {
        style: appearanceStyle(eternalRoseOptions.preview.vars, resolved),
        data: { gallery: resolved.styles.gallery },
        motion: resolved.motion,
      }
    : undefined;

  return (
    <CoverGate
      rootClassName={rootClass}
      contentClassName="er-stage"
      coverClassName="er-cover"
      musicClassName="er-music"
      music={data.music}
      appearance={appearance}
      cover={
        <EternalRoseCover
          groomName={groomName}
          brideName={brideName}
          dateLabel={heroDateLabel}
        />
      }
      fx={<EternalRoseFx />}
    >
      {grainOn ? <div className="er-grain" aria-hidden /> : null}
      <div className="er-progress" aria-hidden />

      <Marquee text={marqueeText} />

      {order
        .filter((o) => o.visible)
        .map((o) => {
          const node = sectionNodes[o.id];
          if (!node) return null;
          return (
            <div
              key={o.id}
              data-section-id={o.id}
              style={{ display: "contents" }}
            >
              {node}
            </div>
          );
        })}

      <Footer
        greetingClose={content.greetingClose}
        monogram={`${firstInitial(groomName)} & ${firstInitial(brideName)}`}
        watermark={data.watermark}
      />
    </CoverGate>
  );
}

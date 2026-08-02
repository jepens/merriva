import { Cormorant_Garamond, Jost } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";

import { GuestbookSection } from "@/components/public/guestbook/guestbook-section";
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

import "./noir.css";
import { NoirCover } from "./cover";
import { NoirFx } from "./fx";
import { noirOptions } from "./options";
import {
  Cast,
  CountdownBlock,
  Envelope,
  Footer,
  Gallery,
  Hero,
  QuoteBlock,
  Schedule,
  Story,
} from "./sections";

// Self-hosted (next/font) → tanpa request eksternal saat runtime (WebView/LCP).
// Cormorant Garamond = serif Garalde sinematik (nama + judul); Jost = geometric
// sans (teks/label). Nuansa malam glamor tanpa aset eksternal.
const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--nr-serif",
  display: "swap",
});
const sans = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--nr-sans",
  display: "swap",
});

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
 * Tema "Noir" (wedding sinematik, tier Story) — acuan
 * `prototypes/midnight-frame-story.html`. SERVER component: section dirender di
 * server (SSR/ISR) lalu dibungkus `CoverGate` (klien) yang memegang cover +
 * musik (`coverMode:'theme'`). TIDAK mengambil data sendiri (SPEC §7.1).
 *
 * Kustomisasi (Fase G): bila `settings.custom` ada, `resolveAppearance` memetakan
 * varian → CSS var (aksen/kertas/teks) + urutan section (DOM order). Tanpa
 * `custom`, render IDENTIK seperti sebelumnya (toggle lama dipakai).
 */
export default function Noir({ data }: ThemeComponentProps) {
  const rootClass = `nr ${serif.variable} ${sans.variable}`;
  const { settings } = data;

  if (data.content.category !== "wedding") {
    return (
      <div className={rootClass}>
        <section className="nr-section nr-center">
          <p className="nr-lead">Tema ini khusus untuk undangan pernikahan.</p>
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

  const custom = settings.custom ?? null;
  const resolved = custom ? resolveAppearance(noirOptions, custom) : null;

  const sectionNodes: Record<string, ReactNode> = {
    hero: (
      <Hero
        groomName={groomName}
        brideName={brideName}
        greetingOpen={content.greetingOpen}
        featured={data.media[0] ?? null}
      />
    ),
    quote: hasQuote ? <QuoteBlock quote={content.quote} /> : null,
    couple: (
      <Cast
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
      <section className="nr-section">
        <div className="nr-inner">
          <GuestbookSection slug={data.slug} />
        </div>
      </section>
    ),
  };

  const order = resolved
    ? resolved.sections
    : noirOptions.sections.map((s) => ({
        id: s.id,
        visible: isLegacyToggle(s.id) ? isSectionVisible(settings, s.id) : true,
      }));

  const grainOn = resolved ? resolved.grain : true;

  const appearance = resolved
    ? {
        style: {
          "--nr-bg": resolved.paper,
          "--nr-bone": resolved.ink,
          "--nr-champ": resolved.accent,
          "--nr-champ-2": resolved.accent,
        } as CSSProperties,
        motion: resolved.motion,
      }
    : undefined;

  return (
    <CoverGate
      rootClassName={rootClass}
      contentClassName="nr-stage"
      coverClassName="nr-cover"
      musicClassName="nr-music"
      wipeMs={1500}
      music={data.music}
      appearance={appearance}
      cover={
        <NoirCover
          groomName={groomName}
          brideName={brideName}
          dateLabel={heroDateLabel}
        />
      }
      fx={<NoirFx />}
    >
      {grainOn ? <div className="nr-grain" aria-hidden /> : null}
      <div className="nr-vignette" aria-hidden />
      <div className="nr-progress" aria-hidden />

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
        groomName={groomName}
        brideName={brideName}
        greetingClose={content.greetingClose}
        watermark={data.watermark}
      />
    </CoverGate>
  );
}

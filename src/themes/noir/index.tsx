import { Cormorant_Garamond, Jost } from "next/font/google";

import { GuestbookSection } from "@/components/public/guestbook/guestbook-section";
import {
  formatDateOnly,
  formatEventDateTime,
  localToUtc,
} from "@/lib/datetime";
import { isSectionVisible } from "@/lib/validation/content";
import { CoverGate } from "@/themes/_shared/cover-gate";
import type { ThemeComponentProps } from "@/themes/registry";

import "./noir.css";
import { NoirCover } from "./cover";
import { NoirFx } from "./fx";
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

/**
 * Tema "Noir" (wedding sinematik, tier Story) — acuan
 * `prototypes/midnight-frame-story.html`. SERVER component: section dirender di
 * server (SSR/ISR) lalu dibungkus `CoverGate` (klien) yang memegang cover +
 * musik (`coverMode:'theme'`). TIDAK mengambil data sendiri (SPEC §7.1); section
 * tampil sesuai `settings.sections`.
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

  return (
    <CoverGate
      rootClassName={rootClass}
      contentClassName="nr-stage"
      coverClassName="nr-cover"
      musicClassName="nr-music"
      wipeMs={1500}
      music={data.music}
      cover={
        <NoirCover
          groomName={groomName}
          brideName={brideName}
          dateLabel={heroDateLabel}
        />
      }
      fx={<NoirFx />}
    >
      <div className="nr-grain" aria-hidden />
      <div className="nr-vignette" aria-hidden />
      <div className="nr-progress" aria-hidden />

      <Hero
        groomName={groomName}
        brideName={brideName}
        greetingOpen={content.greetingOpen}
        featured={data.media[0] ?? null}
      />

      {hasQuote ? <QuoteBlock quote={content.quote} /> : null}

      <Cast groom={content.groom} bride={content.bride} />

      {isSectionVisible(settings, "countdown") && countdownTarget ? (
        <CountdownBlock targetIso={countdownTarget} />
      ) : null}

      {isSectionVisible(settings, "schedule") && data.events.length > 0 ? (
        <Schedule
          events={data.events}
          tz={settings.timezone}
          slug={data.slug}
        />
      ) : null}

      {isSectionVisible(settings, "gallery") && data.media.length > 0 ? (
        <Gallery media={data.media} />
      ) : null}

      {isSectionVisible(settings, "story") && content.story.length > 0 ? (
        <Story story={content.story} />
      ) : null}

      {isSectionVisible(settings, "envelope") && hasEnvelope ? (
        <Envelope envelope={envelope} slug={data.slug} />
      ) : null}

      {isSectionVisible(settings, "rsvp") ? (
        <section className="nr-section">
          <div className="nr-inner">
            <GuestbookSection slug={data.slug} />
          </div>
        </section>
      ) : null}

      <Footer
        groomName={groomName}
        brideName={brideName}
        greetingClose={content.greetingClose}
        watermark={data.watermark}
      />
    </CoverGate>
  );
}

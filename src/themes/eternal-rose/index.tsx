import { Fraunces, Instrument_Sans } from "next/font/google";

import { GuestbookSection } from "@/components/public/guestbook/guestbook-section";
import {
  formatDateOnly,
  formatEventDateTime,
  localToUtc,
} from "@/lib/datetime";
import { isSectionVisible } from "@/lib/validation/content";
import { CoverGate } from "@/themes/_shared/cover-gate";
import { Lightbox } from "@/themes/_shared/lightbox";
import type { ThemeComponentProps } from "@/themes/registry";

import "./eternal-rose.css";
import { EternalRoseCover } from "./cover";
import { EternalRoseFx } from "./fx";
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
// Fraunces = serif display kontras (italic untuk nama); Instrument Sans = UI/caps.
const serif = Fraunces({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--er-serif",
  display: "swap",
});
const sans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--er-sans",
  display: "swap",
});

const firstInitial = (s: string) => (s.trim()[0] ?? "•").toUpperCase();

/**
 * Tema "eternal-rose" (wedding, tier Signature) — acuan
 * `prototypes/eternal-rose-signature.html`. SERVER component: section dirender
 * di server (SSR/ISR) lalu dibungkus `CoverGate` (klien) yang memegang cover +
 * musik (`coverMode:'theme'`). TIDAK mengambil data sendiri (SPEC §7.1); section
 * tampil sesuai `settings.sections`.
 */
export default function EternalRose({ data }: ThemeComponentProps) {
  const rootClass = `er ${serif.variable} ${sans.variable}`;
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

  return (
    <CoverGate
      rootClassName={rootClass}
      contentClassName="er-stage"
      coverClassName="er-cover"
      musicClassName="er-music"
      music={data.music}
      cover={
        <EternalRoseCover
          groomName={groomName}
          brideName={brideName}
          dateLabel={heroDateLabel}
        />
      }
      fx={<EternalRoseFx />}
    >
      <div className="er-grain" aria-hidden />
      <div className="er-progress" aria-hidden />

      <Marquee text={marqueeText} />
      <Hero
        monogram={`${firstInitial(groomName)} ♥ ${firstInitial(brideName)}`}
        groomName={groomName}
        brideName={brideName}
        greetingOpen={content.greetingOpen}
      />

      {hasQuote ? <QuoteBlock quote={content.quote} /> : null}

      <Couple
        groom={content.groom}
        bride={content.bride}
        groomPhoto={data.groomPhotoUrl}
        bridePhoto={data.bridePhotoUrl}
      />

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
        <Lightbox media={data.media}>
          <Gallery media={data.media} />
        </Lightbox>
      ) : null}

      {isSectionVisible(settings, "story") && content.story.length > 0 ? (
        <Story story={content.story} />
      ) : null}

      {isSectionVisible(settings, "envelope") && hasEnvelope ? (
        <Envelope envelope={envelope} slug={data.slug} />
      ) : null}

      {isSectionVisible(settings, "rsvp") ? (
        <section className="er-section">
          <div className="er-inner">
            <GuestbookSection slug={data.slug} />
          </div>
        </section>
      ) : null}

      <Footer
        greetingClose={content.greetingClose}
        monogram={`${firstInitial(groomName)} & ${firstInitial(brideName)}`}
        watermark={data.watermark}
      />
    </CoverGate>
  );
}

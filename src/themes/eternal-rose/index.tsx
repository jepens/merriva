import { Cormorant_Garamond, Great_Vibes } from "next/font/google";

import {
  formatDateOnly,
  formatEventDateTime,
  localToUtc,
} from "@/lib/datetime";
import { isSectionVisible } from "@/lib/validation/content";
import type { ThemeComponentProps } from "@/themes/registry";

import "./eternal-rose.css";
import {
  CountdownBlock,
  Couple,
  Envelope,
  Footer,
  Gallery,
  Hero,
  QuoteBlock,
  Schedule,
  Story,
} from "./sections";

// Self-hosted (next/font) → tanpa request eksternal saat runtime (aman untuk
// WebView & LCP). Serif untuk teks, skrip untuk nama & aksen.
const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--er-font-serif",
  display: "swap",
});
const script = Great_Vibes({
  subsets: ["latin"],
  weight: "400",
  variable: "--er-font-script",
  display: "swap",
});

/**
 * Tema "eternal-rose" (wedding, tier standard). Menerima `InvitationData` hasil
 * rakitan server — TIDAK mengambil data sendiri (SPEC §7.1). Section tampil
 * sesuai `settings.sections` (undefined = tampil).
 */
export default function EternalRose({ data }: ThemeComponentProps) {
  const { settings } = data;

  if (data.content.category !== "wedding") {
    return (
      <div className={`er ${serif.variable} ${script.variable}`}>
        <section className="er-section" style={{ minHeight: "60vh" }}>
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

  const hasQuote = Boolean(content.greetingOpen || content.quote?.text);
  const envelope = content.envelope;
  const hasEnvelope =
    envelope.enabled &&
    (envelope.banks.length > 0 ||
      envelope.ewallets.length > 0 ||
      Boolean(envelope.giftAddress));

  return (
    <div className={`er ${serif.variable} ${script.variable}`}>
      <Hero
        groomName={groomName}
        brideName={brideName}
        dateLabel={heroDateLabel}
        bgUrl={data.media[0]?.url}
      />

      {hasQuote ? (
        <QuoteBlock
          greetingOpen={content.greetingOpen}
          quote={content.quote?.text ? content.quote : undefined}
        />
      ) : null}

      <Couple groom={content.groom} bride={content.bride} />

      {isSectionVisible(settings, "countdown") && countdownTarget ? (
        <CountdownBlock targetIso={countdownTarget} />
      ) : null}

      {isSectionVisible(settings, "schedule") && data.events.length > 0 ? (
        <Schedule events={data.events} tz={settings.timezone} />
      ) : null}

      {isSectionVisible(settings, "gallery") && data.media.length > 0 ? (
        <Gallery media={data.media} />
      ) : null}

      {isSectionVisible(settings, "story") && content.story.length > 0 ? (
        <Story story={content.story} />
      ) : null}

      {isSectionVisible(settings, "envelope") && hasEnvelope ? (
        <Envelope envelope={envelope} />
      ) : null}

      <Footer
        greetingClose={content.greetingClose}
        groomName={groomName}
        brideName={brideName}
        watermark={data.watermark}
      />
    </div>
  );
}

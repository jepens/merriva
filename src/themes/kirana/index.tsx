import { Cormorant_Upright, Figtree } from "next/font/google";

import { GuestbookSection } from "@/components/public/guestbook/guestbook-section";
import {
  formatDateOnly,
  formatEventDateTime,
  localToUtc,
} from "@/lib/datetime";
import { isSectionVisible } from "@/lib/validation/content";
import { CoverGate } from "@/themes/_shared/cover-gate";
import type { ThemeComponentProps } from "@/themes/registry";

import "./kr.css";
import { KiranaCover } from "./cover";
import { KiranaFx } from "./fx";
import {
  CountdownBlock,
  Couple,
  Envelope,
  Footer,
  Gallery,
  Hero,
  Schedule,
  SekarBlock,
  Story,
} from "./sections";

// Self-hosted (next/font) → tanpa request eksternal saat runtime (WebView/LCP).
// Cormorant Upright = display serif tegak elegan (nama & judul); Figtree =
// humanist sans (teks/label). Nuansa Jawa modern (palet sogan) tanpa aset luar.
const display = Cormorant_Upright({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--kr-display",
  display: "swap",
});
const body = Figtree({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--kr-body",
  display: "swap",
});

/**
 * Tema "Kirana" (wedding adat Jawa modern, tier Story) — acuan
 * `prototypes/kirana-story.html`. Motif truntum & gunungan line-art, palet
 * sogan, rangkaian upacara termasuk Panggih. SERVER component: section dirender
 * di server (SSR/ISR) lalu dibungkus `CoverGate` (klien) yang memegang cover +
 * musik (`coverMode:'theme'`). TIDAK mengambil data sendiri (SPEC §7.1); section
 * tampil sesuai `settings.sections`. Khusus kategori pernikahan.
 */
export default function Kirana({ data }: ThemeComponentProps) {
  const rootClass = `kr ${display.variable} ${body.variable}`;
  const { settings } = data;

  if (data.content.category !== "wedding") {
    return (
      <div className={rootClass}>
        <section className="kr-section kr-center">
          <p className="kr-lead">Tema ini khusus untuk undangan pernikahan.</p>
        </section>
      </div>
    );
  }

  const content = data.content;
  const groomName =
    content.groom.nickname || content.groom.name || "Mempelai Kakung";
  const brideName =
    content.bride.nickname || content.bride.name || "Mempelai Putri";

  const firstEvent = data.events[0];
  const heroDateLabel = firstEvent
    ? (() => {
        const f = formatEventDateTime(firstEvent.startAt, settings.timezone);
        return f ? `${f.weekday} · ${f.date}` : null;
      })()
    : data.eventDate
      ? (() => {
          const f = formatDateOnly(data.eventDate);
          return f ? `${f.weekday} · ${f.date}` : null;
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
      contentClassName="kr-stage"
      coverClassName="kr-cover"
      musicClassName="kr-music"
      wipeMs={1100}
      music={data.music}
      cover={
        <KiranaCover
          brideName={brideName}
          groomName={groomName}
          dateLabel={heroDateLabel}
        />
      }
      fx={<KiranaFx />}
    >
      <div className="kr-grain" aria-hidden />
      <div className="kr-progress" aria-hidden />

      {isSectionVisible(settings, "hero") ? (
        <Hero greetingOpen={content.greetingOpen} />
      ) : null}

      {hasQuote && content.quote ? <SekarBlock quote={content.quote} /> : null}

      <Couple groom={content.groom} bride={content.bride} />

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

      {isSectionVisible(settings, "rsvp") ? (
        <section className="kr-section">
          <div className="kr-inner">
            <GuestbookSection slug={data.slug} />
          </div>
        </section>
      ) : null}

      {isSectionVisible(settings, "envelope") && hasEnvelope ? (
        <Envelope envelope={envelope} slug={data.slug} />
      ) : null}

      <Footer
        greetingClose={content.greetingClose}
        watermark={data.watermark}
      />
    </CoverGate>
  );
}

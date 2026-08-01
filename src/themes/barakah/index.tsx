import { Figtree, Marcellus } from "next/font/google";

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

import "./bk.css";
import { BarakahCover } from "./cover";
import { BarakahFx } from "./fx";
import { L, WRONG_CATEGORY } from "./labels";
import {
  Couple,
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
// Marcellus = serif display bertakik lembut (nama & judul, bernuansa klasik);
// Figtree = sans humanis bersih (teks & label). Nuansa islami elegan tanpa aset
// eksternal.
const display = Marcellus({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--bk-display",
  display: "swap",
});
const body = Figtree({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--bk-body",
  display: "swap",
});

/**
 * Tema "Barakah" (wedding islami elegan, tier Story) — acuan
 * `prototypes/barakah-story.html`. SERVER component: section dirender di server
 * (SSR/ISR) lalu dibungkus `CoverGate` (klien) yang memegang cover + musik
 * (`coverMode:'theme'`). TIDAK mengambil data sendiri (SPEC §7.1); section tampil
 * sesuai `settings.sections`. Ornamen: lengkung mihrab (ogee), bintang segi-8
 * (khatam) yang menggambar diri, strip geometris; palet zamrud + emas + pasir.
 */
export default function Barakah({ data }: ThemeComponentProps) {
  const rootClass = `bk ${display.variable} ${body.variable}`;
  const { settings } = data;

  if (data.content.category !== "wedding") {
    return (
      <div className={rootClass}>
        <section className="bk-section bk-center">
          <p className="bk-lead">{WRONG_CATEGORY}</p>
        </section>
      </div>
    );
  }

  const content = data.content;
  const groomName =
    content.groom.nickname || content.groom.name || L.couple.groom;
  const brideName =
    content.bride.nickname || content.bride.name || L.couple.bride;

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
      contentClassName="bk-stage"
      coverClassName="bk-cover"
      musicClassName="bk-music"
      wipeMs={1200}
      music={data.music}
      cover={
        <BarakahCover
          groomName={groomName}
          brideName={brideName}
          dateLabel={heroDateLabel}
        />
      }
      fx={<BarakahFx />}
    >
      <div className="bk-grain" aria-hidden />
      <div className="bk-progress" aria-hidden />

      <Hero
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
        <section className="bk-section">
          <div className="bk-inner">
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

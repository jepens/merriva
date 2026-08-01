import { Bricolage_Grotesque, Figtree } from "next/font/google";

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

import "./festa.css";
import { FestaCover } from "./cover";
import { FestaFx } from "./fx";
import { L } from "./labels";
import {
  CountdownBlock,
  Envelope,
  Footer,
  Gallery,
  Marquee,
  Opening,
  Scallop,
  Schedule,
  Wishes,
} from "./sections";

// Self-hosted (next/font) → tanpa request eksternal (WebView/LCP). Bricolage
// Grotesque = display ekspresif tebal (nama + judul); Figtree = sans humanis
// (teks). Nuansa hangat & meriah.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--ft-disp",
  display: "swap",
});
const body = Figtree({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--ft-body",
  display: "swap",
});

/**
 * Tema "Festa" (family, tier Craft) — acuan `prototypes/family-warm-craft.html`.
 * MEMBUKA kategori family (khitan, ulang tahun, syukuran). SERVER component:
 * section dirender di server lalu dibungkus `CoverGate` (klien) yang memegang
 * cover + musik (`coverMode:'theme'`); confetti burst saat dibuka via `FestaFx`
 * (ParticlesCanvas — TANPA gsap). TIDAK mengambil data sendiri (SPEC §7.1).
 */
export default function Festa({ data }: ThemeComponentProps) {
  const rootClass = `ft ${display.variable} ${body.variable}`;
  const { settings } = data;

  if (data.content.category !== "family") {
    return (
      <div className={rootClass}>
        <section className="ft-section ft-center">
          <p className="ft-lead">{L.wrongCategory}</p>
        </section>
      </div>
    );
  }

  const c = data.content;
  const firstEvent = data.events[0];
  const eventFmt = firstEvent
    ? formatEventDateTime(firstEvent.startAt, settings.timezone)
    : null;
  const dateOnly =
    !eventFmt && data.eventDate ? formatDateOnly(data.eventDate) : null;

  const dateLabel = eventFmt
    ? `${eventFmt.weekday}, ${eventFmt.date}`
    : dateOnly
      ? `${dateOnly.weekday}, ${dateOnly.date}`
      : null;

  const chips = eventFmt
    ? [eventFmt.weekday, eventFmt.date, `${eventFmt.time} ${eventFmt.tzLabel}`]
    : dateOnly
      ? [dateOnly.weekday, dateOnly.date]
      : [];

  const countdownTarget =
    firstEvent?.startAt ??
    (data.eventDate
      ? localToUtc(`${data.eventDate}T00:00`, settings.timezone)
      : null);

  const bigName = c.celebrant || c.eventName;
  const marqueeText = `${c.eventName}${dateLabel ? ` ✦ ${dateLabel}` : ""} ✦ Mohon Doa Restu ✦`;

  const hasOpening = Boolean(
    c.greetingOpen || c.celebrant || c.parents || c.quote?.text,
  );
  const env = c.envelope;
  const hasEnvelope =
    env.enabled &&
    (env.banks.length > 0 ||
      env.ewallets.length > 0 ||
      Boolean(env.giftAddress));

  return (
    <CoverGate
      rootClassName={rootClass}
      contentClassName="ft-stage"
      coverClassName="ft-cover"
      musicClassName="ft-music"
      music={data.music}
      cover={
        <FestaCover eventName={c.eventName} bigName={bigName} chips={chips} />
      }
      fx={<FestaFx />}
    >
      <div className="ft-grain" aria-hidden />

      <Marquee text={marqueeText} />
      <Scallop />

      {hasOpening ? (
        <Opening
          celebrant={c.celebrant}
          parents={c.parents}
          greetingOpen={c.greetingOpen}
          quote={c.quote?.text ? c.quote : undefined}
        />
      ) : null}

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
        <>
          <Scallop teal />
          <Lightbox media={data.media}>
            <Gallery media={data.media} />
          </Lightbox>
        </>
      ) : null}

      {isSectionVisible(settings, "story") && c.wishes.length > 0 ? (
        <Wishes wishes={c.wishes} />
      ) : null}

      {isSectionVisible(settings, "envelope") && hasEnvelope ? (
        <Envelope envelope={env} slug={data.slug} />
      ) : null}

      {isSectionVisible(settings, "rsvp") ? (
        <section className="ft-section">
          <div className="ft-inner">
            <GuestbookSection slug={data.slug} />
          </div>
        </section>
      ) : null}

      <Footer greetingClose={c.greetingClose} watermark={data.watermark} />
    </CoverGate>
  );
}

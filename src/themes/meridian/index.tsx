import { Italiana, Jost } from "next/font/google";

import {
  formatDateOnly,
  formatEventDateTime,
  localToUtc,
} from "@/lib/datetime";
import { isSectionVisible } from "@/lib/validation/content";
import { CoverGate } from "@/themes/_shared/cover-gate";
import { Lightbox } from "@/themes/_shared/lightbox";
import type { ThemeComponentProps } from "@/themes/registry";

import "./mrd.css";
import { MeridianCover } from "./cover";
import { MeridianFx } from "./fx";
import { L } from "./labels";
import {
  CountdownBlock,
  Couple,
  Footer,
  Intro,
  Moments,
  Programme,
  Rsvp,
  WeddingGift,
} from "./sections";

// Self-hosted (next/font) → tanpa request eksternal saat runtime (aman WebView &
// LCP). Italiana = display seni-deco renggang (nama & judul); Jost = geometric
// sans (teks & label). Nuansa gala Art Deco tanpa aset eksternal.
const display = Italiana({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--mrd-display",
  display: "swap",
});
const body = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--mrd-body",
  display: "swap",
});

/**
 * Tema "Meridian" (wedding Art Deco gala, tier Story) — acuan
 * `prototypes/meridian-story.html`. SERVER component: section dirender di server
 * (SSR/ISR) lalu dibungkus `CoverGate` (klien) yang memegang cover + musik
 * (`coverMode:'theme'`). TIDAK mengambil data sendiri (SPEC §7.1); section tampil
 * sesuai `settings.sections`.
 */
export default function Meridian({ data }: ThemeComponentProps) {
  const rootClass = `mrd ${display.variable} ${body.variable}`;
  const { settings } = data;

  if (data.content.category !== "wedding") {
    return (
      <div className={rootClass}>
        <section className="mrd-section mrd-center">
          <p className="mrd-lead">{L.wrongCategory}</p>
        </section>
      </div>
    );
  }

  const content = data.content;
  const brideName =
    content.bride.nickname || content.bride.name || "Mempelai Wanita";
  const groomName =
    content.groom.nickname || content.groom.name || "Mempelai Pria";

  const firstEvent = data.events[0];
  const dateLabel = firstEvent
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

  const env = content.envelope;
  const hasEnvelope =
    env.enabled &&
    (env.banks.length > 0 ||
      env.ewallets.length > 0 ||
      Boolean(env.giftAddress));

  return (
    <CoverGate
      rootClassName={rootClass}
      contentClassName="mrd-stage"
      coverClassName="mrd-cover"
      musicClassName="mrd-music"
      wipeMs={1100}
      music={data.music}
      cover={
        <MeridianCover
          brideName={brideName}
          groomName={groomName}
          dateLabel={dateLabel}
        />
      }
      fx={<MeridianFx />}
    >
      <div className="mrd-grain" aria-hidden />
      <div className="mrd-progress" aria-hidden />

      <Intro greetingOpen={content.greetingOpen} />

      <Couple
        bride={content.bride}
        groom={content.groom}
        bridePhoto={data.bridePhotoUrl}
        groomPhoto={data.groomPhotoUrl}
      />

      {isSectionVisible(settings, "countdown") && countdownTarget ? (
        <CountdownBlock targetIso={countdownTarget} />
      ) : null}

      {isSectionVisible(settings, "schedule") && data.events.length > 0 ? (
        <Programme
          events={data.events}
          tz={settings.timezone}
          slug={data.slug}
        />
      ) : null}

      {isSectionVisible(settings, "gallery") && data.media.length > 0 ? (
        <Lightbox media={data.media}>
          <Moments media={data.media} />
        </Lightbox>
      ) : null}

      {isSectionVisible(settings, "rsvp") ? <Rsvp slug={data.slug} /> : null}

      {isSectionVisible(settings, "envelope") && hasEnvelope ? (
        <WeddingGift envelope={env} />
      ) : null}

      <Footer
        brideName={brideName}
        groomName={groomName}
        greetingClose={content.greetingClose}
        watermark={data.watermark}
      />
    </CoverGate>
  );
}

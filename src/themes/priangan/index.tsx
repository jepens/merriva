import localFont from "next/font/local";
import type { ReactNode } from "react";

import { GuestbookSection } from "@/components/public/guestbook/guestbook-section";
import { appearanceStyle } from "@/lib/customizer/appearance-style";
import { defaultSectionOrder } from "@/lib/customizer/default-order";
import { resolveAppearance } from "@/lib/customizer/resolve";
import {
  formatDateOnly,
  formatEventDateTime,
  localToUtc,
} from "@/lib/datetime";
import { CoverGate } from "@/themes/_shared/cover-gate";
import { hasVideoSection } from "@/themes/_shared/video-gate";
import { Lightbox } from "@/themes/_shared/lightbox";
import type { ThemeComponentProps } from "@/themes/registry";

// CSS tema TIDAK di-import di sini: dikirim sebagai aset statis lewat
// `<ThemeStyles slug="priangan" />` (AUDIT PER-2 / DECISIONS #31). Sumber: ./priangan.css
import { PrianganCover } from "./cover";
import { PrianganFx } from "./fx";
import { prianganOptions } from "./options";
import {
  CountdownBlock,
  Couple,
  Envelope,
  Footer,
  Gallery,
  Hero,
  PepatahBlock,
  Schedule,
  Story,
  VideoSection,
} from "./sections";

// Self-hosted (next/font); SEMUA `preload:false` (AUDIT-2026-09-04 PER-1 —
// lihat catatan di tema lain).
// a: Prata (serif display anggun) + Mulish (humanist sans).
const pgDispA = localFont({
  src: [
    {
      path: "../../fonts/themes/prata-400.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--pg-disp-a",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1.
  preload: false,
});
const pgBodyA = localFont({
  src: [
    {
      path: "../../fonts/themes/mulish-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/mulish-600.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--pg-body-a",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1.
  preload: false,
});
// b: Cormorant Garamond + Karla (berkas sudah ada di repo).
const pgDispB = localFont({
  src: [
    {
      path: "../../fonts/themes/cormorant-garamond-500.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../fonts/themes/cormorant-garamond-600.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--pg-disp-b",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1.
  preload: false,
});
const pgBodyB = localFont({
  src: [
    {
      path: "../../fonts/themes/karla-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/karla-600.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--pg-body-b",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1.
  preload: false,
});

const FONT_VARS = [
  pgDispA.variable,
  pgBodyA.variable,
  pgDispB.variable,
  pgBodyB.variable,
].join(" ");

/**
 * Tema "Priangan" (wedding adat Sunda, tier Story) — acuan
 * `prototypes/priangan-story.html` + THEME-WAVE3 §2.1. Siger line-art, awan,
 * julang ngapak, payung geulis; palet gading + pinus + emas. SERVER component;
 * section tampil sesuai `settings.sections` + customizer. Khusus wedding.
 * Budaya (§3.1): tanpa gunungan/wayang/parang; kujang tidak dipakai.
 */
export default function Priangan({ data }: ThemeComponentProps) {
  const rootClass = `pg ${FONT_VARS}`;
  const { settings } = data;

  if (data.content.category !== "wedding") {
    return (
      <div className={rootClass}>
        <section className="pg-section pg-center">
          <p className="pg-lead">Tema ini khusus untuk undangan pernikahan.</p>
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

  const envelope = content.envelope;
  const hasEnvelope =
    envelope.enabled &&
    (envelope.banks.length > 0 ||
      envelope.ewallets.length > 0 ||
      Boolean(envelope.giftAddress));

  const custom = settings.custom ?? null;
  const resolved = custom ? resolveAppearance(prianganOptions, custom) : null;

  const sectionNodes: Record<string, ReactNode> = {
    hero: <Hero greetingOpen={content.greetingOpen} />,
    quote: <PepatahBlock quote={content.quote} />,
    couple: (
      <Couple
        groom={content.groom}
        bride={content.bride}
        groomPhoto={data.groomPhoto}
        bridePhoto={data.bridePhoto}
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
          livestreamUrl={content.livestreamUrl}
        />
      ) : null,
    story: content.story.length > 0 ? <Story story={content.story} /> : null,
    gallery:
      data.media.length > 0 ? (
        <Lightbox media={data.media}>
          <Gallery media={data.media} />
        </Lightbox>
      ) : null,
    video: hasVideoSection(data.video, content.youtubeUrl) ? (
      <VideoSection video={data.video} youtubeUrl={content.youtubeUrl} />
    ) : null,
    envelope: hasEnvelope ? (
      <Envelope envelope={envelope} slug={data.slug} />
    ) : null,
    rsvp: (
      <section className="pg-section">
        <div className="pg-inner">
          <GuestbookSection slug={data.slug} />
        </div>
      </section>
    ),
  };

  const order =
    resolved?.sections ?? defaultSectionOrder(prianganOptions, settings);

  const grainOn = resolved ? resolved.grain : true;

  const appearance = resolved
    ? {
        style: appearanceStyle(prianganOptions.preview.vars, resolved),
        data: { gallery: resolved.styles.gallery },
        motion: resolved.motion,
      }
    : undefined;

  return (
    <CoverGate
      rootClassName={rootClass}
      contentClassName="pg-stage"
      coverClassName="pg-cover"
      musicClassName="pg-music"
      wipeMs={1000}
      music={data.music}
      appearance={appearance}
      cover={
        <PrianganCover
          brideName={brideName}
          groomName={groomName}
          dateLabel={heroDateLabel}
        />
      }
      fx={<PrianganFx />}
    >
      {grainOn ? <div className="pg-grain" aria-hidden /> : null}

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
        watermark={data.watermark}
      />
    </CoverGate>
  );
}

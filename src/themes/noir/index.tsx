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

// CSS tema TIDAK di-import di sini: ia dikirim sebagai aset statis lewat
// `<ThemeStyles slug="noir" />` supaya undangan tak mengunduh stylesheet
// kesepuluh tema (AUDIT PER-2 / DECISIONS #31). Sumbernya tetap ./noir.css
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
  VideoSection,
} from "./sections";

// Self-hosted (next/font) → tanpa request eksternal saat runtime (WebView/LCP).
// Dua PASANGAN font kurasi (kustomisasi Fase G). Pasangan a:
// SEMUA instance `preload:false` (AUDIT-2026-09-04 PER-1): `next/font` meng-emit
// `<link rel=preload as=font>` untuk SETIAP tema yang tergabung di graph modul
// `/[slug]`, bukan hanya tema yang dipakai — 116 berkas / 2,03 MB per pembukaan
// undangan. Tanpa preload, `@font-face` + `unicode-range` tetap terbit dan
// browser hanya mengunduh slice yang benar-benar dipakai. Cormorant Garamond (serif Garalde sinematik) + Jost
// (geometric sans). Pasangan b: Playfair Display (serif high-contrast) +
// Montserrat (grotesk geometris) — kontras tinggi & monokrom, cocok DNA noir.
const nrDispA = localFont({
  src: [
    {
      path: "../../fonts/themes/cormorant-garamond-300.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../fonts/themes/cormorant-garamond-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/cormorant-garamond-500.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../fonts/themes/cormorant-garamond-300-italic.woff2",
      weight: "300",
      style: "italic",
    },
    {
      path: "../../fonts/themes/cormorant-garamond-400-italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../fonts/themes/cormorant-garamond-500-italic.woff2",
      weight: "500",
      style: "italic",
    },
  ],
  variable: "--nr-disp-a",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1 di atas.
  preload: false,
});
const nrBodyA = localFont({
  src: [
    {
      path: "../../fonts/themes/jost-300.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../fonts/themes/jost-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/jost-500.woff2",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--nr-body-a",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1 di atas.
  preload: false,
});
const nrDispB = localFont({
  src: [
    {
      path: "../../fonts/themes/playfair-display-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/playfair-display-500.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../fonts/themes/playfair-display-600.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../fonts/themes/playfair-display-700.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../fonts/themes/playfair-display-400-italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../fonts/themes/playfair-display-500-italic.woff2",
      weight: "500",
      style: "italic",
    },
    {
      path: "../../fonts/themes/playfair-display-600-italic.woff2",
      weight: "600",
      style: "italic",
    },
    {
      path: "../../fonts/themes/playfair-display-700-italic.woff2",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--nr-disp-b",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1 di atas.
  preload: false,
});
const nrBodyB = localFont({
  src: [
    {
      path: "../../fonts/themes/montserrat-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/montserrat-500.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../fonts/themes/montserrat-600.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--nr-body-b",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1 di atas.
  preload: false,
});

const FONT_VARS = [
  nrDispA.variable,
  nrBodyA.variable,
  nrDispB.variable,
  nrBodyB.variable,
].join(" ");

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
  const rootClass = `nr ${FONT_VARS}`;
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
    gallery:
      data.media.length > 0 ? (
        <Lightbox media={data.media}>
          <Gallery media={data.media} />
        </Lightbox>
      ) : null,
    video: hasVideoSection(data.video, content.youtubeUrl) ? (
      <VideoSection video={data.video} youtubeUrl={content.youtubeUrl} />
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

  const order =
    resolved?.sections ?? defaultSectionOrder(noirOptions, settings);

  const grainOn = resolved ? resolved.grain : true;

  const appearance = resolved
    ? {
        style: appearanceStyle(noirOptions.preview.vars, resolved),
        data: { gallery: resolved.styles.gallery },
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

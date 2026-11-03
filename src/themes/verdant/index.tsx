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
import { Lightbox } from "@/themes/_shared/lightbox";
import type { ThemeComponentProps } from "@/themes/registry";

// CSS tema TIDAK di-import di sini: ia dikirim sebagai aset statis lewat
// `<ThemeStyles slug="verdant" />` supaya undangan tak mengunduh stylesheet
// kesepuluh tema (AUDIT PER-2 / DECISIONS #31). Sumbernya tetap ./verdant.css
import { VerdantCover } from "./cover";
import { VerdantFx } from "./fx";
import { verdantOptions } from "./options";
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

// Self-hosted (next/font) → tanpa request eksternal saat runtime (WebView/LCP).
// Dua PASANGAN font kurasi (kustomisasi Fase G).
// SEMUA instance `preload:false` (AUDIT-2026-09-04 PER-1): `next/font` meng-emit
// `<link rel=preload as=font>` untuk SETIAP tema yang tergabung di graph modul
// `/[slug]`, bukan hanya tema yang dipakai — 116 berkas / 2,03 MB per pembukaan
// undangan. Tanpa preload, `@font-face` + `unicode-range` tetap terbit dan
// browser hanya mengunduh slice yang benar-benar dipakai.
// a) EB Garamond = serif Garalde lembut (nama + judul, italic botanikal); Karla
// = grotesque humanis (teks/label). Nuansa buku sketsa botani.
// b) Cormorant Garamond = serif display high-contrast anggun; Nunito Sans = sans
// humanis hangat, mudah dibaca di WebView WhatsApp.
const vdDispA = localFont({
  src: [
    {
      path: "../../fonts/themes/eb-garamond-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/eb-garamond-500.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../fonts/themes/eb-garamond-400-italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../fonts/themes/eb-garamond-500-italic.woff2",
      weight: "500",
      style: "italic",
    },
  ],
  variable: "--vd-disp-a",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1 di atas.
  preload: false,
});
const vdBodyA = localFont({
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
  variable: "--vd-body-a",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1 di atas.
  preload: false,
});
const vdDispB = localFont({
  src: [
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
      path: "../../fonts/themes/cormorant-garamond-600.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../fonts/themes/cormorant-garamond-700.woff2",
      weight: "700",
      style: "normal",
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
    {
      path: "../../fonts/themes/cormorant-garamond-600-italic.woff2",
      weight: "600",
      style: "italic",
    },
    {
      path: "../../fonts/themes/cormorant-garamond-700-italic.woff2",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--vd-disp-b",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1 di atas.
  preload: false,
});
const vdBodyB = localFont({
  src: [
    {
      path: "../../fonts/themes/nunito-sans-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/nunito-sans-600.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../fonts/themes/nunito-sans-700.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--vd-body-b",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1 di atas.
  preload: false,
});

/**
 * Tema "Verdant" (wedding botanikal ilustratif, tier Story) — acuan
 * `prototypes/flora-atelier-story.html`. SERVER component: section dirender di
 * server (SSR/ISR) lalu dibungkus `CoverGate` (klien) yang memegang cover +
 * musik (`coverMode:'theme'`). TIDAK mengambil data sendiri (SPEC §7.1); section
 * tampil sesuai `settings.sections`.
 */
export default function Verdant({ data }: ThemeComponentProps) {
  const rootClass = `vd ${vdDispA.variable} ${vdBodyA.variable} ${vdDispB.variable} ${vdBodyB.variable}`;
  const { settings } = data;

  if (data.content.category !== "wedding") {
    return (
      <div className={rootClass}>
        <section className="vd-section vd-center">
          <p className="vd-lead">Tema ini khusus untuk undangan pernikahan.</p>
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
  const resolved = custom ? resolveAppearance(verdantOptions, custom) : null;

  const sectionNodes: Record<string, ReactNode> = {
    hero: (
      <Hero
        groomName={groomName}
        brideName={brideName}
        greetingOpen={content.greetingOpen}
      />
    ),
    quote: hasQuote ? <QuoteBlock quote={content.quote} /> : null,
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
      <section className="vd-section">
        <div className="vd-inner">
          <GuestbookSection slug={data.slug} />
        </div>
      </section>
    ),
  };

  const order =
    resolved?.sections ?? defaultSectionOrder(verdantOptions, settings);

  const grainOn = resolved ? resolved.grain : true;

  const appearance = resolved
    ? {
        style: appearanceStyle(verdantOptions.preview.vars, resolved),
        motion: resolved.motion,
      }
    : undefined;

  return (
    <CoverGate
      rootClassName={rootClass}
      contentClassName="vd-stage"
      coverClassName="vd-cover"
      musicClassName="vd-music"
      music={data.music}
      appearance={appearance}
      cover={
        <VerdantCover
          groomName={groomName}
          brideName={brideName}
          dateLabel={heroDateLabel}
        />
      }
      fx={<VerdantFx />}
    >
      {grainOn ? <div className="vd-grain" aria-hidden /> : null}
      <div className="vd-progress" aria-hidden />

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

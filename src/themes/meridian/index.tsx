import localFont from "next/font/local";
import type { ReactNode } from "react";

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
// `<ThemeStyles slug="meridian" />` supaya undangan tak mengunduh stylesheet
// kesepuluh tema (AUDIT PER-2 / DECISIONS #31). Sumbernya tetap ./mrd.css
import { MeridianCover } from "./cover";
import { MeridianFx } from "./fx";
import { L } from "./labels";
import { meridianOptions } from "./options";
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
// LCP). Dua PASANGAN font kurasi (kustomisasi Fase G).
// SEMUA instance `preload:false` (AUDIT-2026-09-04 PER-1): `next/font` meng-emit
// `<link rel=preload as=font>` untuk SETIAP tema yang tergabung di graph modul
// `/[slug]`, bukan hanya tema yang dipakai — 116 berkas / 2,03 MB per pembukaan
// undangan. Tanpa preload, `@font-face` + `unicode-range` tetap terbit dan
// browser hanya mengunduh slice yang benar-benar dipakai.
// a: Italiana (display seni-deco renggang) + Jost (geometric sans).
const mrdDispA = localFont({
  src: [
    {
      path: "../../fonts/themes/italiana-400.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--mrd-disp-a",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1 di atas.
  preload: false,
});
const mrdBodyA = localFont({
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
  variable: "--mrd-body-a",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1 di atas.
  preload: false,
});
// b: Bodoni Moda (display serif Didone kontras-tinggi, set italic lengkap) +
// Jost (sans geometris) — pasangan editorial/high-fashion, DNA premium Meridian.
const mrdDispB = localFont({
  src: [
    {
      path: "../../fonts/themes/bodoni-moda-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/bodoni-moda-500.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../fonts/themes/bodoni-moda-600.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../fonts/themes/bodoni-moda-700.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../fonts/themes/bodoni-moda-400-italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../fonts/themes/bodoni-moda-500-italic.woff2",
      weight: "500",
      style: "italic",
    },
    {
      path: "../../fonts/themes/bodoni-moda-600-italic.woff2",
      weight: "600",
      style: "italic",
    },
    {
      path: "../../fonts/themes/bodoni-moda-700-italic.woff2",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--mrd-disp-b",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1 di atas.
  preload: false,
});
const mrdBodyB = localFont({
  src: [
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
    {
      path: "../../fonts/themes/jost-600.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--mrd-body-b",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1 di atas.
  preload: false,
});

const FONT_VARS = [
  mrdDispA.variable,
  mrdBodyA.variable,
  mrdDispB.variable,
  mrdBodyB.variable,
].join(" ");

/**
 * Tema "Meridian" (wedding Art Deco gala, tier Story) — acuan
 * `prototypes/meridian-story.html`. SERVER component: section dirender di server
 * (SSR/ISR) lalu dibungkus `CoverGate` (klien) yang memegang cover + musik
 * (`coverMode:'theme'`). TIDAK mengambil data sendiri (SPEC §7.1); section tampil
 * sesuai `settings.sections`.
 */
export default function Meridian({ data }: ThemeComponentProps) {
  const rootClass = `mrd ${FONT_VARS}`;
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

  const custom = settings.custom ?? null;
  const resolved = custom ? resolveAppearance(meridianOptions, custom) : null;

  const sectionNodes: Record<string, ReactNode> = {
    hero: <Intro greetingOpen={content.greetingOpen} />,
    couple: (
      <Couple
        bride={content.bride}
        groom={content.groom}
        bridePhoto={data.bridePhoto}
        groomPhoto={data.groomPhoto}
      />
    ),
    countdown: countdownTarget ? (
      <CountdownBlock targetIso={countdownTarget} />
    ) : null,
    schedule:
      data.events.length > 0 ? (
        <Programme
          events={data.events}
          tz={settings.timezone}
          slug={data.slug}
        />
      ) : null,
    gallery:
      data.media.length > 0 ? (
        <Lightbox media={data.media}>
          <Moments media={data.media} />
        </Lightbox>
      ) : null,
    rsvp: <Rsvp slug={data.slug} />,
    envelope: hasEnvelope ? <WeddingGift envelope={env} /> : null,
  };

  const order =
    resolved?.sections ?? defaultSectionOrder(meridianOptions, settings);

  const grainOn = resolved ? resolved.grain : true;

  const appearance = resolved
    ? {
        style: appearanceStyle(meridianOptions.preview.vars, resolved),
        data: { gallery: resolved.styles.gallery },
        motion: resolved.motion,
      }
    : undefined;

  return (
    <CoverGate
      rootClassName={rootClass}
      contentClassName="mrd-stage"
      coverClassName="mrd-cover"
      musicClassName="mrd-music"
      wipeMs={1100}
      music={data.music}
      appearance={appearance}
      cover={
        <MeridianCover
          brideName={brideName}
          groomName={groomName}
          dateLabel={dateLabel}
        />
      }
      fx={<MeridianFx />}
    >
      {grainOn ? <div className="mrd-grain" aria-hidden /> : null}
      <div className="mrd-progress" aria-hidden />

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
        brideName={brideName}
        groomName={groomName}
        greetingClose={content.greetingClose}
        watermark={data.watermark}
      />
    </CoverGate>
  );
}

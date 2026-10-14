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
// `<ThemeStyles slug="barakah" />` supaya undangan tak mengunduh stylesheet
// kesepuluh tema (AUDIT PER-2 / DECISIONS #31). Sumbernya tetap ./bk.css
import { BarakahCover } from "./cover";
import { BarakahFx } from "./fx";
import { L, WRONG_CATEGORY } from "./labels";
import { barakahOptions } from "./options";
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
// DUA PASANGAN font kurasi (kustomisasi Fase G — anggaran font).
// SEMUA instance `preload:false` (AUDIT-2026-09-04 PER-1): `next/font` meng-emit
// `<link rel=preload as=font>` untuk SETIAP tema yang tergabung di graph modul
// `/[slug]`, bukan hanya tema yang dipakai — 116 berkas / 2,03 MB per pembukaan
// undangan. Tanpa preload, `@font-face` + `unicode-range` tetap terbit dan
// browser hanya mengunduh slice yang benar-benar dipakai.
// a: Marcellus = serif display bertakik lembut (nama & judul); Figtree = sans
// humanis bersih (teks). b: Cormorant Garamond = serif kontras-tinggi bergaya
// Garamond (nama & ayat); Jost = sans geometris bersih (keterbacaan body).
const dispA = localFont({
  src: [
    {
      path: "../../fonts/themes/marcellus-400.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--bk-disp-a",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1 di atas.
  preload: false,
});
const bodyA = localFont({
  src: [
    {
      path: "../../fonts/themes/figtree-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/figtree-600.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--bk-body-a",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1 di atas.
  preload: false,
});
const dispB = localFont({
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
  variable: "--bk-disp-b",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1 di atas.
  preload: false,
});
const bodyB = localFont({
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
  variable: "--bk-body-b",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1 di atas.
  preload: false,
});

const FONT_VARS = [
  dispA.variable,
  bodyA.variable,
  dispB.variable,
  bodyB.variable,
].join(" ");

/**
 * Tema "Barakah" (wedding islami elegan, tier Story) — acuan
 * `prototypes/barakah-story.html`. SERVER component: section dirender di server
 * (SSR/ISR) lalu dibungkus `CoverGate` (klien) yang memegang cover + musik
 * (`coverMode:'theme'`). TIDAK mengambil data sendiri (SPEC §7.1); section tampil
 * sesuai `settings.sections`. Ornamen: lengkung mihrab (ogee), bintang segi-8
 * (khatam) yang menggambar diri, strip geometris; palet zamrud + emas + pasir.
 */
export default function Barakah({ data }: ThemeComponentProps) {
  const rootClass = `bk ${FONT_VARS}`;
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

  const custom = settings.custom ?? null;
  const resolved = custom ? resolveAppearance(barakahOptions, custom) : null;

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
      <section className="bk-section">
        <div className="bk-inner">
          <GuestbookSection slug={data.slug} />
        </div>
      </section>
    ),
  };

  const order =
    resolved?.sections ?? defaultSectionOrder(barakahOptions, settings);

  const grainOn = resolved ? resolved.grain : true;

  const appearance = resolved
    ? {
        style: appearanceStyle(barakahOptions.preview.vars, resolved),
        data: { gallery: resolved.styles.gallery },
        motion: resolved.motion,
      }
    : undefined;

  return (
    <CoverGate
      rootClassName={rootClass}
      contentClassName="bk-stage"
      coverClassName="bk-cover"
      musicClassName="bk-music"
      wipeMs={1200}
      music={data.music}
      appearance={appearance}
      cover={
        <BarakahCover
          groomName={groomName}
          brideName={brideName}
          dateLabel={heroDateLabel}
        />
      }
      fx={<BarakahFx />}
    >
      {grainOn ? <div className="bk-grain" aria-hidden /> : null}
      <div className="bk-progress" aria-hidden />

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

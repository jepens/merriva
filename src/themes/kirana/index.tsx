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
// `<ThemeStyles slug="kirana" />` supaya undangan tak mengunduh stylesheet
// kesepuluh tema (AUDIT PER-2 / DECISIONS #31). Sumbernya tetap ./kr.css
import { KiranaCover } from "./cover";
import { KiranaFx } from "./fx";
import { kiranaOptions } from "./options";
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
// Dua PASANGAN font kurasi (kustomisasi Fase G, anggaran font).
// SEMUA instance `preload:false` (AUDIT-2026-09-04 PER-1): `next/font` meng-emit
// `<link rel=preload as=font>` untuk SETIAP tema yang tergabung di graph modul
// `/[slug]`, bukan hanya tema yang dipakai — 116 berkas / 2,03 MB per pembukaan
// undangan. Tanpa preload, `@font-face` + `unicode-range` tetap terbit dan
// browser hanya mengunduh slice yang benar-benar dipakai.
// a: Cormorant Upright (display serif tegak) + Figtree (humanist sans).
const dispA = localFont({
  src: [
    {
      path: "../../fonts/themes/cormorant-upright-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/cormorant-upright-500.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../fonts/themes/cormorant-upright-600.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--kr-disp-a",
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
  variable: "--kr-body-a",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1 di atas.
  preload: false,
});
// b: Playfair Display (serif editorial elegan, italic) + Karla (grotesque bersih).
const dispB = localFont({
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
  variable: "--kr-disp-b",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1 di atas.
  preload: false,
});
const bodyB = localFont({
  src: [
    {
      path: "../../fonts/themes/karla-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/karla-500.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../fonts/themes/karla-600.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../fonts/themes/karla-700.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--kr-body-b",
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
 * Tema "Kirana" (wedding adat Jawa modern, tier Story) — acuan
 * `prototypes/kirana-story.html`. Motif truntum & gunungan line-art, palet
 * sogan, rangkaian upacara termasuk Panggih. SERVER component: section dirender
 * di server (SSR/ISR) lalu dibungkus `CoverGate` (klien) yang memegang cover +
 * musik (`coverMode:'theme'`). TIDAK mengambil data sendiri (SPEC §7.1); section
 * tampil sesuai `settings.sections`. Khusus kategori pernikahan.
 */
export default function Kirana({ data }: ThemeComponentProps) {
  const rootClass = `kr ${FONT_VARS}`;
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

  const custom = settings.custom ?? null;
  const resolved = custom ? resolveAppearance(kiranaOptions, custom) : null;

  const sectionNodes: Record<string, ReactNode> = {
    hero: <Hero greetingOpen={content.greetingOpen} />,
    quote:
      hasQuote && content.quote ? <SekarBlock quote={content.quote} /> : null,
    couple: (
      <Couple
        groom={content.groom}
        bride={content.bride}
        groomPhoto={data.groomPhotoUrl}
        bridePhoto={data.bridePhotoUrl}
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
    rsvp: (
      <section className="kr-section">
        <div className="kr-inner">
          <GuestbookSection slug={data.slug} />
        </div>
      </section>
    ),
    envelope: hasEnvelope ? (
      <Envelope envelope={envelope} slug={data.slug} />
    ) : null,
  };

  const order =
    resolved?.sections ?? defaultSectionOrder(kiranaOptions, settings);

  const grainOn = resolved ? resolved.grain : true;

  const appearance = resolved
    ? {
        style: appearanceStyle(kiranaOptions.preview.vars, resolved),
        data: { gallery: resolved.styles.gallery },
        motion: resolved.motion,
      }
    : undefined;

  return (
    <CoverGate
      rootClassName={rootClass}
      contentClassName="kr-stage"
      coverClassName="kr-cover"
      musicClassName="kr-music"
      wipeMs={1100}
      music={data.music}
      appearance={appearance}
      cover={
        <KiranaCover
          brideName={brideName}
          groomName={groomName}
          dateLabel={heroDateLabel}
        />
      }
      fx={<KiranaFx />}
    >
      {grainOn ? <div className="kr-grain" aria-hidden /> : null}
      <div className="kr-progress" aria-hidden />

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

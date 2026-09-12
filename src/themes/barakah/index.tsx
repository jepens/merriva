import { Cormorant_Garamond, Figtree, Jost, Marcellus } from "next/font/google";
import type { ReactNode } from "react";

import { GuestbookSection } from "@/components/public/guestbook/guestbook-section";
import { appearanceStyle } from "@/lib/customizer/appearance-style";
import { resolveAppearance } from "@/lib/customizer/resolve";
import {
  formatDateOnly,
  formatEventDateTime,
  localToUtc,
} from "@/lib/datetime";
import { isSectionVisible, type SectionKey } from "@/lib/validation/content";
import { CoverGate } from "@/themes/_shared/cover-gate";
import { Lightbox } from "@/themes/_shared/lightbox";
import type { ThemeComponentProps } from "@/themes/registry";

import "./bk.css";
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

/** Section yang bisa disembunyikan lewat toggle lama (`settings.sections`). */
const LEGACY_TOGGLE = new Set<SectionKey>([
  "countdown",
  "schedule",
  "gallery",
  "story",
  "envelope",
  "rsvp",
]);
const isLegacyToggle = (id: string): id is SectionKey =>
  LEGACY_TOGGLE.has(id as SectionKey);

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
const dispA = Marcellus({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--bk-disp-a",
  display: "swap",
  preload: false,
});
const bodyA = Figtree({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--bk-body-a",
  display: "swap",
  preload: false,
});
const dispB = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--bk-disp-b",
  display: "swap",
  preload: false,
});
const bodyB = Jost({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--bk-body-b",
  display: "swap",
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

  const order = resolved
    ? resolved.sections
    : barakahOptions.sections.map((s) => ({
        id: s.id,
        visible: isLegacyToggle(s.id) ? isSectionVisible(settings, s.id) : true,
      }));

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

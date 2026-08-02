import {
  Cormorant_Upright,
  Figtree,
  Karla,
  Playfair_Display,
} from "next/font/google";
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

import "./kr.css";
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

/** Section yang bisa disembunyikan lewat toggle lama (`settings.sections`). */
const LEGACY_TOGGLE = new Set<SectionKey>([
  "hero",
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
// Dua PASANGAN font kurasi (kustomisasi Fase G, anggaran font). Pasangan "a" =
// bawaan → di-preload; "b" `preload:false` (hanya diunduh saat dipilih; tanpa
// @font-face tak dipakai = tak di-fetch → halaman default utuh).
// a: Cormorant Upright (display serif tegak) + Figtree (humanist sans).
const dispA = Cormorant_Upright({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--kr-disp-a",
  display: "swap",
});
const bodyA = Figtree({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--kr-body-a",
  display: "swap",
});
// b: Playfair Display (serif editorial elegan, italic) + Karla (grotesque bersih).
const dispB = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--kr-disp-b",
  display: "swap",
  preload: false,
});
const bodyB = Karla({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--kr-body-b",
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

  const order = resolved
    ? resolved.sections
    : kiranaOptions.sections.map((s) => ({
        id: s.id,
        visible: isLegacyToggle(s.id) ? isSectionVisible(settings, s.id) : true,
      }));

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

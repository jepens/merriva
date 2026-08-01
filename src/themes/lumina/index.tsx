import { Gowun_Batang, Karla } from "next/font/google";
import type { ReactNode } from "react";

import { GuestbookSection } from "@/components/public/guestbook/guestbook-section";
import {
  formatDateOnly,
  formatEventDateTime,
  localToUtc,
} from "@/lib/datetime";
import { isSectionVisible } from "@/lib/validation/content";
import { CoverGate } from "@/themes/_shared/cover-gate";
import type { StoryEntry } from "@/lib/validation/content";
import type { ThemeComponentProps } from "@/themes/registry";

import "./lm.css";
import { LuminaCover } from "./cover";
import { L } from "./labels";
import {
  CelebrantBlock,
  CountdownBlock,
  CoupleBlock,
  Envelope,
  Footer,
  Gallery,
  Intro,
  OrganizerBlock,
  Schedule,
  Timeline,
} from "./sections";

// Self-hosted (next/font) → tanpa request eksternal (WebView/LCP). Gowun Batang =
// serif buku lembut (display + nama), Karla = humanist sans (teks/label). Estetika
// "soft film / Korean-minimal": tenang, hangat, banyak ruang napas. Netral &
// adaptif untuk SEMUA kategori.
const display = Gowun_Batang({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--lm-display",
  display: "swap",
});
const body = Karla({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--lm-body",
  display: "swap",
});

/**
 * Tema "Lumina" (universal, tier Craft) — acuan `prototypes/lumina-craft.html`.
 * Sistem netral tunggal yang MENYESUAIKAN ke kategori apa pun
 * (wedding/corporate/family): menormalkan konten menjadi judul, principals, dan
 * linimasa (story/agenda/wishes). SERVER component dibungkus `CoverGate` (klien)
 * yang memegang cover film + musik (`coverMode:'theme'`). TANPA canvas/gsap/lenis
 * — reveal via `Reveal` (IO). TIDAK mengambil data sendiri (SPEC §7.1).
 */
export default function Lumina({ data }: ThemeComponentProps) {
  const rootClass = `lm ${display.variable} ${body.variable}`;
  const { settings, content } = data;

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

  // Normalisasi per kategori: judul, subjudul, principals, linimasa.
  let titleLines: string[];
  let subtitle: string | undefined;
  let description: string | undefined;
  let principals: ReactNode = null;
  let timelineItems: StoryEntry[] = [];
  let timelineLabel: { eyebrow: string; heading: string };

  if (content.category === "wedding") {
    const g = content.groom.nickname || content.groom.name || "Mempelai Pria";
    const b = content.bride.nickname || content.bride.name || "Mempelai Wanita";
    titleLines = [g, b];
    principals = <CoupleBlock groom={content.groom} bride={content.bride} />;
    timelineItems = content.story;
    timelineLabel = L.timeline.wedding;
  } else if (content.category === "corporate") {
    titleLines = [content.eventName];
    subtitle = content.organizer;
    description = content.description;
    principals =
      content.organizer || content.pic ? (
        <OrganizerBlock organizer={content.organizer} pic={content.pic} />
      ) : null;
    timelineItems = content.agenda;
    timelineLabel = L.timeline.corporate;
  } else {
    titleLines = [content.eventName];
    subtitle = content.celebrant;
    principals =
      content.celebrant || content.parents ? (
        <CelebrantBlock
          celebrant={content.celebrant}
          parents={content.parents}
        />
      ) : null;
    timelineItems = content.wishes;
    timelineLabel = L.timeline.family;
  }

  const coverSub = subtitle ?? L.cover.invite[content.category];

  const hasIntro = Boolean(
    content.greetingOpen || description || content.quote?.text,
  );
  const env = content.envelope;
  const hasEnvelope =
    env.enabled &&
    (env.banks.length > 0 ||
      env.ewallets.length > 0 ||
      Boolean(env.giftAddress));

  return (
    <CoverGate
      rootClassName={rootClass}
      contentClassName="lm-stage"
      coverClassName="lm-cover"
      musicClassName="lm-music"
      wipeMs={1000}
      music={data.music}
      cover={
        <LuminaCover
          titleLines={titleLines}
          sub={coverSub}
          dateLabel={dateLabel}
        />
      }
    >
      <div className="lm-grain" aria-hidden />

      {hasIntro ? (
        <Intro
          greetingOpen={content.greetingOpen}
          description={description}
          quote={content.quote?.text ? content.quote : undefined}
        />
      ) : null}

      {principals}

      {isSectionVisible(settings, "countdown") && countdownTarget ? (
        <CountdownBlock targetIso={countdownTarget} />
      ) : null}

      {isSectionVisible(settings, "story") && timelineItems.length > 0 ? (
        <Timeline label={timelineLabel} items={timelineItems} />
      ) : null}

      {isSectionVisible(settings, "schedule") && data.events.length > 0 ? (
        <Schedule
          events={data.events}
          tz={settings.timezone}
          slug={data.slug}
        />
      ) : null}

      {isSectionVisible(settings, "gallery") && data.media.length > 0 ? (
        <Gallery media={data.media} />
      ) : null}

      {isSectionVisible(settings, "envelope") && hasEnvelope ? (
        <Envelope envelope={env} slug={data.slug} />
      ) : null}

      {isSectionVisible(settings, "rsvp") ? (
        <section className="lm-section">
          <div className="lm-inner">
            <GuestbookSection slug={data.slug} />
          </div>
        </section>
      ) : null}

      <Footer
        greetingClose={content.greetingClose}
        title={titleLines.join(" & ")}
        watermark={data.watermark}
      />
    </CoverGate>
  );
}

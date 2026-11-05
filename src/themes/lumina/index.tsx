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
import type { StoryEntry } from "@/lib/validation/content";
import type { ThemeComponentProps } from "@/themes/registry";

// CSS tema TIDAK di-import di sini: ia dikirim sebagai aset statis lewat
// `<ThemeStyles slug="lumina" />` supaya undangan tak mengunduh stylesheet
// kesepuluh tema (AUDIT PER-2 / DECISIONS #31). Sumbernya tetap ./lm.css
import { LuminaCover } from "./cover";
import { LuminaFx } from "./fx";
import { L } from "./labels";
import { luminaOptions } from "./options";
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
  VideoSection,
} from "./sections";

// Self-hosted (next/font) → tanpa request eksternal (WebView/LCP). Spectral =
// serif buku layar kontras-rendah (display + nama), Karla = humanist sans
// (teks/label). Estetika "soft film / Korean-minimal": tenang, hangat, banyak
// ruang napas. Netral & adaptif untuk SEMUA kategori.
//
// Gowun Batang (font Korea) DIGANTI pada AUDIT-2026-09-04 PER-1/PER-2: Google
// menyajikannya sebagai 95 slice `unicode-range` = 1.465 KB font + 93 KB
// `@font-face` CSS RENDER-BLOCKING di setiap undangan, padahal konten Merriva
// seluruhnya Latin. Spectral menyampaikan karakter serif-buku yang sama dengan
// 4 berkas. `preload:false` — lihat catatan PER-1 di tema lain.
const lmDisplay = localFont({
  src: [
    {
      path: "../../fonts/themes/spectral-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/spectral-700.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--lm-display",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1 di atas.
  preload: false,
});
const lmBody = localFont({
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
  variable: "--lm-body",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1 di atas.
  preload: false,
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
  const rootClass = `lm ${lmDisplay.variable} ${lmBody.variable}`;
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
    principals = (
      <CoupleBlock
        groom={content.groom}
        bride={content.bride}
        groomPhoto={data.groomPhoto}
        bridePhoto={data.bridePhoto}
      />
    );
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

  const custom = settings.custom ?? null;
  const resolved = custom ? resolveAppearance(luminaOptions, custom) : null;

  const sectionNodes: Record<string, ReactNode> = {
    hero: hasIntro ? (
      <Intro
        greetingOpen={content.greetingOpen}
        description={description}
        quote={content.quote?.text ? content.quote : undefined}
      />
    ) : null,
    couple: principals,
    countdown: countdownTarget ? (
      <CountdownBlock targetIso={countdownTarget} />
    ) : null,
    story:
      timelineItems.length > 0 ? (
        <Timeline label={timelineLabel} items={timelineItems} />
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
    video: hasVideoSection(data.video, content.youtubeUrl) ? (
      <VideoSection video={data.video} youtubeUrl={content.youtubeUrl} />
    ) : null,
    envelope: hasEnvelope ? <Envelope envelope={env} slug={data.slug} /> : null,
    rsvp: (
      <section className="lm-section">
        <div className="lm-inner">
          <GuestbookSection slug={data.slug} />
        </div>
      </section>
    ),
  };

  const order =
    resolved?.sections ?? defaultSectionOrder(luminaOptions, settings);

  const grainOn = resolved ? resolved.grain : true;

  const appearance = resolved
    ? {
        style: appearanceStyle(luminaOptions.preview.vars, resolved),
        motion: resolved.motion,
      }
    : undefined;

  return (
    <CoverGate
      rootClassName={rootClass}
      contentClassName="lm-stage"
      coverClassName="lm-cover"
      musicClassName="lm-music"
      wipeMs={1000}
      music={data.music}
      appearance={appearance}
      cover={
        <LuminaCover
          titleLines={titleLines}
          sub={coverSub}
          dateLabel={dateLabel}
        />
      }
      fx={<LuminaFx />}
    >
      {grainOn ? <div className="lm-grain" aria-hidden /> : null}

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
        title={titleLines.join(" & ")}
        watermark={data.watermark}
      />
    </CoverGate>
  );
}

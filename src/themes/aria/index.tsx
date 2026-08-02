import { Instrument_Serif, Inter } from "next/font/google";
import type { ReactNode } from "react";

import { appearanceStyle } from "@/lib/customizer/appearance-style";
import { resolveAppearance } from "@/lib/customizer/resolve";
import {
  formatDateOnly,
  formatEventDateTime,
  localToUtc,
} from "@/lib/datetime";
import { isSectionVisible } from "@/lib/validation/content";
import { CoverGate } from "@/themes/_shared/cover-gate";
import { Lightbox } from "@/themes/_shared/lightbox";
import type { ThemeComponentProps } from "@/themes/registry";

import "./aria.css";
import { AriaCover } from "./cover";
import { L } from "./labels";
import { ariaOptions } from "./options";
import {
  Couple,
  CountdownSection,
  EventBlock,
  Footer,
  Gallery,
  Gift,
  Opening,
  Rsvp,
  StoryBlock,
} from "./sections";

// Self-hosted (next/font) → tanpa request eksternal (WebView/LCP). Instrument
// Serif = serif display kontras tinggi (judul + angka italic); Inter = grotesque
// netral (teks/label). Monokrom minimalis — aksen merah tunggal.
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--ar-serif",
  display: "swap",
});
const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--ar-sans",
  display: "swap",
});

/**
 * Tema "Aria" (wedding, minimalis galeri, tier Craft) — acuan
 * `prototypes/mono-universal-craft.html`. Section bernomor, whitespace ekstrem,
 * aksen merah tunggal. TANPA canvas/gsap/lenis — hanya CSS + `Reveal` (IO). SERVER
 * component dibungkus `CoverGate` (klien) yang memegang cover + musik
 * (`coverMode:'theme'`). TIDAK mengambil data sendiri (SPEC §7.1).
 */
export default function Aria({ data }: ThemeComponentProps) {
  const rootClass = `ar ${serif.variable} ${sans.variable}`;
  const { settings } = data;

  if (data.content.category !== "wedding") {
    return (
      <div className={rootClass}>
        <section className="ar-section">
          <p className="ar-body">{L.wrongCategory}</p>
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

  const showOpening = Boolean(content.greetingOpen || content.quote?.text);
  const showCountdown =
    isSectionVisible(settings, "countdown") && Boolean(countdownTarget);
  const showSchedule =
    isSectionVisible(settings, "schedule") && data.events.length > 0;
  const showGallery =
    isSectionVisible(settings, "gallery") && data.media.length > 0;
  const showStory =
    isSectionVisible(settings, "story") && content.story.length > 0;
  const showEnvelope = isSectionVisible(settings, "envelope") && hasEnvelope;
  const showRsvp = isSectionVisible(settings, "rsvp");

  // Kustomisasi (Fase G). Tanpa `custom` → render legacy PERSIS (di bawah).
  // Dengan `custom` → section-map bernomor sesuai urutan resolver (countdown
  // menyatu di blok Acara). Aria = tema bernomor/gabungan → dua jalur (aman).
  const custom = settings.custom ?? null;
  const resolved = custom ? resolveAppearance(ariaOptions, custom) : null;

  if (resolved) {
    const grainOn = resolved.grain;
    const appearance = {
      style: appearanceStyle(ariaOptions.preview.vars, resolved),
      motion: resolved.motion,
    };
    const defs: Record<
      string,
      { has: boolean; render: (no: string) => ReactNode }
    > = {
      opening: {
        has: showOpening,
        render: (no) => (
          <Opening
            no={no}
            greetingOpen={content.greetingOpen}
            quote={content.quote?.text ? content.quote : undefined}
          />
        ),
      },
      couple: {
        has: true,
        render: (no) => (
          <Couple no={no} groom={content.groom} bride={content.bride} />
        ),
      },
      schedule: {
        has: data.events.length > 0,
        render: (no) => (
          <EventBlock
            no={no}
            events={data.events}
            tz={settings.timezone}
            slug={data.slug}
            countdownTarget={countdownTarget}
          />
        ),
      },
      gallery: {
        has: data.media.length > 0,
        render: (no) => (
          <Lightbox media={data.media}>
            <Gallery no={no} media={data.media} />
          </Lightbox>
        ),
      },
      story: {
        has: content.story.length > 0,
        render: (no) => <StoryBlock no={no} story={content.story} />,
      },
      rsvp: { has: true, render: (no) => <Rsvp no={no} slug={data.slug} /> },
      envelope: {
        has: hasEnvelope,
        render: (no) => <Gift no={no} envelope={env} slug={data.slug} />,
      },
    };
    let cn = 0;
    return (
      <CoverGate
        rootClassName={rootClass}
        contentClassName="ar-stage"
        coverClassName="ar-cover"
        musicClassName="ar-music"
        wipeMs={950}
        music={data.music}
        appearance={appearance}
        cover={
          <AriaCover
            groomName={groomName}
            brideName={brideName}
            dateLabel={dateLabel}
          />
        }
      >
        {grainOn ? <div className="ar-grain" aria-hidden /> : null}
        {resolved.sections
          .filter((s) => s.visible)
          .map((s) => {
            const def = defs[s.id];
            if (!def || !def.has) return null;
            const no = String(++cn).padStart(2, "0");
            return (
              <div
                key={s.id}
                data-section-id={s.id}
                style={{ display: "contents" }}
              >
                {def.render(no)}
              </div>
            );
          })}
        <Footer
          groomName={groomName}
          brideName={brideName}
          dateLabel={dateLabel}
          watermark={data.watermark}
        />
      </CoverGate>
    );
  }

  // Penomoran section berurutan — hanya section yang tampil yang diberi nomor.
  let n = 0;
  const no = () => String(++n).padStart(2, "0");

  return (
    <CoverGate
      rootClassName={rootClass}
      contentClassName="ar-stage"
      coverClassName="ar-cover"
      musicClassName="ar-music"
      wipeMs={950}
      music={data.music}
      cover={
        <AriaCover
          groomName={groomName}
          brideName={brideName}
          dateLabel={dateLabel}
        />
      }
    >
      <div className="ar-grain" aria-hidden />

      {showOpening ? (
        <Opening
          no={no()}
          greetingOpen={content.greetingOpen}
          quote={content.quote?.text ? content.quote : undefined}
        />
      ) : null}

      <Couple no={no()} groom={content.groom} bride={content.bride} />

      {showSchedule ? (
        <EventBlock
          no={no()}
          events={data.events}
          tz={settings.timezone}
          slug={data.slug}
          countdownTarget={showCountdown ? countdownTarget : null}
        />
      ) : showCountdown && countdownTarget ? (
        <CountdownSection no={no()} targetIso={countdownTarget} />
      ) : null}

      {showGallery ? (
        <Lightbox media={data.media}>
          <Gallery no={no()} media={data.media} />
        </Lightbox>
      ) : null}

      {showStory ? <StoryBlock no={no()} story={content.story} /> : null}

      {showRsvp ? <Rsvp no={no()} slug={data.slug} /> : null}

      {showEnvelope ? <Gift no={no()} envelope={env} slug={data.slug} /> : null}

      <Footer
        groomName={groomName}
        brideName={brideName}
        dateLabel={dateLabel}
        watermark={data.watermark}
      />
    </CoverGate>
  );
}

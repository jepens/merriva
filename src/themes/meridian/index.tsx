import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from "next/font/google";

import { GuestbookSection } from "@/components/public/guestbook/guestbook-section";
import {
  formatDateOnly,
  formatEventDateTime,
  localToUtc,
} from "@/lib/datetime";
import { isSectionVisible } from "@/lib/validation/content";
import { ThemeRoot } from "@/themes/_shared/motion";
import type { ThemeComponentProps } from "@/themes/registry";

import "./meridian.css";
import { L } from "./labels";
import {
  Agenda,
  Contact,
  CountdownBlock,
  Envelope,
  Footer,
  Gallery,
  Hero,
  Intro,
  Schedule,
} from "./sections";

// Self-hosted (next/font) → tanpa request eksternal saat runtime (aman WebView &
// LCP). Grotesk geometris (display) + humanist (teks) + mono (waktu/indeks agenda).
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--mrd-display",
  display: "swap",
});
const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--mrd-body",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--mrd-mono",
  display: "swap",
});

/**
 * Tema "Meridian" (corporate, tier standard). Menerima `InvitationData` hasil
 * rakitan server — TIDAK mengambil data sendiri (SPEC §7.1). Section tampil
 * sesuai `settings.sections` (undefined = tampil). Agenda memakai toggle "story".
 */
export default function Meridian({ data }: ThemeComponentProps) {
  const rootClass = `mrd ${display.variable} ${body.variable} ${mono.variable}`;
  const { settings } = data;

  if (data.content.category !== "corporate") {
    return (
      <ThemeRoot className={rootClass}>
        <section className="mrd-section">
          <div className="mrd-inner">
            <p className="mrd-lead">{L.wrongCategory}</p>
          </div>
        </section>
      </ThemeRoot>
    );
  }

  const c = data.content;
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

  const hasIntro = Boolean(c.description || c.greetingOpen || c.quote?.text);
  const env = c.envelope;
  const hasEnvelope =
    env.enabled &&
    (env.banks.length > 0 ||
      env.ewallets.length > 0 ||
      Boolean(env.giftAddress));
  const contact = c.pic;
  const hasContact = Boolean(
    contact && (contact.name || contact.phone || contact.email),
  );

  return (
    <ThemeRoot className={rootClass}>
      <Hero
        eventName={c.eventName}
        organizer={c.organizer}
        dateLabel={dateLabel}
        bgUrl={data.media[0]?.url}
      />

      {hasIntro ? (
        <Intro
          description={c.description}
          greetingOpen={c.greetingOpen}
          quote={c.quote?.text ? c.quote : undefined}
        />
      ) : null}

      {isSectionVisible(settings, "countdown") && countdownTarget ? (
        <CountdownBlock targetIso={countdownTarget} />
      ) : null}

      {isSectionVisible(settings, "story") && c.agenda.length > 0 ? (
        <Agenda agenda={c.agenda} />
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

      {hasContact && contact ? <Contact pic={contact} /> : null}

      {isSectionVisible(settings, "envelope") && hasEnvelope ? (
        <Envelope envelope={env} slug={data.slug} />
      ) : null}

      {isSectionVisible(settings, "rsvp") ? (
        <section className="mrd-section">
          <div className="mrd-inner">
            <GuestbookSection slug={data.slug} />
          </div>
        </section>
      ) : null}

      <Footer
        greetingClose={c.greetingClose}
        eventName={c.eventName}
        organizer={c.organizer}
        watermark={data.watermark}
      />
    </ThemeRoot>
  );
}

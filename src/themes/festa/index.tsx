import { Nunito, Poppins } from "next/font/google";

import { GuestbookSection } from "@/components/public/guestbook/guestbook-section";
import {
  formatDateOnly,
  formatEventDateTime,
  localToUtc,
} from "@/lib/datetime";
import { isSectionVisible } from "@/lib/validation/content";
import { ThemeRoot } from "@/themes/_shared/motion";
import type { ThemeComponentProps } from "@/themes/registry";

import "./festa.css";
import { L } from "./labels";
import {
  Celebrant,
  CountdownBlock,
  Envelope,
  Footer,
  Gallery,
  Hero,
  Intro,
  Schedule,
  Wishes,
} from "./sections";

// Self-hosted (next/font). Poppins = geometric membulat (display), Nunito =
// humanist bulat (teks). Nuansa hangat & meriah. Tanpa request eksternal.
const display = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--ft-display",
  display: "swap",
});
const body = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--ft-body",
  display: "swap",
});

/**
 * Tema "Festa" (family, tier standard) → MEMBUKA kategori family (aqiqah, khitan,
 * ulang tahun, syukuran). Hangat: terracotta + amber + krem, bentuk membulat.
 * Menerima `InvitationData` — TIDAK mengambil data sendiri (SPEC §7.1).
 */
export default function Festa({ data }: ThemeComponentProps) {
  const rootClass = `ft ${display.variable} ${body.variable}`;
  const { settings } = data;

  if (data.content.category !== "family") {
    return (
      <ThemeRoot className={rootClass}>
        <section className="ft-section">
          <div className="ft-inner">
            <p className="ft-lead">{L.wrongCategory}</p>
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

  const hasIntro = Boolean(c.greetingOpen || c.quote?.text);
  const env = c.envelope;
  const hasEnvelope =
    env.enabled &&
    (env.banks.length > 0 ||
      env.ewallets.length > 0 ||
      Boolean(env.giftAddress));
  const hasCelebrant = Boolean(c.celebrant || c.parents);

  return (
    <ThemeRoot className={rootClass}>
      <Hero
        eventName={c.eventName}
        celebrant={c.celebrant}
        dateLabel={dateLabel}
        bgUrl={data.media[0]?.url}
      />

      {hasIntro ? (
        <Intro
          greetingOpen={c.greetingOpen}
          quote={c.quote?.text ? c.quote : undefined}
        />
      ) : null}

      {hasCelebrant ? (
        <Celebrant celebrant={c.celebrant} parents={c.parents} />
      ) : null}

      {isSectionVisible(settings, "countdown") && countdownTarget ? (
        <CountdownBlock targetIso={countdownTarget} />
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

      {isSectionVisible(settings, "story") && c.wishes.length > 0 ? (
        <Wishes wishes={c.wishes} />
      ) : null}

      {isSectionVisible(settings, "envelope") && hasEnvelope ? (
        <Envelope envelope={env} slug={data.slug} />
      ) : null}

      {isSectionVisible(settings, "rsvp") ? (
        <section className="ft-section">
          <div className="ft-inner">
            <GuestbookSection slug={data.slug} />
          </div>
        </section>
      ) : null}

      <Footer
        greetingClose={c.greetingClose}
        eventName={c.eventName}
        watermark={data.watermark}
      />
    </ThemeRoot>
  );
}

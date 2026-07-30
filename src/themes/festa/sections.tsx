import { Calendar, CalendarPlus, Clock, MapPin } from "lucide-react";

import { GiftConfirm } from "@/components/public/guestbook/gift-confirm";
import { googleCalendarUrl } from "@/lib/calendar";
import { formatEventDateTime } from "@/lib/datetime";
import { isDraftSlug, isReservedSlug } from "@/lib/slug";
import { CopyButton } from "@/themes/_shared/copy-button";
import { Countdown, Reveal } from "@/themes/_shared/motion";
import type {
  Envelope as EnvelopeType,
  StoryEntry,
  TimezoneId,
} from "@/lib/validation/content";
import type {
  InvitationEventView,
  InvitationMediaView,
} from "@/types/invitation";

import { L } from "./labels";

const PRELINE = { whiteSpace: "pre-line" as const };

/* -------------------------------------------------------------- Hero ------ */
export function Hero({
  eventName,
  celebrant,
  dateLabel,
  bgUrl,
}: {
  eventName: string;
  celebrant?: string;
  dateLabel: string | null;
  bgUrl?: string;
}) {
  return (
    <header className={bgUrl ? "ft-hero" : "ft-hero ft-hero--plain"}>
      {bgUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="ft-hero__bg"
            src={bgUrl}
            alt=""
            aria-hidden
            fetchPriority="high"
            decoding="async"
          />
          <div className="ft-hero__scrim" aria-hidden />
        </>
      ) : null}
      <div className="ft-hero__inner">
        <span className="ft-hero__crest" aria-hidden>
          ✽
        </span>
        <p className="ft-eyebrow ft-eyebrow--hero">{L.hero.eyebrow}</p>
        <h1 className="ft-hero__title">{eventName}</h1>
        {celebrant ? <p className="ft-hero__celebrant">{celebrant}</p> : null}
        {dateLabel ? <p className="ft-hero__date">{dateLabel}</p> : null}
      </div>
      <span className="ft-hero__scroll" aria-hidden>
        {L.hero.scroll}
      </span>
    </header>
  );
}

/* ------------------------------------------------------------- Intro ------ */
export function Intro({
  greetingOpen,
  quote,
}: {
  greetingOpen?: string;
  quote?: { text: string; source?: string };
}) {
  return (
    <section className="ft-section">
      <div className="ft-inner">
        <Reveal>
          <p className="ft-eyebrow">{L.intro.eyebrow}</p>
          {greetingOpen ? (
            <p className="ft-lead" style={PRELINE}>
              {greetingOpen}
            </p>
          ) : null}
          {quote ? (
            <blockquote className="ft-quote">
              <p>“{quote.text}”</p>
              {quote.source ? (
                <cite className="ft-quote__src">— {quote.source}</cite>
              ) : null}
            </blockquote>
          ) : null}
        </Reveal>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- Celebrant ------ */
export function Celebrant({
  celebrant,
  parents,
}: {
  celebrant?: string;
  parents?: string;
}) {
  return (
    <section className="ft-section ft-section--tint">
      <div className="ft-inner">
        <Reveal>
          <p className="ft-eyebrow ft-eyebrow--center">{L.celebrant.eyebrow}</p>
          <div className="ft-celebrant">
            {celebrant ? (
              <h2 className="ft-celebrant__name">{celebrant}</h2>
            ) : null}
            {parents ? (
              <p className="ft-celebrant__parents">
                {L.celebrant.parents} {parents}
              </p>
            ) : null}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- Countdown ------ */
export function CountdownBlock({ targetIso }: { targetIso: string }) {
  return (
    <section className="ft-section">
      <div className="ft-inner">
        <Reveal>
          <p className="ft-eyebrow ft-eyebrow--center">{L.countdown.eyebrow}</p>
        </Reveal>
        <Reveal>
          <Countdown targetIso={targetIso} labels={L.countdown} />
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- Schedule ------ */
export function Schedule({
  events,
  tz,
  slug,
}: {
  events: InvitationEventView[];
  tz: TimezoneId;
  slug: string;
}) {
  const icsServable = !isReservedSlug(slug) && !isDraftSlug(slug);
  return (
    <section className="ft-section ft-section--tint">
      <div className="ft-inner">
        <Reveal>
          <p className="ft-eyebrow ft-eyebrow--center">{L.schedule.eyebrow}</p>
          <h2 className="ft-h2">{L.schedule.heading}</h2>
        </Reveal>
        <div className="ft-stack">
          {events.map((e, i) => {
            const f = formatEventDateTime(e.startAt, tz);
            const maps =
              e.mapsUrl && /^https?:\/\//i.test(e.mapsUrl) ? e.mapsUrl : null;
            const gcal = googleCalendarUrl({
              id: e.id,
              title: e.name,
              startAt: e.startAt,
              endAt: e.endAt,
              venueName: e.venueName,
              address: e.address,
            });
            const icsUrl = `/api/ics/${slug}?e=${encodeURIComponent(e.id)}`;
            return (
              <Reveal key={e.id} delay={i * 80}>
                <article className="ft-card">
                  <h3 className="ft-card__title">{e.name}</h3>
                  {f ? (
                    <>
                      <p className="ft-card__row">
                        <Calendar size={16} />
                        {f.weekday}, {f.date}
                      </p>
                      <p className="ft-card__row">
                        <Clock size={16} />
                        {f.time} {f.tzLabel}
                      </p>
                    </>
                  ) : null}
                  {e.venueName ? (
                    <p className="ft-card__row">
                      <MapPin size={16} />
                      {e.venueName}
                    </p>
                  ) : null}
                  {e.address ? <p className="ft-muted">{e.address}</p> : null}
                  <div className="ft-card__actions">
                    {maps ? (
                      <a
                        className="ft-btn"
                        href={maps}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MapPin size={15} />
                        {L.schedule.maps}
                      </a>
                    ) : null}
                    {gcal ? (
                      <details className="ft-cal">
                        <summary className="ft-btn ft-cal__trigger">
                          <CalendarPlus size={15} />
                          {L.schedule.calendar}
                        </summary>
                        <div className="ft-cal__menu">
                          <a
                            className="ft-cal__opt"
                            href={gcal}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {L.schedule.calendarGoogle}
                          </a>
                          {icsServable ? (
                            <a
                              className="ft-cal__opt"
                              href={icsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {L.schedule.calendarIcs}
                            </a>
                          ) : null}
                        </div>
                      </details>
                    ) : null}
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- Gallery ------ */
export function Gallery({ media }: { media: InvitationMediaView[] }) {
  return (
    <section className="ft-section">
      <div className="ft-inner">
        <Reveal>
          <p className="ft-eyebrow ft-eyebrow--center">{L.gallery.eyebrow}</p>
          <h2 className="ft-h2">{L.gallery.heading}</h2>
        </Reveal>
        <Reveal>
          <div className="ft-gallery">
            {media.map((m) => (
              <div key={m.id} className="ft-gallery__item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.thumbUrl}
                  alt=""
                  loading="lazy"
                  width={m.width ?? undefined}
                  height={m.height ?? undefined}
                />
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Wishes ------ */
export function Wishes({ wishes }: { wishes: StoryEntry[] }) {
  return (
    <section className="ft-section ft-section--tint">
      <div className="ft-inner">
        <Reveal>
          <p className="ft-eyebrow ft-eyebrow--center">{L.wishes.eyebrow}</p>
          <h2 className="ft-h2">{L.wishes.heading}</h2>
        </Reveal>
        <div className="ft-stack">
          {wishes.map((w, i) => (
            <Reveal key={i} delay={i * 70}>
              <article className="ft-card ft-card--wish">
                <span className="ft-wish__mark" aria-hidden>
                  ❝
                </span>
                {w.date ? <p className="ft-wish__from">{w.date}</p> : null}
                <h3 className="ft-card__title">{w.title}</h3>
                <p className="ft-muted" style={PRELINE}>
                  {w.narrative}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- Envelope ------ */
export function Envelope({
  envelope,
  slug,
}: {
  envelope: EnvelopeType;
  slug: string;
}) {
  return (
    <section className="ft-section">
      <div className="ft-inner">
        <Reveal>
          <p className="ft-eyebrow ft-eyebrow--center">{L.envelope.eyebrow}</p>
          <h2 className="ft-h2">{L.envelope.heading}</h2>
          <p className="ft-lead">{L.envelope.note}</p>
        </Reveal>
        <div className="ft-stack">
          {envelope.banks.map((b, i) => (
            <Reveal key={`b${i}`}>
              <article className="ft-card">
                <p className="ft-account__label">{b.bank}</p>
                <p className="ft-account__num">{b.number}</p>
                <p className="ft-muted">
                  {L.envelope.holder} {b.holder}
                </p>
                <CopyButton
                  value={b.number}
                  labelCopy={L.envelope.copy}
                  labelCopied={L.envelope.copied}
                  className="ft-btn ft-btn--solid"
                />
              </article>
            </Reveal>
          ))}
          {envelope.ewallets.map((w, i) => (
            <Reveal key={`w${i}`}>
              <article className="ft-card">
                <p className="ft-account__label">{w.provider}</p>
                <p className="ft-account__num">{w.number}</p>
                {w.holder ? (
                  <p className="ft-muted">
                    {L.envelope.holder} {w.holder}
                  </p>
                ) : null}
                <CopyButton
                  value={w.number}
                  labelCopy={L.envelope.copy}
                  labelCopied={L.envelope.copied}
                  className="ft-btn ft-btn--solid"
                />
              </article>
            </Reveal>
          ))}
          {envelope.giftAddress ? (
            <Reveal>
              <article className="ft-card">
                <p className="ft-account__label">{L.envelope.giftAddress}</p>
                <p
                  className="ft-muted"
                  style={{ ...PRELINE, marginTop: "0.4rem" }}
                >
                  {envelope.giftAddress}
                </p>
              </article>
            </Reveal>
          ) : null}
        </div>
        <Reveal>
          <GiftConfirm slug={slug} />
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Footer ------ */
export function Footer({
  greetingClose,
  eventName,
  watermark,
}: {
  greetingClose?: string;
  eventName: string;
  watermark: boolean;
}) {
  return (
    <footer className="ft-footer">
      <div className="ft-inner">
        <Reveal>
          {greetingClose ? (
            <p className="ft-lead ft-lead--light" style={PRELINE}>
              {greetingClose}
            </p>
          ) : null}
          <p className="ft-footer__thanks">{L.footer.thanks}</p>
          <p className="ft-footer__event">{eventName}</p>
          {watermark ? (
            <p className="ft-watermark">
              {L.footer.by}{" "}
              <a
                href="https://merriva.id"
                target="_blank"
                rel="noopener noreferrer"
              >
                {L.footer.brand}
              </a>
            </p>
          ) : null}
        </Reveal>
      </div>
    </footer>
  );
}

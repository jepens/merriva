import {
  Calendar,
  CalendarPlus,
  Clock,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";

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
  organizer,
  dateLabel,
  bgUrl,
}: {
  eventName: string;
  organizer?: string;
  dateLabel: string | null;
  bgUrl?: string;
}) {
  return (
    <header className={bgUrl ? "mrd-hero" : "mrd-hero mrd-hero--plain"}>
      {bgUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="mrd-hero__bg"
            src={bgUrl}
            alt=""
            aria-hidden
            fetchPriority="high"
            decoding="async"
          />
          <div className="mrd-hero__scrim" aria-hidden />
        </>
      ) : null}
      <div className="mrd-hero__inner">
        <p className="mrd-eyebrow mrd-eyebrow--light">{L.hero.eyebrow}</p>
        <h1 className="mrd-hero__title">{eventName}</h1>
        <span className="mrd-hero__rule" aria-hidden />
        {organizer ? <p className="mrd-hero__org">{organizer}</p> : null}
        {dateLabel ? <p className="mrd-hero__date">{dateLabel}</p> : null}
      </div>
      <span className="mrd-hero__scroll" aria-hidden>
        {L.hero.scroll}
      </span>
    </header>
  );
}

/* ------------------------------------------------------------- Intro ------ */
export function Intro({
  description,
  greetingOpen,
  quote,
}: {
  description?: string;
  greetingOpen?: string;
  quote?: { text: string; source?: string };
}) {
  return (
    <section className="mrd-section">
      <div className="mrd-inner">
        <Reveal>
          <p className="mrd-eyebrow">{L.intro.eyebrow}</p>
        </Reveal>
        {greetingOpen ? (
          <Reveal>
            <p className="mrd-lead" style={PRELINE}>
              {greetingOpen}
            </p>
          </Reveal>
        ) : null}
        {description ? (
          <Reveal>
            <p className="mrd-body-text" style={PRELINE}>
              {description}
            </p>
          </Reveal>
        ) : null}
        {quote ? (
          <Reveal>
            <blockquote className="mrd-quote">
              <p>{quote.text}</p>
              {quote.source ? (
                <cite className="mrd-quote__src">— {quote.source}</cite>
              ) : null}
            </blockquote>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}

/* --------------------------------------------------------- Countdown ------ */
export function CountdownBlock({ targetIso }: { targetIso: string }) {
  return (
    <section className="mrd-section mrd-section--ink">
      <div className="mrd-inner">
        <Reveal>
          <p className="mrd-eyebrow mrd-eyebrow--light">
            {L.countdown.eyebrow}
          </p>
        </Reveal>
        <Reveal>
          <Countdown targetIso={targetIso} labels={L.countdown} />
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Agenda ------ */
/** Signature: rundown sebagai timeline bernomor (agenda = urutan nyata). */
export function Agenda({ agenda }: { agenda: StoryEntry[] }) {
  return (
    <section className="mrd-section">
      <div className="mrd-inner">
        <Reveal>
          <p className="mrd-eyebrow">{L.agenda.eyebrow}</p>
          <h2 className="mrd-h2">{L.agenda.heading}</h2>
        </Reveal>
        <ol className="mrd-agenda">
          {agenda.map((a, i) => (
            <Reveal key={i} delay={i * 60}>
              <li className="mrd-agenda__item">
                <span className="mrd-agenda__idx" aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="mrd-agenda__body">
                  {a.date ? <p className="mrd-agenda__time">{a.date}</p> : null}
                  <h3 className="mrd-agenda__title">{a.title}</h3>
                  <p className="mrd-agenda__desc" style={PRELINE}>
                    {a.narrative}
                  </p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
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
    <section className="mrd-section mrd-section--tint">
      <div className="mrd-inner">
        <Reveal>
          <p className="mrd-eyebrow">{L.schedule.eyebrow}</p>
          <h2 className="mrd-h2">{L.schedule.heading}</h2>
        </Reveal>
        <div className="mrd-grid">
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
              <Reveal key={e.id} delay={i * 70}>
                <article className="mrd-card">
                  <h3 className="mrd-card__title">{e.name}</h3>
                  {f ? (
                    <>
                      <p className="mrd-card__row">
                        <Calendar size={16} />
                        {f.weekday}, {f.date}
                      </p>
                      <p className="mrd-card__row">
                        <Clock size={16} />
                        {f.time} {f.tzLabel}
                      </p>
                    </>
                  ) : null}
                  {e.venueName ? (
                    <p className="mrd-card__row">
                      <MapPin size={16} />
                      {e.venueName}
                    </p>
                  ) : null}
                  {e.address ? <p className="mrd-muted">{e.address}</p> : null}
                  <div className="mrd-card__actions">
                    {maps ? (
                      <a
                        className="mrd-btn"
                        href={maps}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MapPin size={15} />
                        {L.schedule.maps}
                      </a>
                    ) : null}
                    {gcal ? (
                      <details className="mrd-cal">
                        <summary className="mrd-btn mrd-cal__trigger">
                          <CalendarPlus size={15} />
                          {L.schedule.calendar}
                        </summary>
                        <div className="mrd-cal__menu">
                          <a
                            className="mrd-cal__opt"
                            href={gcal}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {L.schedule.calendarGoogle}
                          </a>
                          {icsServable ? (
                            <a
                              className="mrd-cal__opt"
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
    <section className="mrd-section">
      <div className="mrd-inner">
        <Reveal>
          <p className="mrd-eyebrow">{L.gallery.eyebrow}</p>
          <h2 className="mrd-h2">{L.gallery.heading}</h2>
        </Reveal>
        <Reveal>
          <div className="mrd-gallery">
            {media.map((m) => (
              <div key={m.id} className="mrd-gallery__item">
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

/* ----------------------------------------------------------- Contact ------ */
export function Contact({
  pic,
}: {
  pic: { name?: string; phone?: string; email?: string };
}) {
  const tel =
    pic.phone && /^[+0-9][0-9 ()-]*$/.test(pic.phone)
      ? pic.phone.replace(/[^+0-9]/g, "")
      : null;
  return (
    <section className="mrd-section mrd-section--tint">
      <div className="mrd-inner">
        <Reveal>
          <p className="mrd-eyebrow">{L.contact.eyebrow}</p>
          <h2 className="mrd-h2">{L.contact.heading}</h2>
        </Reveal>
        <Reveal>
          <article className="mrd-contact">
            {pic.name ? <p className="mrd-contact__name">{pic.name}</p> : null}
            {pic.phone ? (
              <div className="mrd-contact__row">
                <span className="mrd-contact__label">
                  <Phone size={15} /> {L.contact.phone}
                </span>
                <span className="mrd-contact__val">{pic.phone}</span>
                <span className="mrd-contact__acts">
                  {tel ? (
                    <a className="mrd-btn mrd-btn--sm" href={`tel:${tel}`}>
                      {L.contact.phone}
                    </a>
                  ) : null}
                  <CopyButton
                    value={pic.phone}
                    labelCopy={L.contact.copy}
                    labelCopied={L.contact.copied}
                    className="mrd-btn mrd-btn--sm"
                  />
                </span>
              </div>
            ) : null}
            {pic.email ? (
              <div className="mrd-contact__row">
                <span className="mrd-contact__label">
                  <Mail size={15} /> {L.contact.email}
                </span>
                <span className="mrd-contact__val">{pic.email}</span>
                <span className="mrd-contact__acts">
                  <a
                    className="mrd-btn mrd-btn--sm"
                    href={`mailto:${pic.email}`}
                  >
                    {L.contact.email}
                  </a>
                </span>
              </div>
            ) : null}
          </article>
        </Reveal>
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
    <section className="mrd-section">
      <div className="mrd-inner">
        <Reveal>
          <p className="mrd-eyebrow">{L.envelope.eyebrow}</p>
          <h2 className="mrd-h2">{L.envelope.heading}</h2>
          <p className="mrd-lead">{L.envelope.note}</p>
        </Reveal>
        <div className="mrd-grid">
          {envelope.banks.map((b, i) => (
            <Reveal key={`b${i}`}>
              <article className="mrd-card">
                <p className="mrd-account__label">{b.bank}</p>
                <p className="mrd-account__num">{b.number}</p>
                <p className="mrd-muted">
                  {L.envelope.holder} {b.holder}
                </p>
                <CopyButton
                  value={b.number}
                  labelCopy={L.envelope.copy}
                  labelCopied={L.envelope.copied}
                  className="mrd-btn"
                />
              </article>
            </Reveal>
          ))}
          {envelope.ewallets.map((w, i) => (
            <Reveal key={`w${i}`}>
              <article className="mrd-card">
                <p className="mrd-account__label">{w.provider}</p>
                <p className="mrd-account__num">{w.number}</p>
                {w.holder ? (
                  <p className="mrd-muted">
                    {L.envelope.holder} {w.holder}
                  </p>
                ) : null}
                <CopyButton
                  value={w.number}
                  labelCopy={L.envelope.copy}
                  labelCopied={L.envelope.copied}
                  className="mrd-btn"
                />
              </article>
            </Reveal>
          ))}
          {envelope.giftAddress ? (
            <Reveal>
              <article className="mrd-card">
                <p className="mrd-account__label">{L.envelope.giftAddress}</p>
                <p
                  className="mrd-muted"
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
  organizer,
  watermark,
}: {
  greetingClose?: string;
  eventName: string;
  organizer?: string;
  watermark: boolean;
}) {
  return (
    <footer className="mrd-footer">
      <div className="mrd-inner">
        <Reveal>
          {greetingClose ? (
            <p className="mrd-lead mrd-lead--light" style={PRELINE}>
              {greetingClose}
            </p>
          ) : null}
          <p className="mrd-footer__thanks">{L.footer.thanks}</p>
          <span className="mrd-hero__rule" aria-hidden />
          <p className="mrd-footer__event">{eventName}</p>
          {organizer ? <p className="mrd-footer__org">{organizer}</p> : null}
          {watermark ? (
            <p className="mrd-watermark">
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

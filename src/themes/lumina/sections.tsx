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
  Person,
  StoryEntry,
  TimezoneId,
} from "@/lib/validation/content";
import type {
  InvitationEventView,
  InvitationMediaView,
} from "@/types/invitation";

import { L } from "./labels";

const PRELINE = { whiteSpace: "pre-line" as const };

/* ------------------------------------------------------------- Intro ------ */
export function Intro({
  greetingOpen,
  description,
  quote,
}: {
  greetingOpen?: string;
  description?: string;
  quote?: { text: string; source?: string };
}) {
  return (
    <section className="lm-section">
      <div className="lm-inner">
        <Reveal>
          <p className="lm-eyebrow">{L.intro.eyebrow}</p>
          {greetingOpen ? (
            <p className="lm-lead" style={PRELINE}>
              {greetingOpen}
            </p>
          ) : null}
          {description ? (
            <p className="lm-body-text" style={PRELINE}>
              {description}
            </p>
          ) : null}
          {quote ? (
            <blockquote className="lm-quote">
              <p>{quote.text}</p>
              {quote.source ? (
                <cite className="lm-quote__src">— {quote.source}</cite>
              ) : null}
            </blockquote>
          ) : null}
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- Principals ------ */
function Principal({
  role,
  name,
  meta,
}: {
  role: string;
  name: string;
  meta: string[];
}) {
  return (
    <div className="lm-principal">
      <p className="lm-eyebrow">{role}</p>
      <h3 className="lm-principal__name">{name}</h3>
      {meta.map((m, i) => (
        <p key={i} className="lm-muted">
          {m}
        </p>
      ))}
    </div>
  );
}

export function CoupleBlock({
  groom,
  bride,
}: {
  groom: Person;
  bride: Person;
}) {
  const meta = (p: Person) =>
    [p.childOrder, L.principals.parents(p.fatherName, p.motherName)].filter(
      (x): x is string => Boolean(x),
    );
  return (
    <section className="lm-section lm-section--tint">
      <div className="lm-inner">
        <Reveal>
          <p className="lm-eyebrow lm-eyebrow--center">
            {L.principals.wedding}
          </p>
          <span className="lm-divider" aria-hidden />
        </Reveal>
        <div className="lm-principals">
          <Reveal>
            <Principal
              role={L.principals.groom}
              name={groom.name || "—"}
              meta={meta(groom)}
            />
          </Reveal>
          <span className="lm-principals__amp" aria-hidden>
            &amp;
          </span>
          <Reveal delay={120}>
            <Principal
              role={L.principals.bride}
              name={bride.name || "—"}
              meta={meta(bride)}
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function OrganizerBlock({
  organizer,
  pic,
}: {
  organizer?: string;
  pic?: { name?: string; phone?: string; email?: string };
}) {
  const tel =
    pic?.phone && /^[+0-9][0-9 ()-]*$/.test(pic.phone)
      ? pic.phone.replace(/[^+0-9]/g, "")
      : null;
  return (
    <section className="lm-section lm-section--tint">
      <div className="lm-inner">
        <Reveal>
          <p className="lm-eyebrow lm-eyebrow--center">
            {L.principals.corporate}
          </p>
          {organizer ? <h2 className="lm-h2">{organizer}</h2> : null}
        </Reveal>
        {pic && (pic.name || pic.phone || pic.email) ? (
          <Reveal>
            <div className="lm-contact">
              <p className="lm-eyebrow">{L.principals.contact}</p>
              {pic.name ? <p className="lm-contact__name">{pic.name}</p> : null}
              {pic.phone ? (
                <p className="lm-contact__row">
                  <Phone size={15} /> {pic.phone}
                  {tel ? (
                    <a className="lm-btn lm-btn--sm" href={`tel:${tel}`}>
                      Telepon
                    </a>
                  ) : null}
                </p>
              ) : null}
              {pic.email ? (
                <p className="lm-contact__row">
                  <Mail size={15} /> {pic.email}
                  <a className="lm-btn lm-btn--sm" href={`mailto:${pic.email}`}>
                    Email
                  </a>
                </p>
              ) : null}
            </div>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}

export function CelebrantBlock({
  celebrant,
  parents,
}: {
  celebrant?: string;
  parents?: string;
}) {
  return (
    <section className="lm-section lm-section--tint">
      <div className="lm-inner">
        <Reveal>
          <p className="lm-eyebrow lm-eyebrow--center">{L.principals.family}</p>
          {celebrant ? <h2 className="lm-h2">{celebrant}</h2> : null}
          {parents ? (
            <p className="lm-muted">
              {L.principals.parentsFamily} {parents}
            </p>
          ) : null}
        </Reveal>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- Countdown ------ */
export function CountdownBlock({ targetIso }: { targetIso: string }) {
  return (
    <section className="lm-section">
      <div className="lm-inner">
        <Reveal>
          <p className="lm-eyebrow lm-eyebrow--center">{L.countdown.eyebrow}</p>
        </Reveal>
        <Reveal>
          <Countdown targetIso={targetIso} labels={L.countdown} />
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- Timeline ------ */
export function Timeline({
  label,
  items,
}: {
  label: { eyebrow: string; heading: string };
  items: StoryEntry[];
}) {
  return (
    <section className="lm-section">
      <div className="lm-inner">
        <Reveal>
          <p className="lm-eyebrow lm-eyebrow--center">{label.eyebrow}</p>
          <h2 className="lm-h2">{label.heading}</h2>
        </Reveal>
        <div className="lm-timeline">
          {items.map((s, i) => (
            <Reveal key={i} delay={i * 70}>
              <div className="lm-story">
                {s.date ? <p className="lm-story__date">{s.date}</p> : null}
                <h3 className="lm-story__title">{s.title}</h3>
                <p className="lm-story__body" style={PRELINE}>
                  {s.narrative}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
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
    <section className="lm-section lm-section--tint">
      <div className="lm-inner">
        <Reveal>
          <p className="lm-eyebrow lm-eyebrow--center">{L.schedule.eyebrow}</p>
          <h2 className="lm-h2">{L.schedule.heading}</h2>
        </Reveal>
        <div className="lm-stack">
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
                <article className="lm-card">
                  <h3 className="lm-card__title">{e.name}</h3>
                  {f ? (
                    <>
                      <p className="lm-card__row">
                        <Calendar size={16} />
                        {f.weekday}, {f.date}
                      </p>
                      <p className="lm-card__row">
                        <Clock size={16} />
                        {f.time} {f.tzLabel}
                      </p>
                    </>
                  ) : null}
                  {e.venueName ? (
                    <p className="lm-card__row">
                      <MapPin size={16} />
                      {e.venueName}
                    </p>
                  ) : null}
                  {e.address ? <p className="lm-muted">{e.address}</p> : null}
                  <div className="lm-card__actions">
                    {maps ? (
                      <a
                        className="lm-btn"
                        href={maps}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MapPin size={15} />
                        {L.schedule.maps}
                      </a>
                    ) : null}
                    {gcal ? (
                      <details className="lm-cal">
                        <summary className="lm-btn lm-cal__trigger">
                          <CalendarPlus size={15} />
                          {L.schedule.calendar}
                        </summary>
                        <div className="lm-cal__menu">
                          <a
                            className="lm-cal__opt"
                            href={gcal}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {L.schedule.calendarGoogle}
                          </a>
                          {icsServable ? (
                            <a
                              className="lm-cal__opt"
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
    <section className="lm-section">
      <div className="lm-inner">
        <Reveal>
          <p className="lm-eyebrow lm-eyebrow--center">{L.gallery.eyebrow}</p>
          <h2 className="lm-h2">{L.gallery.heading}</h2>
        </Reveal>
        <Reveal>
          <div className="lm-gallery">
            {media.map((m) => (
              <div key={m.id} className="lm-gallery__item">
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

/* ---------------------------------------------------------- Envelope ------ */
export function Envelope({
  envelope,
  slug,
}: {
  envelope: EnvelopeType;
  slug: string;
}) {
  return (
    <section className="lm-section lm-section--tint">
      <div className="lm-inner">
        <Reveal>
          <p className="lm-eyebrow lm-eyebrow--center">{L.envelope.eyebrow}</p>
          <h2 className="lm-h2">{L.envelope.heading}</h2>
          <p className="lm-lead">{L.envelope.note}</p>
        </Reveal>
        <div className="lm-stack">
          {envelope.banks.map((b, i) => (
            <Reveal key={`b${i}`}>
              <article className="lm-card">
                <p className="lm-account__label">{b.bank}</p>
                <p className="lm-account__num">{b.number}</p>
                <p className="lm-muted">
                  {L.envelope.holder} {b.holder}
                </p>
                <CopyButton
                  value={b.number}
                  labelCopy={L.envelope.copy}
                  labelCopied={L.envelope.copied}
                  className="lm-btn lm-btn--solid"
                />
              </article>
            </Reveal>
          ))}
          {envelope.ewallets.map((w, i) => (
            <Reveal key={`w${i}`}>
              <article className="lm-card">
                <p className="lm-account__label">{w.provider}</p>
                <p className="lm-account__num">{w.number}</p>
                {w.holder ? (
                  <p className="lm-muted">
                    {L.envelope.holder} {w.holder}
                  </p>
                ) : null}
                <CopyButton
                  value={w.number}
                  labelCopy={L.envelope.copy}
                  labelCopied={L.envelope.copied}
                  className="lm-btn lm-btn--solid"
                />
              </article>
            </Reveal>
          ))}
          {envelope.giftAddress ? (
            <Reveal>
              <article className="lm-card">
                <p className="lm-account__label">{L.envelope.giftAddress}</p>
                <p
                  className="lm-muted"
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
  title,
  watermark,
}: {
  greetingClose?: string;
  title: string;
  watermark: boolean;
}) {
  return (
    <footer className="lm-footer">
      <div className="lm-inner">
        <Reveal>
          {greetingClose ? (
            <p className="lm-lead lm-lead--light" style={PRELINE}>
              {greetingClose}
            </p>
          ) : null}
          <span className="lm-divider" aria-hidden />
          <p className="lm-footer__thanks">{L.footer.thanks}</p>
          <p className="lm-footer__title">{title}</p>
          {watermark ? (
            <p className="lm-watermark">
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

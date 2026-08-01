import { CalendarPlus, MapPin } from "lucide-react";
import type { ReactNode } from "react";

import { GiftConfirm } from "@/components/public/guestbook/gift-confirm";
import { googleCalendarUrl } from "@/lib/calendar";
import { formatEventDateTime } from "@/lib/datetime";
import { isDraftSlug, isReservedSlug } from "@/lib/slug";
import type {
  Envelope as EnvelopeType,
  Person,
  StoryEntry,
  TimezoneId,
} from "@/lib/validation/content";
import { Countdown } from "@/themes/_shared/motion";
import { CopyButton } from "@/themes/_shared/copy-button";
import type {
  InvitationEventView,
  InvitationMediaView,
} from "@/types/invitation";

import { LightboxThumb } from "@/themes/_shared/lightbox";

import { L } from "./labels";

const PRELINE = { whiteSpace: "pre-line" as const };

/** Baris bermask (`.nr-line`) — state tersembunyi diisi JS (§0.4). */
function MaskLine({ children }: { children: ReactNode }) {
  return (
    <span className="nr-line">
      <span>{children}</span>
    </span>
  );
}

const initialOf = (s: string) => (s.trim()[0] ?? "•").toUpperCase();

/* ------------------------------------------------------------- Hero -------- */
export function Hero({
  groomName,
  brideName,
  greetingOpen,
  featured,
}: {
  groomName: string;
  brideName: string;
  greetingOpen?: string;
  featured: InvitationMediaView | null;
}) {
  return (
    <header className="nr-section nr-hero nr-center">
      <span className="nr-scene-label nr-reveal">{L.hero.scene}</span>
      <h1 className="nr-hero__title">
        <MaskLine>
          <em>{groomName}</em>
        </MaskLine>
        <MaskLine>
          <span className="nr-amp">&amp;</span>
        </MaskLine>
        <MaskLine>
          <em>{brideName}</em>
        </MaskLine>
      </h1>
      {greetingOpen ? (
        <p className="nr-lead nr-reveal" style={PRELINE}>
          {greetingOpen}
        </p>
      ) : null}
      <figure className="nr-cine" data-pan>
        {featured ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="nr-frame__media"
            src={featured.thumbUrl}
            alt=""
            loading="eager"
            width={featured.width ?? undefined}
            height={featured.height ?? undefined}
          />
        ) : (
          <div className="nr-frame__media nr-frame__ph" aria-hidden />
        )}
      </figure>
    </header>
  );
}

/* ------------------------------------------------------------ Quote -------- */
export function QuoteBlock({
  quote,
}: {
  quote?: { text: string; source?: string };
}) {
  if (!quote) return null;
  return (
    <section className="nr-section nr-quote nr-center">
      <div className="nr-reveal">
        <p className="nr-eyebrow nr-eyebrow--gold">{L.quote.eyebrow}</p>
      </div>
      <blockquote className="nr-quote__text">
        <MaskLine>“{quote.text}”</MaskLine>
      </blockquote>
      {quote.source ? (
        <div className="nr-reveal">
          <cite className="nr-quote__src">{quote.source}</cite>
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------- Cast -------- */
function Actor({
  person,
  role,
  side,
  initial,
  photo,
}: {
  person: Person;
  role: string;
  side: "left" | "right";
  initial: string;
  photo?: string | null;
}) {
  const parents = L.couple.parents(person.fatherName, person.motherName);
  return (
    <div className={`nr-actor nr-actor--${side}`}>
      <div className="nr-portrait" data-pan>
        <div className="nr-frame__media nr-portrait__ph" aria-hidden>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span>{initial}</span>
          )}
        </div>
      </div>
      <div className="nr-actor__body">
        <div className="nr-reveal">
          <div className="nr-actor__role">{role}</div>
        </div>
        <h3 className="nr-actor__name">
          <MaskLine>
            <em>{person.name || "—"}</em>
          </MaskLine>
        </h3>
        {person.childOrder ? (
          <div className="nr-reveal">
            <p className="nr-person__meta">{person.childOrder}</p>
          </div>
        ) : null}
        {parents ? (
          <div className="nr-reveal">
            <p className="nr-person__meta">{parents}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Cast({
  groom,
  bride,
  groomPhoto,
  bridePhoto,
}: {
  groom: Person;
  bride: Person;
  groomPhoto?: string | null;
  bridePhoto?: string | null;
}) {
  return (
    <section className="nr-section">
      <div className="nr-center nr-reveal">
        <p className="nr-eyebrow">{L.couple.eyebrow}</p>
      </div>
      <div className="nr-cast">
        <Actor
          person={groom}
          role={L.couple.groom}
          side="left"
          initial={initialOf(groom.nickname || groom.name || "•")}
          photo={groomPhoto}
        />
        <Actor
          person={bride}
          role={L.couple.bride}
          side="right"
          initial={initialOf(bride.nickname || bride.name || "•")}
          photo={bridePhoto}
        />
      </div>
    </section>
  );
}

/* --------------------------------------------------------- Countdown ------- */
export function CountdownBlock({ targetIso }: { targetIso: string }) {
  return (
    <section className="nr-section nr-countdown-sec nr-center">
      <div className="nr-reveal">
        <p className="nr-eyebrow">{L.countdown.eyebrow}</p>
      </div>
      <Countdown
        targetIso={targetIso}
        labels={{
          days: L.countdown.days,
          hours: L.countdown.hours,
          minutes: L.countdown.minutes,
          seconds: L.countdown.seconds,
          done: L.countdown.done,
        }}
      />
    </section>
  );
}

/* ---------------------------------------------------------- Schedule ------- */
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
    <section className="nr-section">
      <div className="nr-center nr-reveal">
        <p className="nr-eyebrow">{L.schedule.eyebrow}</p>
      </div>
      <div className="nr-scenes">
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
            <article className="nr-scene" key={e.id}>
              <div className="nr-reveal">
                <div className="nr-scene__no">
                  {L.schedule.scene} {String(i + 2).padStart(2, "0")}
                </div>
              </div>
              <h3 className="nr-scene__title">
                <MaskLine>{e.name}</MaskLine>
              </h3>
              <div className="nr-reveal">
                <div className="nr-scene__meta">
                  {f ? (
                    <>
                      <b>
                        {f.weekday}, {f.date} · {f.time} {f.tzLabel}
                      </b>
                      <br />
                    </>
                  ) : null}
                  {e.venueName ? (
                    <>
                      {e.venueName}
                      <br />
                    </>
                  ) : null}
                  {e.address ?? null}
                </div>
                <div className="nr-pills">
                  {maps ? (
                    <a
                      className="nr-pill nr-pill--gold"
                      href={maps}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MapPin size={14} />
                      {L.schedule.maps}
                    </a>
                  ) : null}
                  {gcal ? (
                    <details className="nr-cal">
                      <summary className="nr-pill">
                        <CalendarPlus size={14} />
                        {L.schedule.calendar}
                      </summary>
                      <div className="nr-cal__menu">
                        <a
                          className="nr-cal__opt"
                          href={gcal}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {L.schedule.calendarGoogle}
                        </a>
                        {icsServable ? (
                          <a
                            className="nr-cal__opt"
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
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- Gallery ------- */
export function Gallery({ media }: { media: InvitationMediaView[] }) {
  return (
    <section className="nr-section nr-gallery-sec">
      <div className="nr-center nr-reveal">
        <p className="nr-eyebrow">{L.gallery.eyebrow}</p>
      </div>
      <div className="nr-gallery" data-lb-scroll>
        {media.map((m, i) => (
          <figure className="nr-gallery__item" key={m.id}>
            <LightboxThumb m={m} index={i} />
            <figcaption>Take {String(i + 1).padStart(2, "0")}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Story ------- */
export function Story({ story }: { story: StoryEntry[] }) {
  return (
    <section className="nr-section">
      <div className="nr-center nr-reveal">
        <p className="nr-eyebrow">{L.story.eyebrow}</p>
        <h2 className="nr-h2">{L.story.heading}</h2>
      </div>
      <div className="nr-timeline">
        {story.map((s, i) => (
          <div className="nr-reveal" key={i}>
            <div className="nr-story">
              {s.date ? <p className="nr-story__date">{s.date}</p> : null}
              <h3 className="nr-story__title">{s.title}</h3>
              <p className="nr-story__body">{s.narrative}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- Envelope ------- */
export function Envelope({
  envelope,
  slug,
}: {
  envelope: EnvelopeType;
  slug: string;
}) {
  return (
    <section className="nr-section">
      <div className="nr-center nr-reveal">
        <p className="nr-eyebrow">{L.envelope.eyebrow}</p>
        <h2 className="nr-h2">{L.envelope.heading}</h2>
        <p className="nr-lead" style={{ marginTop: "0.8rem" }}>
          {L.envelope.note}
        </p>
      </div>
      <div className="nr-inner" style={{ marginTop: "0.5rem" }}>
        {envelope.banks.map((b, i) => (
          <div className="nr-reveal" key={`b${i}`}>
            <article className="nr-account">
              <p className="nr-account__label">{b.bank}</p>
              <p className="nr-account__num">{b.number}</p>
              <p className="nr-person__meta">
                {L.envelope.holder} {b.holder}
              </p>
              <CopyButton
                value={b.number}
                labelCopy={L.envelope.copy}
                labelCopied={L.envelope.copied}
                className="nr-copy"
              />
            </article>
          </div>
        ))}
        {envelope.ewallets.map((w, i) => (
          <div className="nr-reveal" key={`w${i}`}>
            <article className="nr-account">
              <p className="nr-account__label">{w.provider}</p>
              <p className="nr-account__num">{w.number}</p>
              {w.holder ? (
                <p className="nr-person__meta">
                  {L.envelope.holder} {w.holder}
                </p>
              ) : null}
              <CopyButton
                value={w.number}
                labelCopy={L.envelope.copy}
                labelCopied={L.envelope.copied}
                className="nr-copy"
              />
            </article>
          </div>
        ))}
        {envelope.giftAddress ? (
          <div className="nr-reveal">
            <article className="nr-account">
              <p className="nr-account__label">{L.envelope.giftAddress}</p>
              <p
                className="nr-person__meta"
                style={{ ...PRELINE, marginTop: 4 }}
              >
                {envelope.giftAddress}
              </p>
            </article>
          </div>
        ) : null}
        <div className="nr-reveal" style={{ marginTop: "1.1rem" }}>
          <GiftConfirm slug={slug} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Footer ------- */
export function Footer({
  groomName,
  brideName,
  greetingClose,
  watermark,
}: {
  groomName: string;
  brideName: string;
  greetingClose?: string;
  watermark: boolean;
}) {
  return (
    <footer className="nr-footer nr-center">
      <span className="nr-scene-label nr-reveal">{L.footer.credits}</span>
      <div className="nr-reveal">
        <div className="nr-credit__role">{L.footer.coupleRole}</div>
        <div className="nr-credit__name">
          {groomName} &amp; {brideName}
        </div>
      </div>
      {greetingClose ? (
        <div className="nr-reveal">
          <p className="nr-lead" style={{ ...PRELINE, marginTop: "1.4rem" }}>
            {greetingClose}
          </p>
        </div>
      ) : null}
      <div className="nr-fin nr-reveal">{L.footer.fin}</div>
      {watermark ? (
        <div className="nr-reveal">
          <span className="nr-watermark">
            {L.footer.by}{" "}
            <a
              href="https://merriva.id"
              target="_blank"
              rel="noopener noreferrer"
            >
              {L.footer.brand}
            </a>
          </span>
        </div>
      ) : null}
    </footer>
  );
}

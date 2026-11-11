import { CalendarPlus, MapPin, Radio } from "lucide-react";
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
import { CopyButton } from "@/themes/_shared/copy-button";
import { fotoStyle } from "@/themes/_shared/foto";
import { Countdown } from "@/themes/_shared/motion";
import type {
  InvitationEventView,
  InvitationMediaView,
  PhotoView,
} from "@/types/invitation";

import { LightboxThumb } from "@/themes/_shared/lightbox";
import { copy } from "@/lib/copy";
import { ThemeVideo, type VideoView } from "@/themes/_shared/video";

import { L } from "./labels";

const PRELINE = { whiteSpace: "pre-line" as const };

/** Baris bermask (`.bk-line`) — state tersembunyi diisi JS (§0.4). */
function MaskLine({ children }: { children: ReactNode }) {
  return (
    <span className="bk-line">
      <span>{children}</span>
    </span>
  );
}

const initialOf = (s: string) => (s.trim()[0] ?? "•").toUpperCase();

/** Strip geometris islami (menggambar diri saat scroll via `.bk-draw`). */
function GeoStrip() {
  return (
    <svg className="bk-geo bk-draw" viewBox="0 0 280 30" aria-hidden>
      <path d="M0 15 H92 M188 15 H280 M140 1 L154 15 L140 29 L126 15 Z M112 15 L120 7 M112 15 L120 23 M168 15 L160 7 M168 15 L160 23" />
    </svg>
  );
}

/* ------------------------------------------------------------- Hero -------- */
export function Hero({
  groomName,
  brideName,
  greetingOpen,
}: {
  groomName: string;
  brideName: string;
  greetingOpen?: string;
}) {
  return (
    <header className="bk-section bk-center bk-hero">
      <div className="bk-reveal">
        <p className="bk-eyebrow">{L.hero.eyebrow}</p>
      </div>
      <h2 className="bk-title">
        <MaskLine>{L.hero.headingLead}</MaskLine>
        <MaskLine>
          {L.hero.headingConnector} <em>{L.hero.headingEmphasis}.</em>
        </MaskLine>
      </h2>
      {greetingOpen ? (
        <p className="bk-lead bk-reveal" style={PRELINE}>
          {greetingOpen}
        </p>
      ) : (
        <p className="bk-lead bk-reveal">
          {groomName} &amp; {brideName}
        </p>
      )}
      <GeoStrip />
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
    <section className="bk-section bk-quote bk-center">
      <div className="bk-quote__frame" aria-hidden />
      <div className="bk-reveal">
        <p className="bk-eyebrow bk-eyebrow--gold">{L.quote.eyebrow}</p>
      </div>
      <blockquote className="bk-quote__text">
        <MaskLine>“{quote.text}”</MaskLine>
      </blockquote>
      {quote.source ? (
        <div className="bk-reveal">
          <cite className="bk-quote__src">{quote.source}</cite>
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------ Couple ------- */
function Mempelai({
  person,
  role,
  initial,
  photo,
}: {
  person: Person;
  role: string;
  initial: string;
  photo?: PhotoView | null;
}) {
  const parents = L.couple.parents(person.fatherName, person.motherName);
  return (
    <div className="bk-person bk-reveal">
      <div className="bk-mihrab">
        <div className="bk-mihrab__ph" aria-hidden>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.url}
              alt=""
              style={{ width: "100%", height: "100%", ...fotoStyle(photo) }}
            />
          ) : (
            <span>{initial}</span>
          )}
        </div>
      </div>
      <div className="bk-person__role">{role}</div>
      <h3 className="bk-person__name">
        <MaskLine>{person.name || "—"}</MaskLine>
      </h3>
      {person.childOrder ? (
        <p className="bk-person__meta">{person.childOrder}</p>
      ) : null}
      {parents ? <p className="bk-person__meta">{parents}</p> : null}
    </div>
  );
}

export function Couple({
  groom,
  bride,
  groomPhoto,
  bridePhoto,
}: {
  groom: Person;
  bride: Person;
  groomPhoto?: PhotoView | null;
  bridePhoto?: PhotoView | null;
}) {
  return (
    <section className="bk-section">
      <div className="bk-center bk-reveal">
        <p className="bk-eyebrow">{L.couple.eyebrow}</p>
      </div>
      <div className="bk-couple">
        <Mempelai
          person={bride}
          role={L.couple.bride}
          initial={initialOf(bride.nickname || bride.name || "•")}
          photo={bridePhoto}
        />
        <Mempelai
          person={groom}
          role={L.couple.groom}
          initial={initialOf(groom.nickname || groom.name || "•")}
          photo={groomPhoto}
        />
      </div>
    </section>
  );
}

/* --------------------------------------------------------- Countdown ------- */
export function CountdownBlock({ targetIso }: { targetIso: string }) {
  return (
    <section className="bk-section bk-countdown-sec bk-center">
      <div className="bk-reveal">
        <p className="bk-eyebrow">{L.countdown.eyebrow}</p>
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
  livestreamUrl,
}: {
  events: InvitationEventView[];
  tz: TimezoneId;
  slug: string;
  /** Sudah digerbang server: Premium + https (DECISIONS #116). */
  livestreamUrl?: string;
}) {
  const icsServable = !isReservedSlug(slug) && !isDraftSlug(slug);
  return (
    <section className="bk-section">
      <div className="bk-center bk-reveal">
        <p className="bk-eyebrow">{L.schedule.eyebrow}</p>
      </div>
      <div className="bk-events">
        {events.map((e) => {
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
            <article className="bk-event bk-reveal" key={e.id}>
              <div className="bk-event__tag">{e.name}</div>
              <h3 className="bk-event__title">
                <MaskLine>{f ? `${f.weekday}, ${f.date}` : e.name}</MaskLine>
              </h3>
              <div className="bk-event__meta">
                {f ? (
                  <>
                    <b>
                      {f.time} {f.tzLabel}
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
              <div className="bk-pills">
                {maps ? (
                  <a
                    className="bk-pill bk-pill--gold"
                    href={maps}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPin size={14} />
                    {L.schedule.maps}
                  </a>
                ) : null}
                {gcal ? (
                  <details className="bk-cal">
                    <summary className="bk-pill">
                      <CalendarPlus size={14} />
                      {L.schedule.calendar}
                    </summary>
                    <div className="bk-cal__menu">
                      <a
                        className="bk-cal__opt"
                        href={gcal}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {L.schedule.calendarGoogle}
                      </a>
                      {icsServable ? (
                        <a
                          className="bk-cal__opt"
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
          );
        })}
      </div>
      {livestreamUrl ? (
        <div className="bk-live bk-reveal">
          <a
            className="bk-pill bk-pill--gold"
            href={livestreamUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Radio size={14} />
            {L.schedule.livestream}
          </a>
        </div>
      ) : null}
    </section>
  );
}

/* ----------------------------------------------------------- Gallery ------- */
export function Gallery({ media }: { media: InvitationMediaView[] }) {
  return (
    <section className="bk-section bk-gallery-sec">
      <div className="bk-center bk-reveal">
        <p className="bk-eyebrow">{L.gallery.eyebrow}</p>
      </div>
      <div className="bk-gallery" data-lb-scroll>
        {media.map((m, i) => (
          <figure className="bk-gallery__item" key={m.id}>
            <LightboxThumb m={m} index={i} />
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Video ------- */
export function VideoSection({
  video,
  youtubeUrl,
}: {
  video: VideoView | null | undefined;
  youtubeUrl: string | undefined;
}) {
  return (
    <section className="bk-section">
      <div className="bk-center bk-reveal">
        <p className="bk-eyebrow">{L.video.eyebrow}</p>
      </div>
      <div className="bk-video bk-reveal">
        <ThemeVideo
          video={video}
          youtubeUrl={youtubeUrl}
          labels={copy.public.video}
        />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Story ------- */
export function Story({ story }: { story: StoryEntry[] }) {
  return (
    <section className="bk-section">
      <div className="bk-center bk-reveal">
        <p className="bk-eyebrow">{L.story.eyebrow}</p>
        <h2 className="bk-h2">{L.story.heading}</h2>
      </div>
      <div className="bk-timeline">
        {story.map((s, i) => (
          <div className="bk-reveal" key={i}>
            <div className="bk-story">
              {s.date ? <p className="bk-story__date">{s.date}</p> : null}
              <h3 className="bk-story__title">{s.title}</h3>
              {/* Narasi love story opsional (#132). */}
              {s.narrative ? (
                <p className="bk-story__body">{s.narrative}</p>
              ) : null}
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
    <section className="bk-section">
      <div className="bk-center bk-reveal">
        <p className="bk-eyebrow">{L.envelope.eyebrow}</p>
        <h2 className="bk-h2">{L.envelope.heading}</h2>
        <p className="bk-lead" style={{ marginTop: "0.8rem" }}>
          {L.envelope.note}
        </p>
      </div>
      <div className="bk-inner" style={{ marginTop: "0.5rem" }}>
        {envelope.banks.map((b, i) => (
          <div className="bk-reveal" key={`b${i}`}>
            <article className="bk-account">
              <p className="bk-account__label">{b.bank}</p>
              <p className="bk-account__num">{b.number}</p>
              <p className="bk-person__meta">
                {L.envelope.holder} {b.holder}
              </p>
              <CopyButton
                value={b.number}
                labelCopy={L.envelope.copy}
                labelCopied={L.envelope.copied}
                className="bk-copy"
              />
            </article>
          </div>
        ))}
        {envelope.ewallets.map((w, i) => (
          <div className="bk-reveal" key={`w${i}`}>
            <article className="bk-account">
              <p className="bk-account__label">{w.provider}</p>
              <p className="bk-account__num">{w.number}</p>
              {w.holder ? (
                <p className="bk-person__meta">
                  {L.envelope.holder} {w.holder}
                </p>
              ) : null}
              <CopyButton
                value={w.number}
                labelCopy={L.envelope.copy}
                labelCopied={L.envelope.copied}
                className="bk-copy"
              />
            </article>
          </div>
        ))}
        {envelope.giftAddress ? (
          <div className="bk-reveal">
            <article className="bk-account">
              <p className="bk-account__label">{L.envelope.giftAddress}</p>
              <p
                className="bk-person__meta"
                style={{ ...PRELINE, marginTop: 4 }}
              >
                {envelope.giftAddress}
              </p>
            </article>
          </div>
        ) : null}
        <div className="bk-reveal" style={{ marginTop: "1.1rem" }}>
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
    <footer className="bk-footer bk-center">
      <div className="bk-fin bk-reveal">
        {initialOf(groomName)} <span className="bk-fin__mark">۞</span>{" "}
        {initialOf(brideName)}
      </div>
      {greetingClose ? (
        <div className="bk-reveal">
          <p className="bk-lead" style={{ ...PRELINE, marginTop: "1.2rem" }}>
            {greetingClose}
          </p>
        </div>
      ) : null}
      <div className="bk-reveal">
        <p className="bk-footer__salam">Wassalamu&apos;alaikum Wr. Wb.</p>
      </div>
      <div className="bk-reveal">
        <div className="bk-credit__name">
          {groomName} &amp; {brideName}
        </div>
      </div>
      {watermark ? (
        <div className="bk-reveal">
          <span className="bk-watermark">
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

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
import { fotoStyle } from "@/themes/_shared/foto";
import { Countdown } from "@/themes/_shared/motion";
import { CopyButton } from "@/themes/_shared/copy-button";
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

/** Baris bermask (`.vd-line`) — state tersembunyi diisi JS (§0.4). */
function MaskLine({ children }: { children: ReactNode }) {
  return (
    <span className="vd-line">
      <span>{children}</span>
    </span>
  );
}

/** Ranting botani yang menggambar diri saat scroll (path disalin dari prototipe). */
function Branch() {
  return (
    <svg
      className="vd-branch vd-draw"
      viewBox="0 0 260 60"
      aria-hidden
      focusable="false"
    >
      <path d="M10 34 C 70 22, 190 22, 250 34" />
      <path d="M56 28 q -6 -14 -20 -16 q 2 14 20 16 M104 24 q -4 -14 -18 -18 q 0 16 18 18 M156 24 q 4 -14 18 -18 q 0 16 -18 18 M204 28 q 6 -14 20 -16 q -2 14 -20 16" />
      <path
        className="vd-terra"
        d="M130 24 m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0"
      />
    </svg>
  );
}

/** Sudut daun kartu "pressed flower". */
function Corner() {
  return (
    <svg className="vd-corner vd-draw" viewBox="0 0 74 74" aria-hidden>
      <path d="M6 68 C 20 40, 40 20, 68 8 M28 46 q -12 -4 -14 -16 q 14 0 14 16 M48 26 q -2 -14 8 -22 q 6 12 -8 22" />
    </svg>
  );
}

const initialOf = (s: string) => (s.trim()[0] ?? "•").toUpperCase();

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
    <header className="vd-section vd-hero vd-center">
      <span className="vd-eyebrow vd-reveal">{L.hero.eyebrow}</span>
      <h1 className="vd-hero__title">
        <MaskLine>
          <em>{groomName}</em> &amp; <em>{brideName}</em>
        </MaskLine>
      </h1>
      {greetingOpen ? (
        <p className="vd-lead vd-reveal" style={PRELINE}>
          {greetingOpen}
        </p>
      ) : null}
      <Branch />
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
    <section className="vd-section vd-quote vd-center">
      <blockquote className="vd-quote__text">
        <MaskLine>“{quote.text}”</MaskLine>
      </blockquote>
      {quote.source ? (
        <div className="vd-reveal">
          <cite className="vd-quote__src">{quote.source}</cite>
        </div>
      ) : null}
    </section>
  );
}

/* ---------------------------------------------------- Pressed (couple) ----- */
function PressedCard({
  person,
  role,
  variant,
  initial,
  photo,
}: {
  person: Person;
  role: string;
  variant: "a" | "b";
  initial: string;
  photo?: PhotoView | null;
}) {
  const parents = L.couple.parents(person.fatherName, person.motherName);
  return (
    <div className={`vd-pressed vd-pressed--${variant} vd-reveal`}>
      <span className="vd-pressed__corner">
        <Corner />
      </span>
      <div className="vd-oval">
        <div className="vd-oval__ph" aria-hidden>
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
      <div className="vd-pressed__role">{role}</div>
      <h3 className="vd-pressed__name">
        <MaskLine>
          <em>{person.name || "—"}</em>
        </MaskLine>
      </h3>
      {person.childOrder ? (
        <p className="vd-pressed__meta">{person.childOrder}</p>
      ) : null}
      {parents ? <p className="vd-pressed__meta">{parents}</p> : null}
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
    <section className="vd-section">
      <div className="vd-center vd-reveal">
        <p className="vd-eyebrow">{L.couple.eyebrow}</p>
      </div>
      <div className="vd-couple">
        <PressedCard
          person={bride}
          role={L.couple.bride}
          variant="a"
          initial={initialOf(bride.nickname || bride.name || "•")}
          photo={bridePhoto}
        />
        <PressedCard
          person={groom}
          role={L.couple.groom}
          variant="b"
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
    <section className="vd-section vd-center">
      <div className="vd-reveal">
        <p className="vd-eyebrow">{L.countdown.eyebrow}</p>
      </div>
      <div className="vd-cd-frame vd-reveal">
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
      </div>
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
    <section className="vd-section">
      <div className="vd-center vd-reveal">
        <p className="vd-eyebrow">{L.schedule.eyebrow}</p>
      </div>
      <div className="vd-timeline-sched">
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
            <article className="vd-stop vd-reveal" key={e.id}>
              <h3 className="vd-stop__title">
                <MaskLine>{e.name}</MaskLine>
              </h3>
              <div className="vd-stop__meta">
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
              <div className="vd-pills">
                {maps ? (
                  <a
                    className="vd-pill vd-pill--solid"
                    href={maps}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPin size={14} />
                    {L.schedule.maps}
                  </a>
                ) : null}
                {gcal ? (
                  <details className="vd-cal">
                    <summary className="vd-pill">
                      <CalendarPlus size={14} />
                      {L.schedule.calendar}
                    </summary>
                    <div className="vd-cal__menu">
                      <a
                        className="vd-cal__opt"
                        href={gcal}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {L.schedule.calendarGoogle}
                      </a>
                      {icsServable ? (
                        <a
                          className="vd-cal__opt"
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
    </section>
  );
}

/* ----------------------------------------------------------- Gallery ------- */
export function Gallery({ media }: { media: InvitationMediaView[] }) {
  return (
    <section className="vd-section">
      <div className="vd-center vd-reveal">
        <p className="vd-eyebrow">{L.gallery.eyebrow}</p>
        <h2 className="vd-h2">{L.gallery.heading}</h2>
      </div>
      <div className="vd-herbarium" data-lb-scroll>
        {media.map((m, i) => (
          <figure className="vd-herb__item vd-reveal" key={m.id}>
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
    <section className="vd-section">
      <div className="vd-center vd-reveal">
        <p className="vd-eyebrow">{L.video.eyebrow}</p>
        <h2 className="vd-h2">{L.video.heading}</h2>
      </div>
      <div className="vd-video vd-reveal">
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
    <section className="vd-section">
      <div className="vd-center vd-reveal">
        <p className="vd-eyebrow">{L.story.eyebrow}</p>
        <h2 className="vd-h2">{L.story.heading}</h2>
      </div>
      <div className="vd-timeline">
        {story.map((s, i) => (
          <div className="vd-reveal" key={i}>
            <div className="vd-story">
              {s.date ? <p className="vd-story__date">{s.date}</p> : null}
              <h3 className="vd-story__title">{s.title}</h3>
              <p className="vd-story__body">{s.narrative}</p>
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
    <section className="vd-section">
      <div className="vd-center vd-reveal">
        <p className="vd-eyebrow">{L.envelope.eyebrow}</p>
        <h2 className="vd-h2">{L.envelope.heading}</h2>
        <p className="vd-lead" style={{ marginTop: "0.8rem" }}>
          {L.envelope.note}
        </p>
      </div>
      <div className="vd-inner" style={{ marginTop: "0.5rem" }}>
        {envelope.banks.map((b, i) => (
          <div className="vd-reveal" key={`b${i}`}>
            <article className="vd-account">
              <p className="vd-account__label">{b.bank}</p>
              <p className="vd-account__num">{b.number}</p>
              <p className="vd-pressed__meta">
                {L.envelope.holder} {b.holder}
              </p>
              <CopyButton
                value={b.number}
                labelCopy={L.envelope.copy}
                labelCopied={L.envelope.copied}
                className="vd-copy"
              />
            </article>
          </div>
        ))}
        {envelope.ewallets.map((w, i) => (
          <div className="vd-reveal" key={`w${i}`}>
            <article className="vd-account">
              <p className="vd-account__label">{w.provider}</p>
              <p className="vd-account__num">{w.number}</p>
              {w.holder ? (
                <p className="vd-pressed__meta">
                  {L.envelope.holder} {w.holder}
                </p>
              ) : null}
              <CopyButton
                value={w.number}
                labelCopy={L.envelope.copy}
                labelCopied={L.envelope.copied}
                className="vd-copy"
              />
            </article>
          </div>
        ))}
        {envelope.giftAddress ? (
          <div className="vd-reveal">
            <article className="vd-account">
              <p className="vd-account__label">{L.envelope.giftAddress}</p>
              <p
                className="vd-pressed__meta"
                style={{ ...PRELINE, marginTop: 4 }}
              >
                {envelope.giftAddress}
              </p>
            </article>
          </div>
        ) : null}
        <div className="vd-reveal" style={{ marginTop: "1.1rem" }}>
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
  const gi = (groomName.trim()[0] ?? "•").toUpperCase();
  const bi = (brideName.trim()[0] ?? "•").toUpperCase();
  return (
    <footer className="vd-footer vd-center">
      <div className="vd-reveal">
        <div className="vd-footer__mono">
          {bi} &amp; {gi}
        </div>
        {greetingClose ? (
          <p className="vd-lead" style={{ ...PRELINE, marginTop: "0.9rem" }}>
            {greetingClose}
          </p>
        ) : null}
        <p className="vd-eyebrow" style={{ marginTop: "1.4rem" }}>
          {L.footer.thanks}
        </p>
        {watermark ? (
          <span className="vd-watermark">
            {L.footer.by}{" "}
            <a
              href="https://merriva.id"
              target="_blank"
              rel="noopener noreferrer"
            >
              {L.footer.brand}
            </a>
          </span>
        ) : null}
      </div>
    </footer>
  );
}

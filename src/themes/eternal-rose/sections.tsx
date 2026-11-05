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

/** Baris bermask (`.er-line`) — state tersembunyi diisi JS (§0.4). */
function MaskLine({ children }: { children: ReactNode }) {
  return (
    <span className="er-line">
      <span>{children}</span>
    </span>
  );
}

/* ---------------------------------------------------------- Marquee -------- */
export function Marquee({ text }: { text: string }) {
  // Track diulang agar loop mulus (translateX -50%).
  return (
    <div className="er-marquee" aria-hidden>
      <div className="er-marquee__track">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i}>
            {text} <span className="er-dot">✦</span>&nbsp;
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Hero -------- */
export function Hero({
  monogram,
  groomName,
  brideName,
  greetingOpen,
}: {
  monogram: string;
  groomName: string;
  brideName: string;
  greetingOpen?: string;
}) {
  return (
    <header className="er-section er-hero">
      <svg
        className="er-flourish"
        viewBox="0 0 130 130"
        aria-hidden
        focusable="false"
      >
        <path d="M118 12 C 92 18, 84 42, 96 58 C 104 69, 120 66, 122 54 C 124 43, 112 38, 106 46" />
        <path d="M96 58 C 84 74, 60 78, 44 92 C 32 102, 26 114, 28 124" />
        <path d="M70 84 C 76 74, 90 72, 96 76 M52 98 C 58 88, 70 86, 78 90" />
      </svg>
      <div className="er-reveal">
        <div className="er-hero__mono">{monogram}</div>
      </div>
      <h1 className="er-hero__names">
        <MaskLine>{L.hero.title}</MaskLine>
        <MaskLine>
          {L.hero.of} <em>{groomName}</em> &amp; <em>{brideName}</em>
        </MaskLine>
      </h1>
      {greetingOpen ? (
        <div className="er-reveal">
          <p className="er-lead" style={PRELINE}>
            {greetingOpen}
          </p>
        </div>
      ) : null}
    </header>
  );
}

/* ------------------------------------------------------------ Quote -------- */
export function QuoteBlock({
  quote,
}: {
  quote?: { text: string; source?: string };
}) {
  // greetingOpen sudah tampil di hero → di sini fokus kutipan/ayat.
  if (!quote) return null;
  return (
    <section className="er-section er-quote">
      <blockquote>
        <MaskLine>“{quote.text}”</MaskLine>
      </blockquote>
      {quote.source ? (
        <div className="er-reveal">
          <cite>{quote.source}</cite>
        </div>
      ) : null}
    </section>
  );
}

/* ----------------------------------------------------------- Couple -------- */
function PersonCard({
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
  photo?: PhotoView | null;
}) {
  const parents = L.couple.parents(person.fatherName, person.motherName);
  return (
    <div className={`er-person er-person--${side}`}>
      <div className="er-arch" data-parallax={side === "left" ? "-8" : "8"}>
        {/* Foto mempelai sudah di-resolve di server (`data.groomPhoto`/
            `bridePhoto`), lengkap dengan titik fokus & perbesaran pilihan
            pemilik — `fotoStyle` yang menerapkannya (THEME-CONTRACT §3).
            Fallback monogram inisial bila tak ada: tetap anggun, tak ada
            kotak kosong. */}
        <div className="er-arch__ph">
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
      <div>
        <div className="er-reveal">
          <div className="er-person__role">{role}</div>
        </div>
        <h3>
          <MaskLine>{person.name || "—"}</MaskLine>
        </h3>
        {person.childOrder ? (
          <div className="er-reveal">
            <p className="er-person__meta">{person.childOrder}</p>
          </div>
        ) : null}
        {parents ? (
          <div className="er-reveal">
            <p className="er-person__meta">{parents}</p>
          </div>
        ) : null}
      </div>
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
  const gi = (groom.nickname || groom.name || "•")
    .trim()
    .charAt(0)
    .toUpperCase();
  const bi = (bride.nickname || bride.name || "•")
    .trim()
    .charAt(0)
    .toUpperCase();
  return (
    <section className="er-section">
      <div className="er-center er-reveal" style={{ marginBottom: "18px" }}>
        <p className="er-eyebrow">{L.couple.eyebrow}</p>
      </div>
      <div className="er-couple">
        <PersonCard
          person={groom}
          role={L.couple.groom}
          side="left"
          initial={gi}
          photo={groomPhoto}
        />
        <PersonCard
          person={bride}
          role={L.couple.bride}
          side="right"
          initial={bi}
          photo={bridePhoto}
        />
      </div>
    </section>
  );
}

/* --------------------------------------------------------- Countdown ------- */
export function CountdownBlock({ targetIso }: { targetIso: string }) {
  return (
    <section className="er-section er-countdown-sec">
      <div className="er-reveal">
        <p className="er-eyebrow">{L.countdown.eyebrow}</p>
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
    <section className="er-section">
      <div className="er-center er-reveal">
        <p className="er-eyebrow">{L.schedule.eyebrow}</p>
        <h2 className="er-h2">{L.schedule.heading}</h2>
      </div>
      <div style={{ marginTop: "24px" }}>
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
            <article className="er-event" key={e.id}>
              <div className="er-event__num" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3>
                <MaskLine>{e.name}</MaskLine>
              </h3>
              <div className="er-reveal">
                <div className="er-event__meta">
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
                <div className="er-pills">
                  {maps ? (
                    <a
                      className="er-pill er-pill--solid"
                      href={maps}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MapPin size={14} />
                      {L.schedule.maps}
                    </a>
                  ) : null}
                  {gcal ? (
                    <details className="er-cal">
                      <summary className="er-pill">
                        <CalendarPlus size={14} />
                        {L.schedule.calendar}
                      </summary>
                      <div className="er-cal__menu">
                        <a
                          className="er-cal__opt"
                          href={gcal}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {L.schedule.calendarGoogle}
                        </a>
                        {icsServable ? (
                          <a
                            className="er-cal__opt"
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
    <section className="er-section er-gallery">
      <div className="er-center er-reveal">
        <p className="er-eyebrow">{L.gallery.eyebrow}</p>
        <h2 className="er-h2 er-serif">{L.gallery.heading}</h2>
      </div>
      <div className="er-gallery__track" data-lb-scroll>
        {media.map((m, i) => (
          <div className="er-gallery__item" key={m.id}>
            <LightboxThumb m={m} index={i} />
          </div>
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
    <section className="er-section">
      <div className="er-center er-reveal">
        <p className="er-eyebrow">{L.video.eyebrow}</p>
        <h2 className="er-h2 er-serif">{L.video.heading}</h2>
      </div>
      <div className="er-video er-reveal">
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
    <section className="er-section">
      <div className="er-center er-reveal">
        <p className="er-eyebrow">{L.story.eyebrow}</p>
        <h2 className="er-h2">{L.story.heading}</h2>
      </div>
      <div className="er-timeline" style={{ marginTop: "28px" }}>
        {story.map((s, i) => (
          <div className="er-reveal" key={i}>
            <div className="er-story">
              {s.date ? <p className="er-story__date">{s.date}</p> : null}
              <h3 className="er-story__title">{s.title}</h3>
              <p className="er-story__body">{s.narrative}</p>
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
    <section className="er-section">
      <div className="er-center er-reveal">
        <p className="er-eyebrow">{L.envelope.eyebrow}</p>
        <h2 className="er-h2">{L.envelope.heading}</h2>
        <p className="er-lead" style={{ marginTop: "14px" }}>
          {L.envelope.note}
        </p>
      </div>
      <div className="er-inner" style={{ marginTop: "8px" }}>
        {envelope.banks.map((b, i) => (
          <div className="er-reveal" key={`b${i}`}>
            <article className="er-account">
              <p className="er-account__label">{b.bank}</p>
              <p className="er-account__num">{b.number}</p>
              <p className="er-person__meta">
                {L.envelope.holder} {b.holder}
              </p>
              <CopyButton
                value={b.number}
                labelCopy={L.envelope.copy}
                labelCopied={L.envelope.copied}
                className="er-copy"
              />
            </article>
          </div>
        ))}
        {envelope.ewallets.map((w, i) => (
          <div className="er-reveal" key={`w${i}`}>
            <article className="er-account">
              <p className="er-account__label">{w.provider}</p>
              <p className="er-account__num">{w.number}</p>
              {w.holder ? (
                <p className="er-person__meta">
                  {L.envelope.holder} {w.holder}
                </p>
              ) : null}
              <CopyButton
                value={w.number}
                labelCopy={L.envelope.copy}
                labelCopied={L.envelope.copied}
                className="er-copy"
              />
            </article>
          </div>
        ))}
        {envelope.giftAddress ? (
          <div className="er-reveal">
            <article className="er-account">
              <p className="er-account__label">{L.envelope.giftAddress}</p>
              <p
                className="er-person__meta"
                style={{ ...PRELINE, marginTop: 4 }}
              >
                {envelope.giftAddress}
              </p>
            </article>
          </div>
        ) : null}
        <div className="er-reveal" style={{ marginTop: "18px" }}>
          <GiftConfirm slug={slug} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Footer ------- */
export function Footer({
  greetingClose,
  monogram,
  watermark,
}: {
  greetingClose?: string;
  monogram: string;
  watermark: boolean;
}) {
  return (
    <footer className="er-footer">
      <div className="er-reveal">
        <div className="er-footer__mono">{monogram}</div>
        {greetingClose ? <p style={PRELINE}>{greetingClose}</p> : null}
        <p
          className="er-eyebrow"
          style={{ marginTop: "18px", color: "inherit" }}
        >
          {L.footer.thanks}
        </p>
        {watermark ? (
          <span className="er-watermark">
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

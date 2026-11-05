import { CalendarPlus, MapPin, Radio } from "lucide-react";
import type { ReactNode } from "react";

import { GiftConfirm } from "@/components/public/guestbook/gift-confirm";
import { googleCalendarUrl } from "@/lib/calendar";
import { formatEventDateTime } from "@/lib/datetime";
import { isDraftSlug, isReservedSlug } from "@/lib/slug";
import type {
  Envelope as EnvelopeType,
  Person,
  Quote,
  StoryEntry,
  TimezoneId,
} from "@/lib/validation/content";
import { CopyButton } from "@/themes/_shared/copy-button";
import { fotoStyle } from "@/themes/_shared/foto";
import { LightboxThumb } from "@/themes/_shared/lightbox";
import { Countdown } from "@/themes/_shared/motion";
import type {
  InvitationEventView,
  InvitationMediaView,
  PhotoView,
} from "@/types/invitation";
import { copy } from "@/lib/copy";
import { ThemeVideo, type VideoView } from "@/themes/_shared/video";

import { L } from "./labels";

/**
 * Section tema `marawa` (adat Minang, tier Story, dark) — acuan visual
 * `prototypes/marawa-story.html`. Ornamen: kaluak paku `.mw-draw`, bingkai
 * foto clip gonjong, kartu acara bersudut emas, mask-reveal `.mw-line` (§0.4).
 */

const PRELINE = { whiteSpace: "pre-line" as const };

const initialOf = (s: string) => (s.trim()[0] ?? "•").toUpperCase();

function MaskLine({ children }: { children: ReactNode }) {
  return (
    <span className="mw-line">
      <span>{children}</span>
    </span>
  );
}

/** Kaluak paku (pakis) — ornamen sudut, menggambar diri via fx. */
function Paku({ pos }: { pos: "tl" | "br" }) {
  return (
    <svg
      className={`mw-paku mw-paku--${pos} mw-draw`}
      viewBox="0 0 74 74"
      aria-hidden
    >
      <path d="M6 68 C6 36 28 12 62 10 C40 18 30 32 30 44 C30 56 40 62 48 58 C54 54 54 46 48 44 C44 42 40 46 42 50" />
    </svg>
  );
}

/* -------------------------------------------------------------- Hero ------- */
export function Hero({ greetingOpen }: { greetingOpen?: string }) {
  return (
    <header className="mw-section mw-center mw-hero">
      <Paku pos="tl" />
      <Paku pos="br" />
      <span className="mw-eyebrow mw-reveal">{L.hero.eyebrow}</span>
      <p className="mw-lead mw-reveal" style={PRELINE}>
        {greetingOpen ?? L.hero.lead}
      </p>
    </header>
  );
}

/* ------------------------------------------------------------- Quote ------- */
export function PepatahBlock({ quote }: { quote?: Quote | null }) {
  const text = quote?.text || L.quote.fallbackText;
  const source = quote?.source || L.quote.fallbackSource;
  return (
    <section className="mw-section mw-maroon mw-center">
      <span className="mw-eyebrow mw-reveal">{L.quote.caption}</span>
      <blockquote className="mw-quote">
        <MaskLine>“{text}”</MaskLine>
      </blockquote>
      <div className="mw-reveal">
        <cite className="mw-quote__cite">{source}</cite>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Couple ------- */
function Urang({
  person,
  role,
  photo,
}: {
  person: Person;
  role: string;
  photo?: PhotoView | null;
}) {
  const parents = L.couple.parents(person.fatherName, person.motherName);
  return (
    <div className="mw-person mw-reveal">
      <div className="mw-foto">
        <div className="mw-foto__ph">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.url}
              alt=""
              style={{ width: "100%", height: "100%", ...fotoStyle(photo) }}
            />
          ) : (
            <span>{initialOf(person.nickname || person.name || "•")}</span>
          )}
        </div>
      </div>
      <h3 className="mw-person__name">
        <MaskLine>{person.name || "—"}</MaskLine>
      </h3>
      <div className="mw-person__role">{role}</div>
      {person.childOrder || parents ? (
        <p className="mw-person__meta" style={PRELINE}>
          {person.childOrder ? `${person.childOrder}\n` : ""}
          {parents}
        </p>
      ) : null}
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
    <section className="mw-section">
      <div className="mw-center mw-reveal">
        <span className="mw-eyebrow">{L.couple.eyebrow}</span>
        <h2 className="mw-title">{L.couple.heading}</h2>
      </div>
      <div className="mw-couple">
        <Urang person={bride} role={L.couple.bride} photo={bridePhoto} />
        <div className="mw-amp mw-reveal" aria-hidden>
          ✦
        </div>
        <Urang person={groom} role={L.couple.groom} photo={groomPhoto} />
      </div>
    </section>
  );
}

/* --------------------------------------------------------- Countdown ------- */
export function CountdownBlock({ targetIso }: { targetIso: string }) {
  return (
    <section className="mw-section mw-center">
      <span className="mw-eyebrow mw-reveal">{L.countdown.eyebrow}</span>
      <div className="mw-cd mw-reveal">
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
    <section className="mw-section mw-maroon">
      <div className="mw-center mw-reveal">
        <span className="mw-eyebrow">{L.schedule.eyebrow}</span>
        <h2 className="mw-title">{L.schedule.heading}</h2>
      </div>
      <div className="mw-events">
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
            <article className="mw-event mw-reveal" key={e.id}>
              <h3 className="mw-event__title">
                <MaskLine>{e.name}</MaskLine>
              </h3>
              {f ? (
                <>
                  <div className="mw-event__tgl">
                    {f.weekday}, {f.date}
                  </div>
                  <div className="mw-event__jam">
                    {f.time} {f.tzLabel}
                  </div>
                </>
              ) : null}
              {e.venueName || e.address ? (
                <p className="mw-event__tempat">
                  {e.venueName}
                  {e.venueName && e.address ? <br /> : null}
                  {e.address}
                </p>
              ) : null}
              {maps || gcal ? (
                <div className="mw-pills">
                  {maps ? (
                    <a
                      className="mw-pill"
                      href={maps}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MapPin size={14} aria-hidden />
                      {L.schedule.maps}
                    </a>
                  ) : null}
                  {gcal ? (
                    <details className="mw-cal">
                      <summary className="mw-pill">
                        <CalendarPlus size={14} aria-hidden />
                        {L.schedule.calendar}
                      </summary>
                      <div className="mw-cal__menu">
                        <a
                          className="mw-cal__opt"
                          href={gcal}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {L.schedule.calendarGoogle}
                        </a>
                        {icsServable ? (
                          <a
                            className="mw-cal__opt"
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
              ) : null}
            </article>
          );
        })}
      </div>
      {livestreamUrl ? (
        <div className="mw-live mw-reveal">
          <a
            className="mw-pill"
            href={livestreamUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Radio size={14} aria-hidden />
            {L.schedule.livestream}
          </a>
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------- Story ------- */
export function Story({ story }: { story: StoryEntry[] }) {
  return (
    <section className="mw-section">
      <div className="mw-center mw-reveal">
        <span className="mw-eyebrow">{L.story.eyebrow}</span>
        <h2 className="mw-title">{L.story.heading}</h2>
      </div>
      <div className="mw-story">
        {story.map((s, i) => (
          <article className="mw-beat mw-reveal" key={i}>
            {s.date ? <div className="mw-beat__thn">{s.date}</div> : null}
            <h3 className="mw-beat__title">
              <MaskLine>{s.title}</MaskLine>
            </h3>
            <p className="mw-beat__text">{s.narrative}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- Gallery ------- */
export function Gallery({ media }: { media: InvitationMediaView[] }) {
  return (
    <section className="mw-section mw-maroon">
      <div className="mw-center mw-reveal">
        <span className="mw-eyebrow">{L.gallery.eyebrow}</span>
        <h2 className="mw-title">{L.gallery.heading}</h2>
      </div>
      {/* Dua kolom block-flow — bukan CSS grid (catatan prototipe wave-3). */}
      <div className="mw-galeri" data-lb-scroll>
        {media.map((m, i) => (
          <figure
            className={`mw-g-item ${i % 5 === 0 ? "mw-g-item--gonjong" : ""}`}
            key={m.id}
          >
            <LightboxThumb m={m} index={i} />
            <figcaption>
              {L.gallery.caption} {String(i + 1).padStart(2, "0")}
            </figcaption>
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
    <section className="mw-section">
      <div className="mw-center mw-reveal">
        <span className="mw-eyebrow">{L.video.eyebrow}</span>
        <h2 className="mw-title">{L.video.heading}</h2>
      </div>
      <div className="mw-video mw-reveal">
        <ThemeVideo
          video={video}
          youtubeUrl={youtubeUrl}
          labels={copy.public.video}
        />
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
    <section className="mw-section mw-sand mw-center">
      <span className="mw-eyebrow mw-reveal">{L.envelope.eyebrow}</span>
      <h2 className="mw-title mw-reveal">{L.envelope.heading}</h2>
      <p className="mw-lead mw-reveal">{L.envelope.note}</p>
      <div className="mw-gifts">
        {envelope.banks.map((b, i) => (
          <article className="mw-acct mw-reveal" key={`b${i}`}>
            <div>
              <b>{b.number}</b>
              <small>
                {b.bank} · {L.envelope.holder} {b.holder}
              </small>
            </div>
            <CopyButton
              value={b.number}
              labelCopy={L.envelope.copy}
              labelCopied={L.envelope.copied}
              className="mw-copy"
            />
          </article>
        ))}
        {envelope.ewallets.map((w, i) => (
          <article className="mw-acct mw-reveal" key={`w${i}`}>
            <div>
              <b>{w.number}</b>
              <small>
                {w.provider}
                {w.holder ? ` · ${L.envelope.holder} ${w.holder}` : ""}
              </small>
            </div>
            <CopyButton
              value={w.number}
              labelCopy={L.envelope.copy}
              labelCopied={L.envelope.copied}
              className="mw-copy"
            />
          </article>
        ))}
        {envelope.giftAddress ? (
          <article className="mw-acct mw-acct--addr mw-reveal">
            <div>
              <small>{L.envelope.giftAddress}</small>
              <p style={PRELINE}>{envelope.giftAddress}</p>
            </div>
          </article>
        ) : null}
        <div className="mw-reveal mw-gift-confirm">
          <GiftConfirm slug={slug} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Footer ------- */
export function Footer({
  greetingClose,
  watermark,
}: {
  greetingClose?: string;
  watermark: boolean;
}) {
  return (
    <footer className="mw-footer mw-center">
      <span className="mw-eyebrow mw-reveal">{L.footer.eyebrow}</span>
      <div className="mw-reveal">
        <p className="mw-lead" style={PRELINE}>
          {greetingClose ?? L.footer.thanks}
        </p>
      </div>
      {watermark ? (
        <div className="mw-reveal">
          <span className="mw-watermark">
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

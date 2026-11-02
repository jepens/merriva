import { CalendarPlus, MapPin } from "lucide-react";
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

import { L } from "./labels";

/**
 * Section tema `priangan` (adat Sunda, tier Story) — acuan visual
 * `prototypes/priangan-story.html`. Ornamen: divider julang ngapak & payung
 * geulis line-art (`.pg-draw` menggambar diri via fx), mask-reveal `.pg-line`
 * (state dimiliki JS §0.4), blok `.pg-reveal`.
 */

const PRELINE = { whiteSpace: "pre-line" as const };

const initialOf = (s: string) => (s.trim()[0] ?? "•").toUpperCase();

/** Baris bermask — state tersembunyi diisi fx (§0.4). */
function MaskLine({ children }: { children: ReactNode }) {
  return (
    <span className="pg-line">
      <span>{children}</span>
    </span>
  );
}

/** Divider julang ngapak: dua garis melengkung naik, menggambar diri. */
function Ngapak() {
  return (
    <svg className="pg-ngapak pg-draw" viewBox="0 0 150 26" aria-hidden>
      <path d="M4 22 C40 22 52 6 75 6 C98 6 110 22 146 22" />
      <path d="M26 22 C50 22 58 12 75 12 C92 12 100 22 124 22" opacity=".55" />
    </svg>
  );
}

/* -------------------------------------------------------------- Hero ------- */
export function Hero({ greetingOpen }: { greetingOpen?: string }) {
  return (
    <header className="pg-section pg-center pg-hero">
      {/* Awan konten — target yoyo fx (`.pg-stage .pg-cloud`); awan cover
          berada di luar stage. Path disalin dari prototipe, BUKAN diimpor dari
          cover.tsx ("use client"). */}
      <span className="pg-cloud pg-cloud--c" aria-hidden>
        <svg viewBox="0 0 120 52" focusable="false">
          <path
            d="M12 40c-8 0-12-6-9-12 2-5 8-7 13-5 1-8 9-14 18-12 6 1 11 6 12 11 4-3 10-3 14 0 3-7 11-10 18-7 6 2 10 8 9 14 5 0 9 4 9 8 0 2-1 3-3 3Z"
            opacity=".8"
          />
        </svg>
      </span>
      <span className="pg-eyebrow pg-reveal">{L.hero.eyebrow}</span>
      <p className="pg-lead pg-reveal" style={PRELINE}>
        {greetingOpen ?? L.hero.lead}
      </p>
      <Ngapak />
    </header>
  );
}

/* ------------------------------------------------------------- Quote ------- */
export function PepatahBlock({ quote }: { quote?: Quote | null }) {
  const text = quote?.text || L.quote.fallbackText;
  const source = quote?.source || L.quote.fallbackSource;
  return (
    <section className="pg-section pg-tinted pg-center">
      <span className="pg-eyebrow pg-reveal">{L.quote.caption}</span>
      <blockquote className="pg-quote">
        <MaskLine>“{text}”</MaskLine>
      </blockquote>
      <div className="pg-reveal">
        <cite className="pg-quote__cite">{source}</cite>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Couple ------- */
function Panganten({
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
    <div className="pg-person pg-reveal">
      <div className="pg-foto">
        <div className="pg-foto__ph">
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
      <h3 className="pg-person__name">
        <MaskLine>{person.name || "—"}</MaskLine>
      </h3>
      <div className="pg-person__role">{role}</div>
      {person.childOrder || parents ? (
        <p className="pg-person__meta" style={PRELINE}>
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
    <section className="pg-section">
      <div className="pg-center pg-reveal">
        <span className="pg-eyebrow">{L.couple.eyebrow}</span>
        <h2 className="pg-title">{L.couple.heading}</h2>
      </div>
      <div className="pg-couple">
        <Panganten person={bride} role={L.couple.bride} photo={bridePhoto} />
        <div className="pg-amp pg-reveal" aria-hidden>
          ﹠
        </div>
        <Panganten person={groom} role={L.couple.groom} photo={groomPhoto} />
      </div>
    </section>
  );
}

/* --------------------------------------------------------- Countdown ------- */
export function CountdownBlock({ targetIso }: { targetIso: string }) {
  return (
    <section className="pg-section pg-center">
      <span className="pg-eyebrow pg-reveal">{L.countdown.eyebrow}</span>
      <div className="pg-cd pg-reveal">
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
    <section className="pg-section pg-tinted">
      <div className="pg-center pg-reveal">
        <span className="pg-eyebrow">{L.schedule.eyebrow}</span>
        <h2 className="pg-title">{L.schedule.heading}</h2>
      </div>
      <div className="pg-events">
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
            <article className="pg-event pg-reveal" key={e.id}>
              <div className="pg-event__head">
                <h3>
                  <MaskLine>{e.name}</MaskLine>
                </h3>
              </div>
              <div className="pg-event__body">
                {f ? (
                  <>
                    <div className="pg-event__tgl">
                      {f.weekday}, {f.date}
                    </div>
                    <div className="pg-event__jam">
                      {f.time} {f.tzLabel}
                    </div>
                  </>
                ) : null}
                {e.venueName || e.address ? (
                  <p className="pg-event__tempat">
                    {e.venueName}
                    {e.venueName && e.address ? <br /> : null}
                    {e.address}
                  </p>
                ) : null}
                {maps || gcal ? (
                  <div className="pg-pills">
                    {maps ? (
                      <a
                        className="pg-pill"
                        href={maps}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MapPin size={14} aria-hidden />
                        {L.schedule.maps}
                      </a>
                    ) : null}
                    {gcal ? (
                      <details className="pg-cal">
                        <summary className="pg-pill">
                          <CalendarPlus size={14} aria-hidden />
                          {L.schedule.calendar}
                        </summary>
                        <div className="pg-cal__menu">
                          <a
                            className="pg-cal__opt"
                            href={gcal}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {L.schedule.calendarGoogle}
                          </a>
                          {icsServable ? (
                            <a
                              className="pg-cal__opt"
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
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Story ------- */
export function Story({ story }: { story: StoryEntry[] }) {
  return (
    <section className="pg-section">
      <div className="pg-center pg-reveal">
        <span className="pg-eyebrow">{L.story.eyebrow}</span>
        <h2 className="pg-title">{L.story.heading}</h2>
      </div>
      <div className="pg-story">
        {story.map((s, i) => (
          <article className="pg-beat pg-reveal" key={i}>
            {s.date ? <div className="pg-beat__thn">{s.date}</div> : null}
            <h3 className="pg-beat__title">
              <MaskLine>{s.title}</MaskLine>
            </h3>
            <p className="pg-beat__text">{s.narrative}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- Gallery ------- */
export function Gallery({ media }: { media: InvitationMediaView[] }) {
  return (
    <section className="pg-section pg-tinted">
      <div className="pg-center pg-reveal">
        <span className="pg-eyebrow">{L.gallery.eyebrow}</span>
        <h2 className="pg-title">{L.gallery.heading}</h2>
      </div>
      {/* Dua kolom BLOCK-FLOW (bukan CSS grid): baris grid terbukti kolaps utk
          tile rasio — catatan prototipe wave-3. */}
      <div className="pg-galeri" data-lb-scroll>
        {media.map((m, i) => (
          <figure
            className={`pg-g-item ${i % 4 === 0 ? "pg-g-item--arch" : ""}`}
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

/* ---------------------------------------------------------- Envelope ------- */
export function Envelope({
  envelope,
  slug,
}: {
  envelope: EnvelopeType;
  slug: string;
}) {
  return (
    <section className="pg-section pg-deep pg-center">
      <span className="pg-eyebrow pg-reveal">{L.envelope.eyebrow}</span>
      <h2 className="pg-title pg-reveal">{L.envelope.heading}</h2>
      <p className="pg-lead pg-reveal">{L.envelope.note}</p>
      <div className="pg-gifts">
        {envelope.banks.map((b, i) => (
          <article className="pg-acct pg-reveal" key={`b${i}`}>
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
              className="pg-copy"
            />
          </article>
        ))}
        {envelope.ewallets.map((w, i) => (
          <article className="pg-acct pg-reveal" key={`w${i}`}>
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
              className="pg-copy"
            />
          </article>
        ))}
        {envelope.giftAddress ? (
          <article className="pg-acct pg-acct--addr pg-reveal">
            <div>
              <small>{L.envelope.giftAddress}</small>
              <p style={PRELINE}>{envelope.giftAddress}</p>
            </div>
          </article>
        ) : null}
        <div className="pg-reveal pg-gift-confirm">
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
    <footer className="pg-footer pg-center">
      {/* Payung geulis line-art — menggambar diri saat masuk viewport. */}
      <svg className="pg-payung pg-draw" viewBox="0 0 150 130" aria-hidden>
        <path d="M10 62 C10 28 40 10 75 10 C110 10 140 28 140 62 Z" />
        <path d="M10 62 C22 52 34 52 42 62 C50 52 66 52 75 62 C84 52 100 52 108 62 C116 52 128 52 140 62" />
        <path d="M75 10 V62 M42 20 C32 32 26 46 24 60 M108 20 C118 32 124 46 126 60" />
        <path d="M75 62 V112 C75 122 86 124 90 116" />
      </svg>
      <span className="pg-eyebrow pg-reveal">{L.footer.eyebrow}</span>
      <div className="pg-reveal">
        <p className="pg-lead" style={PRELINE}>
          {greetingClose ?? L.footer.thanks}
        </p>
      </div>
      {watermark ? (
        <div className="pg-reveal">
          <span className="pg-watermark">
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

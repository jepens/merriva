import type { ReactNode } from "react";

import { GuestbookSection } from "@/components/public/guestbook/guestbook-section";
import { googleCalendarUrl } from "@/lib/calendar";
import { formatEventDateTime } from "@/lib/datetime";
import { isDraftSlug, isReservedSlug } from "@/lib/slug";
import type {
  Envelope as EnvelopeType,
  StoryEntry,
  TimezoneId,
} from "@/lib/validation/content";
import { CopyButton } from "@/themes/_shared/copy-button";
import { Countdown } from "@/themes/_shared/motion";
import type {
  InvitationEventView,
  InvitationMediaView,
} from "@/types/invitation";

import { L } from "./labels";

export interface PrismaStat {
  value: number;
  label: string;
}

/** Baris bermask (`.pr-line`) — state tersembunyi diisi JS (§0.4). */
function MaskLine({ children }: { children: ReactNode }) {
  return (
    <span className="pr-line">
      <span>{children}</span>
    </span>
  );
}

/** Kepala section: index mono + label. */
function SecLabel({ no, title }: { no: string; title: string }) {
  return (
    <div className="pr-sec-label">
      <span className="pr-idx">{no}</span>
      <span>{title}</span>
    </div>
  );
}

/* ---------------------------------------------------------- Marquee -------- */
const MARK = ["pr-l", "pr-c", "pr-o"] as const;

export function Marquee({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  const track = (rev: boolean) => (
    <div
      className={rev ? "pr-marquee pr-marquee--rev" : "pr-marquee"}
      aria-hidden
    >
      <div className="pr-marquee__track">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i}>
            {items.map((it, j) => (
              <span key={j}>
                {it} <span className={MARK[j % 3]}>✦</span>{" "}
              </span>
            ))}
            &nbsp;
          </span>
        ))}
      </div>
    </div>
  );
  // Track kedua dibalik arah → efek marquee ganda.
  return (
    <>
      {track(false)}
      {track(true)}
    </>
  );
}

/* ------------------------------------------------------------- Intro ------- */
/** Pisah judul di koma terakhir → bagian akhir jadi `<em>` (outline stroke). */
function splitHead(text: string): { pre: string; em: string | null } {
  const idx = text.lastIndexOf(",");
  if (idx > 0 && idx < text.trim().length - 1) {
    return { pre: text.slice(0, idx + 1), em: text.slice(idx + 1).trim() };
  }
  return { pre: text, em: null };
}

export function Intro({
  no,
  headText,
  lead,
  stats,
}: {
  no: string;
  headText: string;
  lead?: string;
  stats: PrismaStat[];
}) {
  const { pre, em } = splitHead(headText);
  return (
    <section className="pr-section">
      <SecLabel no={no} title={L.sec.intro} />
      <h2 className="pr-head">
        <MaskLine>{pre}</MaskLine>
        {em ? (
          <MaskLine>
            <em>{em}</em>
          </MaskLine>
        ) : null}
      </h2>
      {lead ? (
        <p className="pr-lead pr-reveal" style={{ whiteSpace: "pre-line" }}>
          {lead}
        </p>
      ) : null}
      {stats.length > 0 ? (
        <div className="pr-stats" data-n={stats.length}>
          {stats.map((s, i) => (
            <div className="pr-stat pr-reveal" key={i}>
              <div>
                <span className="pr-stat__n" data-count={s.value}>
                  {s.value}
                </span>
              </div>
              <div className="pr-stat__t">{s.label}</div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------ Rundown ------ */
export function Rundown({ no, agenda }: { no: string; agenda: StoryEntry[] }) {
  return (
    <section className="pr-section pr-section--tight">
      <SecLabel no={no} title={L.sec.rundown} />
      <div className="pr-agenda">
        {agenda.map((a, i) => (
          <div className="pr-row pr-reveal" key={i}>
            <span className="pr-row__t">{a.date || "—"}</span>
            <div className="pr-row__what">
              {a.title}
              {a.narrative ? <small>{a.narrative}</small> : null}
            </div>
            <span className="pr-row__idx">
              {String(i + 1).padStart(2, "0")}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------- Countdown + Lokasi ----- */
function LocCard({
  event,
  tz,
  slug,
}: {
  event: InvitationEventView;
  tz: TimezoneId;
  slug: string;
}) {
  const f = formatEventDateTime(event.startAt, tz);
  const maps =
    event.mapsUrl && /^https?:\/\//i.test(event.mapsUrl) ? event.mapsUrl : null;
  const gcal = googleCalendarUrl({
    id: event.id,
    title: event.name,
    startAt: event.startAt,
    endAt: event.endAt,
    venueName: event.venueName,
    address: event.address,
  });
  const icsServable = !isReservedSlug(slug) && !isDraftSlug(slug);
  const icsUrl = `/api/ics/${slug}?e=${encodeURIComponent(event.id)}`;
  return (
    <div className="pr-loc pr-reveal">
      {f ? (
        <div className="pr-loc__when">
          {f.weekday}, {f.date} · {f.time} {f.tzLabel}
        </div>
      ) : null}
      <h3>{event.venueName || event.name}</h3>
      {event.address ? <p>{event.address}</p> : null}
      <div className="pr-pills">
        {maps ? (
          <a
            className="pr-pill pr-pill--lime"
            href={maps}
            target="_blank"
            rel="noopener noreferrer"
          >
            {L.location.maps}
          </a>
        ) : null}
        {gcal ? (
          <details className="pr-cal">
            <summary className="pr-pill">{L.location.calendar}</summary>
            <div className="pr-cal__menu">
              <a
                className="pr-cal__opt"
                href={gcal}
                target="_blank"
                rel="noopener noreferrer"
              >
                {L.location.calendarGoogle}
              </a>
              {icsServable ? (
                <a
                  className="pr-cal__opt"
                  href={icsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {L.location.calendarIcs}
                </a>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}

export function EventBlock({
  no,
  showCountdown,
  countdownTarget,
  showSchedule,
  events,
  tz,
  slug,
}: {
  no: string;
  showCountdown: boolean;
  countdownTarget: string | null;
  showSchedule: boolean;
  events: InvitationEventView[];
  tz: TimezoneId;
  slug: string;
}) {
  return (
    <section className="pr-section pr-section--tight">
      <SecLabel no={no} title={L.sec.countdown} />
      {showCountdown && countdownTarget ? (
        <div className="pr-reveal">
          <Countdown targetIso={countdownTarget} labels={L.countdown} />
        </div>
      ) : null}
      {showSchedule
        ? events.map((e) => (
            <LocCard key={e.id} event={e} tz={tz} slug={slug} />
          ))
        : null}
    </section>
  );
}

/* ------------------------------------------------------------ Gallery ------ */
export function Gallery({
  no,
  media,
}: {
  no: string;
  media: InvitationMediaView[];
}) {
  return (
    <section className="pr-section pr-section--tight">
      <SecLabel no={no} title={L.sec.gallery} />
      <div className="pr-gallery__track">
        {media.map((m, i) => (
          <figure className="pr-figure" key={m.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={m.thumbUrl}
              alt=""
              loading="lazy"
              width={m.width ?? undefined}
              height={m.height ?? undefined}
            />
            <figcaption>Fig. {String(i + 1).padStart(2, "0")}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------- RSVP (tiket) ------ */
export function Rsvp({
  no,
  slug,
  eventName,
  code,
  ticketNo,
}: {
  no: string;
  slug: string;
  eventName: string;
  code: string;
  ticketNo: string;
}) {
  const parts = eventName.split(/\s+/);
  const last = parts[parts.length - 1];
  const accentTail = parts.length > 1 && /\d/.test(last);
  return (
    <section className="pr-section pr-section--tight">
      <SecLabel no={no} title={L.sec.rsvp} />
      <div className="pr-ticket pr-reveal">
        <div className="pr-ticket__top">
          <span className="pr-ticket__ev">
            {accentTail ? (
              <>
                {parts.slice(0, -1).join(" ")} <span>{last}</span>
              </>
            ) : (
              eventName
            )}
          </span>
          <span className="pr-ticket__adm">{L.rsvp.admit}</span>
        </div>

        {/* Form RSVP + dinding ucapan bersama (tidak dibuat ulang). */}
        <GuestbookSection slug={slug} />

        <div className="pr-ticket__tear" aria-hidden />
        <div className="pr-ticket__barcode" aria-hidden />
        <div className="pr-ticket__code">
          <span>{code}</span>
          <span>{L.rsvp.gate}</span>
          <span>
            {L.rsvp.ticketNo} {ticketNo}
          </span>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- Envelope ------- */
export function Envelope({
  no,
  envelope,
  slug: _slug,
}: {
  no: string;
  envelope: EnvelopeType;
  slug: string;
}) {
  return (
    <section className="pr-section pr-section--tight">
      <SecLabel no={no} title={L.sec.envelope} />
      <p className="pr-lead pr-reveal">{L.envelope.note}</p>
      {envelope.banks.map((b, i) => (
        <div className="pr-acct pr-reveal" key={`b${i}`}>
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
            className="pr-copy"
          />
        </div>
      ))}
      {envelope.ewallets.map((w, i) => (
        <div className="pr-acct pr-reveal" key={`w${i}`}>
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
            className="pr-copy"
          />
        </div>
      ))}
      {envelope.giftAddress ? (
        <div className="pr-acct pr-reveal">
          <div>
            <small>{L.envelope.giftAddress}</small>
            <p style={{ whiteSpace: "pre-line", marginTop: "0.3rem" }}>
              {envelope.giftAddress}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------ Footer ------- */
export function Footer({
  logo,
  organizer,
  picName,
  closing,
  contact,
  watermark,
}: {
  logo: string;
  organizer?: string;
  picName?: string;
  closing?: string;
  contact: string;
  watermark: boolean;
}) {
  return (
    <footer className="pr-footer">
      <div className="pr-footer__logo pr-reveal">
        {logo}
        <span>.</span>
      </div>
      {closing ? (
        <p className="pr-reveal" style={{ whiteSpace: "pre-line" }}>
          {closing}
        </p>
      ) : null}
      <p className="pr-reveal">
        {organizer ? (
          <>
            {organizer}
            <br />
          </>
        ) : null}
        {picName ? (
          <>
            {picName}
            <br />
          </>
        ) : null}
        {contact}
      </p>
      {watermark ? (
        <span className="pr-watermark pr-reveal">
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
    </footer>
  );
}

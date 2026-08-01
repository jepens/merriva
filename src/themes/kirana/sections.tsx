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
import { Countdown } from "@/themes/_shared/motion";
import type {
  InvitationEventView,
  InvitationMediaView,
} from "@/types/invitation";

import { L } from "./labels";

const PRELINE = { whiteSpace: "pre-line" as const };

/** Baris bermask (`.kr-line`) — state tersembunyi diisi JS (§0.4). */
function MaskLine({ children }: { children: ReactNode }) {
  return (
    <span className="kr-line">
      <span>{children}</span>
    </span>
  );
}

const initialOf = (s: string) => (s.trim()[0] ?? "•").toUpperCase();

/** Ukel divider — ornamen line-art yang menggambar diri saat scroll. */
function Ukel() {
  return (
    <svg className="kr-ukel kr-draw" viewBox="0 0 240 36" aria-hidden>
      <path d="M8 18 H86 M154 18 H232 M120 4 C 106 4 100 16 108 24 C 114 30 124 28 124 20 C 124 14 118 12 114 16 M120 4 C 134 4 140 16 132 24 C 126 30 116 28 116 20" />
    </svg>
  );
}

/* -------------------------------------------------------------- Hero -------- */
export function Hero({ greetingOpen }: { greetingOpen?: string }) {
  return (
    <header className="kr-section kr-center kr-hero">
      <span className="kr-eyebrow kr-reveal">{L.hero.eyebrow}</span>
      <h2 className="kr-title">
        <MaskLine>{L.hero.titleTop}</MaskLine>
        <MaskLine>
          {L.hero.titleBottom} <em>{L.hero.titleAccent}</em>
        </MaskLine>
      </h2>
      <p className="kr-lead kr-reveal" style={PRELINE}>
        {greetingOpen ?? L.hero.lead}
      </p>
      <Ukel />
    </header>
  );
}

/* -------------------------------------------------- Sekar pambuka (quote) --- */
export function SekarBlock({ quote }: { quote: Quote }) {
  return (
    <section className="kr-section kr-sekar kr-center">
      <div className="kr-truntum kr-truntum--dark" aria-hidden />
      <blockquote className="kr-sekar__text">
        <MaskLine>“{quote.text}”</MaskLine>
      </blockquote>
      {quote.source ? (
        <div className="kr-reveal">
          <cite className="kr-sekar__cite">{quote.source}</cite>
        </div>
      ) : (
        <div className="kr-reveal">
          <cite className="kr-sekar__cite">{L.sekar.caption}</cite>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------ Couple -------- */
function Keraton({
  person,
  role,
  initial,
}: {
  person: Person;
  role: string;
  initial: string;
}) {
  const parents = L.couple.parents(person.fatherName, person.motherName);
  return (
    <div className="kr-keraton kr-reveal">
      <div className="kr-keraton__inner">
        <svg
          className="kr-tr-corner kr-tr-corner--a kr-draw"
          viewBox="0 0 40 40"
          aria-hidden
        >
          <path d="M2 38 V10 C2 5 5 2 10 2 H38 M8 30 C 8 20 14 12 26 10" />
        </svg>
        <svg
          className="kr-tr-corner kr-tr-corner--b kr-draw"
          viewBox="0 0 40 40"
          aria-hidden
        >
          <path d="M2 38 V10 C2 5 5 2 10 2 H38 M8 30 C 8 20 14 12 26 10" />
        </svg>
        <div className="kr-foto-oval">
          <div className="kr-foto-oval__ph" aria-hidden>
            <span>{initial}</span>
          </div>
        </div>
        <div className="kr-keraton__role">{role}</div>
        <h3 className="kr-keraton__name">
          <MaskLine>{person.name || "—"}</MaskLine>
        </h3>
        {person.childOrder || parents ? (
          <p className="kr-keraton__meta" style={PRELINE}>
            {person.childOrder ? `${person.childOrder}\n` : ""}
            {parents}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function Couple({ groom, bride }: { groom: Person; bride: Person }) {
  return (
    <section className="kr-section">
      <div className="kr-center kr-reveal">
        <span className="kr-eyebrow">{L.couple.eyebrow}</span>
      </div>
      <div className="kr-couple">
        <Keraton
          person={bride}
          role={L.couple.bride}
          initial={initialOf(bride.nickname || bride.name || "•")}
        />
        <Keraton
          person={groom}
          role={L.couple.groom}
          initial={initialOf(groom.nickname || groom.name || "•")}
        />
      </div>
    </section>
  );
}

/* --------------------------------------------------------- Countdown ------- */
export function CountdownBlock({ targetIso }: { targetIso: string }) {
  return (
    <section className="kr-section kr-center">
      <span className="kr-eyebrow kr-reveal">{L.countdown.eyebrow}</span>
      <div className="kr-cd-frame kr-reveal">
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
    <section className="kr-section">
      <div className="kr-center kr-reveal">
        <span className="kr-eyebrow">{L.schedule.eyebrow}</span>
      </div>
      <div className="kr-tangga">
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
            <article className="kr-step" key={e.id}>
              {f ? (
                <div className="kr-step__tag kr-reveal">
                  {f.time} {f.tzLabel}
                </div>
              ) : null}
              <h3 className="kr-step__title">
                <MaskLine>{e.name}</MaskLine>
              </h3>
              <div className="kr-reveal">
                <div className="kr-step__meta">
                  {f ? (
                    <>
                      <b>
                        {f.weekday}, {f.date}
                      </b>
                      <br />
                    </>
                  ) : null}
                  {e.venueName ?? null}
                </div>
                {e.address ? (
                  <div className="kr-step__note">{e.address}</div>
                ) : null}
                {maps || gcal ? (
                  <div className="kr-pills">
                    {maps ? (
                      <a
                        className="kr-pill kr-pill--gold"
                        href={maps}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MapPin size={14} />
                        {L.schedule.maps}
                      </a>
                    ) : null}
                    {gcal ? (
                      <details className="kr-cal">
                        <summary className="kr-pill">
                          <CalendarPlus size={14} />
                          {L.schedule.calendar}
                        </summary>
                        <div className="kr-cal__menu">
                          <a
                            className="kr-cal__opt"
                            href={gcal}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {L.schedule.calendarGoogle}
                          </a>
                          {icsServable ? (
                            <a
                              className="kr-cal__opt"
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

/* ----------------------------------------------------------- Gallery ------- */
export function Gallery({ media }: { media: InvitationMediaView[] }) {
  return (
    <section className="kr-section kr-gallery-sec">
      <div className="kr-center kr-reveal">
        <span className="kr-eyebrow">{L.gallery.eyebrow}</span>
      </div>
      <div className="kr-g-track">
        {media.map((m, i) => (
          <figure className="kr-g-item" key={m.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={m.thumbUrl}
              alt=""
              loading="lazy"
              width={m.width ?? undefined}
              height={m.height ?? undefined}
            />
            <figcaption>
              {L.gallery.caption} {String(i + 1).padStart(2, "0")}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Story ------- */
export function Story({ story }: { story: StoryEntry[] }) {
  return (
    <section className="kr-section">
      <div className="kr-center kr-reveal">
        <span className="kr-eyebrow">{L.story.eyebrow}</span>
        <h2 className="kr-title kr-title--sm">{L.story.heading}</h2>
      </div>
      <div className="kr-tangga">
        {story.map((s, i) => (
          <article className="kr-step" key={i}>
            {s.date ? (
              <div className="kr-step__tag kr-reveal">{s.date}</div>
            ) : null}
            <h3 className="kr-step__title">
              <MaskLine>{s.title}</MaskLine>
            </h3>
            <div className="kr-reveal">
              <p className="kr-step__meta">{s.narrative}</p>
            </div>
          </article>
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
    <section className="kr-section kr-center">
      <span className="kr-eyebrow kr-reveal">{L.envelope.eyebrow}</span>
      <div className="kr-reveal">
        <p className="kr-lead" style={{ margin: "14px auto 0" }}>
          {L.envelope.note}
        </p>
      </div>
      <div className="kr-envelope">
        {envelope.banks.map((b, i) => (
          <div className="kr-reveal" key={`b${i}`}>
            <article className="kr-acct">
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
                className="kr-copy"
              />
            </article>
          </div>
        ))}
        {envelope.ewallets.map((w, i) => (
          <div className="kr-reveal" key={`w${i}`}>
            <article className="kr-acct">
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
                className="kr-copy"
              />
            </article>
          </div>
        ))}
        {envelope.giftAddress ? (
          <div className="kr-reveal">
            <article className="kr-acct kr-acct--addr">
              <div>
                <small>{L.envelope.giftAddress}</small>
                <p style={PRELINE}>{envelope.giftAddress}</p>
              </div>
            </article>
          </div>
        ) : null}
        <div className="kr-reveal" style={{ marginTop: "1.1rem" }}>
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
    <footer className="kr-footer kr-center">
      <svg className="kr-gn-mini" viewBox="0 0 250 300" aria-hidden>
        <path d="M125 8 C 112 30 96 42 84 62 C 70 84 76 104 66 126 C 56 150 64 172 58 196 C 52 222 66 250 92 268 C 106 278 116 284 125 292 C 134 284 144 278 158 268 C 184 250 198 222 192 196 C 186 172 194 150 184 126 C 174 104 180 84 166 62 C 154 42 138 30 125 8 Z" />
      </svg>
      <div className="kr-reveal">
        <div className="kr-footer__role">{L.footer.coupleRole}</div>
        <div className="kr-footer__mono">{L.footer.fin}</div>
      </div>
      {greetingClose ? (
        <div className="kr-reveal">
          <p className="kr-footer__msg" style={PRELINE}>
            {greetingClose}
          </p>
        </div>
      ) : null}
      {watermark ? (
        <div className="kr-reveal">
          <span className="kr-watermark">
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

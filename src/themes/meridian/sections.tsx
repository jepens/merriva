import type { ReactNode } from "react";

import { GuestbookSection } from "@/components/public/guestbook/guestbook-section";
import { googleCalendarUrl } from "@/lib/calendar";
import { formatEventDateTime } from "@/lib/datetime";
import { isDraftSlug, isReservedSlug } from "@/lib/slug";
import type {
  Envelope as EnvelopeType,
  Person,
  TimezoneId,
} from "@/lib/validation/content";
import { CopyButton } from "@/themes/_shared/copy-button";
import { Countdown } from "@/themes/_shared/motion";
import type {
  InvitationEventView,
  InvitationMediaView,
} from "@/types/invitation";

import { LightboxThumb } from "@/themes/_shared/lightbox";

import { L } from "./labels";

const PRELINE = { whiteSpace: "pre-line" as const };

/** Baris bermask (`.mrd-line`) — state tersembunyi diisi JS gsap (§0.4). */
function MaskLine({ children }: { children: ReactNode }) {
  return (
    <span className="mrd-line">
      <span>{children}</span>
    </span>
  );
}

const initialOf = (s: string) => (s.trim()[0] ?? "•").toUpperCase();

function parentsLine(person: Person): string {
  const parts = [
    person.fatherName?.trim() ? `Bapak ${person.fatherName.trim()}` : null,
    person.motherName?.trim() ? `Ibu ${person.motherName.trim()}` : null,
  ].filter(Boolean);
  const lead = person.childOrder?.trim() || "Putra/Putri";
  if (parts.length === 0) return person.childOrder?.trim() || "";
  return `${lead} dari ${parts.join(" & ")}`;
}

/* ------------------------------------------------------------- Intro ------- */
export function Intro({ greetingOpen }: { greetingOpen?: string }) {
  return (
    <section className="mrd-section mrd-intro mrd-center">
      <p className="mrd-eyebrow mrd-eyebrow--gold mrd-reveal">
        {L.intro.eyebrow}
      </p>
      <h2 className="mrd-title">
        <MaskLine>{L.intro.titleA}</MaskLine>
        <MaskLine>
          <span className="mrd-shimmer">{L.intro.titleB}</span>
        </MaskLine>
      </h2>
      <p className="mrd-lead mrd-reveal" style={PRELINE}>
        {greetingOpen || L.intro.lead}
      </p>
      <svg className="mrd-chevrons mrd-draw" viewBox="0 0 120 26" aria-hidden>
        <path d="M10 20 L30 6 L50 20 M40 20 L60 6 L80 20 M70 20 L90 6 L110 20" />
      </svg>
    </section>
  );
}

/* ------------------------------------------------------------- Couple ------ */
function Figure({
  person,
  role,
  initial,
}: {
  person: Person;
  role: string;
  initial: string;
}) {
  const meta = parentsLine(person);
  return (
    <div className="mrd-fig">
      <div className="mrd-stepped">
        <div className="mrd-stepped__ph" aria-hidden>
          <span>{initial}</span>
        </div>
      </div>
      <div className="mrd-fig__role mrd-reveal">{role}</div>
      <h3 className="mrd-fig__name">
        <MaskLine>{person.name || "—"}</MaskLine>
      </h3>
      {meta ? <p className="mrd-fig__meta mrd-reveal">{meta}</p> : null}
    </div>
  );
}

export function Couple({ bride, groom }: { bride: Person; groom: Person }) {
  return (
    <section className="mrd-section mrd-couple">
      <div className="mrd-center">
        <p className="mrd-eyebrow mrd-reveal">{L.couple.eyebrow}</p>
      </div>
      <div className="mrd-duo">
        <Figure
          person={bride}
          role={L.couple.bride}
          initial={initialOf(bride.nickname || bride.name || "•")}
        />
        <Figure
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
    <section className="mrd-section mrd-countdown mrd-center">
      <p className="mrd-eyebrow mrd-eyebrow--gold mrd-reveal">
        {L.countdown.eyebrow}
      </p>
      <div className="mrd-reveal">
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

/* --------------------------------------------------------- Programme ------- */
export function Programme({
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
    <section className="mrd-section">
      <div className="mrd-center">
        <p className="mrd-eyebrow mrd-reveal">{L.programme.eyebrow}</p>
      </div>
      <div className="mrd-prog">
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
            <article className="mrd-prog__row" key={e.id}>
              <div className="mrd-prog__rn" aria-hidden>
                {L.programme.roman(i)}.
              </div>
              <div>
                <h3 className="mrd-prog__title">
                  <MaskLine>{e.name}</MaskLine>
                </h3>
                <div className="mrd-prog__meta mrd-reveal">
                  {f ? (
                    <>
                      <b>
                        {f.weekday}, {f.date} · {f.time} {f.tzLabel}
                      </b>
                      <br />
                    </>
                  ) : null}
                  {e.venueName ? e.venueName : null}
                  {e.venueName && e.address ? <br /> : null}
                  {e.address ?? null}
                </div>
                <div className="mrd-pills mrd-reveal">
                  {maps ? (
                    <a
                      className="mrd-pill mrd-pill--gold"
                      href={maps}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {L.programme.maps}
                    </a>
                  ) : null}
                  {gcal ? (
                    <details className="mrd-cal">
                      <summary className="mrd-pill">
                        {L.programme.calendar}
                      </summary>
                      <div className="mrd-cal__menu">
                        <a
                          className="mrd-cal__opt"
                          href={gcal}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {L.programme.calendarGoogle}
                        </a>
                        {icsServable ? (
                          <a
                            className="mrd-cal__opt"
                            href={icsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {L.programme.calendarIcs}
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

/* ----------------------------------------------------------- Moments ------- */
export function Moments({ media }: { media: InvitationMediaView[] }) {
  return (
    <section className="mrd-section mrd-moments">
      <div className="mrd-center">
        <p className="mrd-eyebrow mrd-reveal">{L.gallery.eyebrow}</p>
      </div>
      <div className="mrd-gtrack" data-lb-scroll>
        {media.map((m, i) => (
          <figure className="mrd-gitem" key={m.id}>
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

/* -------------------------------------------------------------- RSVP ------- */
export function Rsvp({ slug }: { slug: string }) {
  return (
    <section className="mrd-section mrd-rsvp">
      <div className="mrd-center">
        <p className="mrd-eyebrow mrd-reveal">{L.rsvp.eyebrow}</p>
      </div>
      <div className="mrd-inner">
        <div className="mrd-rsvp__card mrd-reveal">
          <GuestbookSection slug={slug} />
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- WeddingGift ------ */
function AccountRow({
  number,
  channel,
  holder,
}: {
  number: string;
  channel: string;
  holder?: string;
}) {
  return (
    <div className="mrd-acct mrd-reveal">
      <div>
        <b>{number}</b>
        <small>
          {channel}
          {holder ? ` · ${L.gift.holder} ${holder}` : null}
        </small>
      </div>
      <CopyButton
        value={number}
        labelCopy={L.gift.copy}
        labelCopied={L.gift.copied}
        className="mrd-copy"
      />
    </div>
  );
}

export function WeddingGift({ envelope }: { envelope: EnvelopeType }) {
  return (
    <section className="mrd-section mrd-gift">
      <div className="mrd-center">
        <p className="mrd-eyebrow mrd-reveal">{L.gift.eyebrow}</p>
      </div>
      <div className="mrd-inner">
        <p className="mrd-lead mrd-reveal mrd-center">{L.gift.note}</p>
        {envelope.banks.map((b, i) => (
          <AccountRow
            key={`b${i}`}
            number={b.number}
            channel={b.bank}
            holder={b.holder}
          />
        ))}
        {envelope.ewallets.map((w, i) => (
          <AccountRow
            key={`w${i}`}
            number={w.number}
            channel={w.provider}
            holder={w.holder}
          />
        ))}
        {envelope.giftAddress ? (
          <div className="mrd-acct mrd-acct--addr mrd-reveal">
            <div>
              <small>{L.gift.address}</small>
              <p style={PRELINE}>{envelope.giftAddress}</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Footer ------- */
export function Footer({
  brideName,
  groomName,
  greetingClose,
  watermark,
}: {
  brideName: string;
  groomName: string;
  greetingClose?: string;
  watermark: boolean;
}) {
  return (
    <footer className="mrd-footer mrd-center">
      <div className="mrd-ring mrd-reveal" aria-hidden>
        <span>
          {initialOf(brideName)}·{initialOf(groomName)}
        </span>
      </div>
      {greetingClose ? (
        <p className="mrd-lead mrd-reveal" style={PRELINE}>
          {greetingClose}
        </p>
      ) : null}
      {watermark ? (
        <span className="mrd-watermark mrd-reveal">
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

import { CalendarPlus, MapPin } from "lucide-react";

import { GiftConfirm } from "@/components/public/guestbook/gift-confirm";
import { googleCalendarUrl } from "@/lib/calendar";
import { formatEventDateTime } from "@/lib/datetime";
import { isDraftSlug, isReservedSlug } from "@/lib/slug";
import { CopyButton } from "@/themes/_shared/copy-button";
import { Countdown, Reveal } from "@/themes/_shared/motion";
import type {
  Envelope as EnvelopeType,
  StoryEntry,
  TimezoneId,
} from "@/lib/validation/content";
import type {
  InvitationEventView,
  InvitationMediaView,
} from "@/types/invitation";

import { L } from "./labels";

const PRELINE = { whiteSpace: "pre-line" as const };

const initialOf = (s: string) => (s.trim()[0] ?? "✦").toUpperCase();

/* ------------------------------------------------------------ Marquee ------ */
export function Marquee({ text }: { text: string }) {
  return (
    <div className="ft-marquee" aria-hidden>
      <div className="ft-marquee__track">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i}>{text}&nbsp;</span>
        ))}
      </div>
    </div>
  );
}

/** Pembatas scallop (murni CSS). */
export function Scallop({ teal = false }: { teal?: boolean }) {
  return (
    <div
      className={teal ? "ft-scallop ft-scallop--teal" : "ft-scallop"}
      aria-hidden
    />
  );
}

/* ------------------------------------------------------------ Opening ------ */
export function Opening({
  celebrant,
  parents,
  greetingOpen,
  quote,
}: {
  celebrant?: string;
  parents?: string;
  greetingOpen?: string;
  quote?: { text: string; source?: string };
}) {
  return (
    <section className="ft-section ft-center">
      <div className="ft-inner">
        <Reveal>
          <p className="ft-eyebrow">{L.intro.eyebrow}</p>
        </Reveal>
        {greetingOpen ? (
          <Reveal>
            <p className="ft-lead" style={PRELINE}>
              {greetingOpen}
            </p>
          </Reveal>
        ) : null}
        {celebrant ? (
          <Reveal className="ft-pop">
            <figure className="ft-polaroid">
              <span className="ft-polaroid__tape" aria-hidden />
              <div className="ft-polaroid__ph" aria-hidden>
                <span>{initialOf(celebrant)}</span>
              </div>
              <figcaption>{celebrant}</figcaption>
            </figure>
          </Reveal>
        ) : null}
        <Reveal>
          <div className="ft-kid">
            {celebrant ? <h3 className="ft-kid__name">{celebrant}</h3> : null}
            {parents ? (
              <p className="ft-kid__parents">
                {L.celebrant.parents} <b>{parents}</b>
              </p>
            ) : null}
          </div>
        </Reveal>
        {quote?.text ? (
          <Reveal>
            <blockquote className="ft-quote">
              “{quote.text}”
              {quote.source ? (
                <cite className="ft-quote__src">— {quote.source}</cite>
              ) : null}
            </blockquote>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- Countdown ------ */
export function CountdownBlock({ targetIso }: { targetIso: string }) {
  return (
    <section className="ft-section ft-center" style={{ paddingTop: 0 }}>
      <div className="ft-inner">
        <Reveal>
          <p className="ft-eyebrow">{L.countdown.eyebrow}</p>
        </Reveal>
        <Reveal>
          <Countdown targetIso={targetIso} labels={L.countdown} />
        </Reveal>
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
    <section className="ft-section" style={{ paddingTop: 0 }}>
      <div className="ft-inner">
        <Reveal>
          <p className="ft-eyebrow ft-center">{L.schedule.eyebrow}</p>
        </Reveal>
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
              <article className="ft-event">
                {f ? (
                  <div className="ft-event__day">
                    {f.weekday},<br />
                    {f.date}
                  </div>
                ) : null}
                <div className="ft-event__meta">
                  {f ? (
                    <>
                      <b>
                        Pukul {f.time} {f.tzLabel}
                      </b>
                      <br />
                    </>
                  ) : null}
                  <b>{e.name}</b>
                  <br />
                  {e.venueName ? (
                    <>
                      {e.venueName}
                      <br />
                    </>
                  ) : null}
                  {e.address ?? null}
                </div>
                <div className="ft-pills">
                  {maps ? (
                    <a
                      className="ft-pill ft-pill--teal"
                      href={maps}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MapPin size={15} />
                      {L.schedule.maps}
                    </a>
                  ) : null}
                  {gcal ? (
                    <details className="ft-cal">
                      <summary className="ft-pill">
                        <CalendarPlus size={15} />
                        {L.schedule.calendar}
                      </summary>
                      <div className="ft-cal__menu">
                        <a
                          className="ft-cal__opt"
                          href={gcal}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {L.schedule.calendarGoogle}
                        </a>
                        {icsServable ? (
                          <a
                            className="ft-cal__opt"
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
    </section>
  );
}

/* ----------------------------------------------------------- Gallery ------- */
export function Gallery({ media }: { media: InvitationMediaView[] }) {
  return (
    <section className="ft-section ft-center" style={{ paddingInline: 0 }}>
      <Reveal>
        <p className="ft-eyebrow">{L.gallery.eyebrow}</p>
      </Reveal>
      <div className="ft-gallery">
        {media.map((m) => (
          <figure className="ft-gallery__item" key={m.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={m.thumbUrl}
              alt=""
              loading="lazy"
              width={m.width ?? undefined}
              height={m.height ?? undefined}
            />
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Wishes ------- */
export function Wishes({ wishes }: { wishes: StoryEntry[] }) {
  return (
    <section className="ft-section" style={{ paddingTop: "20px" }}>
      <div className="ft-inner">
        <Reveal>
          <p className="ft-eyebrow ft-center">{L.wishes.eyebrow}</p>
        </Reveal>
        <div className="ft-stack">
          {wishes.map((w, i) => (
            <Reveal key={i} delay={i * 70}>
              <article className="ft-wish">
                <span className="ft-wish__ava" aria-hidden>
                  {initialOf(w.title)}
                </span>
                <div>
                  <b>{w.title}</b>
                  {w.date ? (
                    <span className="ft-wish__from">{w.date}</span>
                  ) : null}
                  <p style={PRELINE}>{w.narrative}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
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
    <section className="ft-section" style={{ paddingTop: 0 }}>
      <div className="ft-inner">
        <Reveal>
          <p className="ft-eyebrow ft-center">{L.envelope.eyebrow}</p>
          <p className="ft-lead ft-center">{L.envelope.note}</p>
        </Reveal>
        <div className="ft-stack">
          {envelope.banks.map((b, i) => (
            <Reveal key={`b${i}`}>
              <article className="ft-acct">
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
                  className="ft-copy"
                />
              </article>
            </Reveal>
          ))}
          {envelope.ewallets.map((w, i) => (
            <Reveal key={`w${i}`}>
              <article className="ft-acct">
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
                  className="ft-copy"
                />
              </article>
            </Reveal>
          ))}
          {envelope.giftAddress ? (
            <Reveal>
              <article className="ft-acct ft-acct--addr">
                <div>
                  <small>{L.envelope.giftAddress}</small>
                  <p style={{ ...PRELINE, marginTop: "0.3rem" }}>
                    {envelope.giftAddress}
                  </p>
                </div>
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

/* ------------------------------------------------------------ Footer ------- */
export function Footer({
  greetingClose,
  watermark,
}: {
  greetingClose?: string;
  watermark: boolean;
}) {
  return (
    <footer className="ft-footer ft-center">
      <div className="ft-inner">
        <Reveal>
          <div className="ft-footer__big">{L.footer.thanks}</div>
          {greetingClose ? (
            <p className="ft-footer__note" style={PRELINE}>
              {greetingClose}
            </p>
          ) : null}
          {watermark ? (
            <span className="ft-watermark">
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
        </Reveal>
      </div>
    </footer>
  );
}

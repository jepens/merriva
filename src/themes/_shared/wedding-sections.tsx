import { Calendar, CalendarPlus, Clock, MapPin } from "lucide-react";

import { GiftConfirm } from "@/components/public/guestbook/gift-confirm";
import { googleCalendarUrl } from "@/lib/calendar";
import { formatEventDateTime } from "@/lib/datetime";
import { isDraftSlug, isReservedSlug } from "@/lib/slug";
import { CopyButton } from "@/themes/_shared/copy-button";
import { Countdown, Reveal } from "@/themes/_shared/motion";
import type {
  Envelope as EnvelopeType,
  Person,
  StoryEntry,
  TimezoneId,
} from "@/lib/validation/content";
import type {
  InvitationEventView,
  InvitationMediaView,
} from "@/types/invitation";

/**
 * Set section BERSAMA untuk tema kategori WEDDING (4 skin M4.2 memakainya:
 * barakah/minimal/botanical/luxe). Struktur + logika di sini; tiap tema membawa
 * IDENTITAS lewat CSS (palet, tipografi, ornamen, ritme) di bawah kelas akarnya.
 * Kelas memakai prefix `cx` (mis. "bk") → `.bk-hero`, `.bk-divider`… Ornamen
 * pembatas diisi CSS tema (`.<cx>-divider::before { content: "۞" }`).
 *
 * eternal-rose (M1.5) TIDAK memakai modul ini — punya section sendiri.
 */

const PRELINE = { whiteSpace: "pre-line" as const };

export interface WeddingLabels {
  hero: { eyebrow: string; scroll: string };
  countdown: {
    eyebrow: string;
    done: string;
    days: string;
    hours: string;
    minutes: string;
    seconds: string;
  };
  couple: {
    eyebrow: string;
    groom: string;
    bride: string;
    parents: (father?: string, mother?: string) => string;
  };
  schedule: {
    eyebrow: string;
    heading: string;
    maps: string;
    calendar: string;
    calendarGoogle: string;
    calendarIcs: string;
  };
  gallery: { eyebrow: string; heading: string };
  story: { eyebrow: string; heading: string };
  envelope: {
    eyebrow: string;
    heading: string;
    note: string;
    copy: string;
    copied: string;
    giftAddress: string;
    holder: string;
  };
  footer: { thanks: string; by: string; brand: string };
}

interface Base {
  cx: string;
  labels: WeddingLabels;
}

function Divider({ cx }: { cx: string }) {
  return <div className={`${cx}-divider`} aria-hidden />;
}

/* -------------------------------------------------------------- Hero ------ */
export function Hero({
  cx,
  labels,
  groomName,
  brideName,
  dateLabel,
  bgUrl,
}: Base & {
  groomName: string;
  brideName: string;
  dateLabel: string | null;
  bgUrl?: string;
}) {
  return (
    <header className={bgUrl ? `${cx}-hero` : `${cx}-hero ${cx}-hero--plain`}>
      {bgUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={`${cx}-hero__bg`}
            src={bgUrl}
            alt=""
            aria-hidden
            fetchPriority="high"
            decoding="async"
          />
          <div className={`${cx}-hero__scrim`} aria-hidden />
        </>
      ) : null}
      <div className={`${cx}-hero__inner`}>
        <span className={`${cx}-hero__crest`} aria-hidden />
        <p className={`${cx}-eyebrow ${cx}-eyebrow--hero`}>
          {labels.hero.eyebrow}
        </p>
        <h1 className={`${cx}-hero__names`}>
          <span className={`${cx}-hero__name`}>{groomName}</span>
          <span className={`${cx}-hero__amp`} aria-hidden>
            &amp;
          </span>
          <span className={`${cx}-hero__name`}>{brideName}</span>
        </h1>
        {dateLabel ? <p className={`${cx}-hero__date`}>{dateLabel}</p> : null}
      </div>
      <span className={`${cx}-hero__scroll`} aria-hidden>
        {labels.hero.scroll}
      </span>
    </header>
  );
}

/* ------------------------------------------------------------- Quote ------ */
export function QuoteBlock({
  cx,
  greetingOpen,
  quote,
}: {
  cx: string;
  greetingOpen?: string;
  quote?: { text: string; source?: string };
}) {
  return (
    <section className={`${cx}-section`}>
      <div className={`${cx}-inner`}>
        <Reveal>
          {greetingOpen ? (
            <p
              className={`${cx}-lead`}
              style={{ ...PRELINE, marginBottom: quote ? "1.75rem" : 0 }}
            >
              {greetingOpen}
            </p>
          ) : null}
          {quote ? (
            <>
              <Divider cx={cx} />
              <p className={`${cx}-lead ${cx}-lead--quote`}>“{quote.text}”</p>
              {quote.source ? (
                <p className={`${cx}-eyebrow ${cx}-quote__src`}>
                  {quote.source}
                </p>
              ) : null}
            </>
          ) : null}
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Couple ------ */
function PersonCard({
  cx,
  labels,
  person,
  role,
}: Base & { person: Person; role: string }) {
  const initial = (person.nickname || person.name || "•")
    .trim()
    .charAt(0)
    .toUpperCase();
  const parents = labels.couple.parents(person.fatherName, person.motherName);
  return (
    <div className={`${cx}-person`}>
      <div className={`${cx}-person__mono`} aria-hidden>
        {initial}
      </div>
      <p className={`${cx}-eyebrow`}>{role}</p>
      <h3 className={`${cx}-person__name`}>{person.name || "—"}</h3>
      {person.childOrder ? (
        <p className={`${cx}-person__meta`}>{person.childOrder}</p>
      ) : null}
      {parents ? <p className={`${cx}-person__meta`}>{parents}</p> : null}
    </div>
  );
}

export function Couple({
  cx,
  labels,
  groom,
  bride,
}: Base & { groom: Person; bride: Person }) {
  return (
    <section className={`${cx}-section ${cx}-section--tint`}>
      <div className={`${cx}-inner`}>
        <Reveal>
          <h2 className={`${cx}-eyebrow ${cx}-eyebrow--center`}>
            {labels.couple.eyebrow}
          </h2>
          <Divider cx={cx} />
        </Reveal>
        <div className={`${cx}-couple`}>
          <Reveal>
            <PersonCard
              cx={cx}
              labels={labels}
              person={groom}
              role={labels.couple.groom}
            />
          </Reveal>
          <div className={`${cx}-couple__amp`} aria-hidden>
            &amp;
          </div>
          <Reveal delay={120}>
            <PersonCard
              cx={cx}
              labels={labels}
              person={bride}
              role={labels.couple.bride}
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- Countdown ------ */
export function CountdownBlock({
  cx,
  labels,
  targetIso,
}: Base & { targetIso: string }) {
  return (
    <section className={`${cx}-section`}>
      <div className={`${cx}-inner`}>
        <Reveal>
          <p className={`${cx}-eyebrow ${cx}-eyebrow--center`}>
            {labels.countdown.eyebrow}
          </p>
        </Reveal>
        <Reveal>
          <Countdown targetIso={targetIso} labels={labels.countdown} />
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- Schedule ------ */
export function Schedule({
  cx,
  labels,
  events,
  tz,
  slug,
}: Base & {
  events: InvitationEventView[];
  tz: TimezoneId;
  slug: string;
}) {
  const icsServable = !isReservedSlug(slug) && !isDraftSlug(slug);
  return (
    <section className={`${cx}-section`}>
      <div className={`${cx}-inner`}>
        <Reveal>
          <p className={`${cx}-eyebrow ${cx}-eyebrow--center`}>
            {labels.schedule.eyebrow}
          </p>
          <h2 className={`${cx}-h2`}>{labels.schedule.heading}</h2>
        </Reveal>
        <div className={`${cx}-stack`}>
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
                <article className={`${cx}-card`}>
                  <h3 className={`${cx}-card__title`}>{e.name}</h3>
                  {f ? (
                    <>
                      <p className={`${cx}-card__row`}>
                        <Calendar size={16} />
                        {f.weekday}, {f.date}
                      </p>
                      <p className={`${cx}-card__row`}>
                        <Clock size={16} />
                        {f.time} {f.tzLabel}
                      </p>
                    </>
                  ) : null}
                  {e.venueName ? (
                    <p className={`${cx}-card__row`}>
                      <MapPin size={16} />
                      {e.venueName}
                    </p>
                  ) : null}
                  {e.address ? (
                    <p className={`${cx}-person__meta`}>{e.address}</p>
                  ) : null}
                  <div className={`${cx}-card__actions`}>
                    {maps ? (
                      <a
                        className={`${cx}-btn`}
                        href={maps}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MapPin size={15} />
                        {labels.schedule.maps}
                      </a>
                    ) : null}
                    {gcal ? (
                      <details className={`${cx}-cal`}>
                        <summary className={`${cx}-btn ${cx}-cal__trigger`}>
                          <CalendarPlus size={15} />
                          {labels.schedule.calendar}
                        </summary>
                        <div className={`${cx}-cal__menu`}>
                          <a
                            className={`${cx}-cal__opt`}
                            href={gcal}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {labels.schedule.calendarGoogle}
                          </a>
                          {icsServable ? (
                            <a
                              className={`${cx}-cal__opt`}
                              href={icsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {labels.schedule.calendarIcs}
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
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- Gallery ------ */
export function Gallery({
  cx,
  labels,
  media,
}: Base & { media: InvitationMediaView[] }) {
  return (
    <section className={`${cx}-section ${cx}-section--tint`}>
      <div className={`${cx}-inner`}>
        <Reveal>
          <p className={`${cx}-eyebrow ${cx}-eyebrow--center`}>
            {labels.gallery.eyebrow}
          </p>
          <h2 className={`${cx}-h2`}>{labels.gallery.heading}</h2>
        </Reveal>
        <Reveal>
          <div className={`${cx}-gallery`}>
            {media.map((m) => (
              <div key={m.id} className={`${cx}-gallery__item`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.thumbUrl}
                  alt=""
                  loading="lazy"
                  width={m.width ?? undefined}
                  height={m.height ?? undefined}
                />
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Story ------ */
export function Story({ cx, labels, story }: Base & { story: StoryEntry[] }) {
  return (
    <section className={`${cx}-section`}>
      <div className={`${cx}-inner`}>
        <Reveal>
          <p className={`${cx}-eyebrow ${cx}-eyebrow--center`}>
            {labels.story.eyebrow}
          </p>
          <h2 className={`${cx}-h2`}>{labels.story.heading}</h2>
        </Reveal>
        <div className={`${cx}-timeline`}>
          {story.map((s, i) => (
            <Reveal key={i} delay={i * 70}>
              <div className={`${cx}-story`}>
                {s.date ? (
                  <p className={`${cx}-story__date`}>{s.date}</p>
                ) : null}
                <h3 className={`${cx}-story__title`}>{s.title}</h3>
                <p className={`${cx}-story__body`} style={PRELINE}>
                  {s.narrative}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- Envelope ------ */
export function Envelope({
  cx,
  labels,
  envelope,
  slug,
}: Base & { envelope: EnvelopeType; slug: string }) {
  return (
    <section className={`${cx}-section ${cx}-section--tint`}>
      <div className={`${cx}-inner`}>
        <Reveal>
          <p className={`${cx}-eyebrow ${cx}-eyebrow--center`}>
            {labels.envelope.eyebrow}
          </p>
          <h2 className={`${cx}-h2`}>{labels.envelope.heading}</h2>
          <p className={`${cx}-lead`} style={{ marginBottom: "2rem" }}>
            {labels.envelope.note}
          </p>
        </Reveal>
        <div className={`${cx}-stack`}>
          {envelope.banks.map((b, i) => (
            <Reveal key={`b${i}`}>
              <article className={`${cx}-card`}>
                <p className={`${cx}-account__label`}>{b.bank}</p>
                <p className={`${cx}-account__num`}>{b.number}</p>
                <p className={`${cx}-person__meta`}>
                  {labels.envelope.holder} {b.holder}
                </p>
                <CopyButton
                  value={b.number}
                  labelCopy={labels.envelope.copy}
                  labelCopied={labels.envelope.copied}
                  className={`${cx}-btn ${cx}-btn--solid`}
                />
              </article>
            </Reveal>
          ))}
          {envelope.ewallets.map((w, i) => (
            <Reveal key={`w${i}`}>
              <article className={`${cx}-card`}>
                <p className={`${cx}-account__label`}>{w.provider}</p>
                <p className={`${cx}-account__num`}>{w.number}</p>
                {w.holder ? (
                  <p className={`${cx}-person__meta`}>
                    {labels.envelope.holder} {w.holder}
                  </p>
                ) : null}
                <CopyButton
                  value={w.number}
                  labelCopy={labels.envelope.copy}
                  labelCopied={labels.envelope.copied}
                  className={`${cx}-btn ${cx}-btn--solid`}
                />
              </article>
            </Reveal>
          ))}
          {envelope.giftAddress ? (
            <Reveal>
              <article className={`${cx}-card`}>
                <p className={`${cx}-account__label`}>
                  {labels.envelope.giftAddress}
                </p>
                <p
                  className={`${cx}-person__meta`}
                  style={{ ...PRELINE, marginTop: "0.4rem" }}
                >
                  {envelope.giftAddress}
                </p>
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

/* ------------------------------------------------------------ Footer ------ */
export function Footer({
  cx,
  labels,
  greetingClose,
  groomName,
  brideName,
  watermark,
}: Base & {
  greetingClose?: string;
  groomName: string;
  brideName: string;
  watermark: boolean;
}) {
  return (
    <footer className={`${cx}-footer`}>
      <div className={`${cx}-inner`}>
        <Reveal>
          {greetingClose ? (
            <p
              className={`${cx}-lead`}
              style={{ ...PRELINE, marginBottom: "2rem" }}
            >
              {greetingClose}
            </p>
          ) : null}
          <Divider cx={cx} />
          <p className={`${cx}-footer__thanks`}>{labels.footer.thanks}</p>
          <p className={`${cx}-footer__names`}>
            {groomName} &amp; {brideName}
          </p>
          {watermark ? (
            <p className={`${cx}-watermark`}>
              {labels.footer.by}{" "}
              <a
                href="https://merriva.id"
                target="_blank"
                rel="noopener noreferrer"
              >
                {labels.footer.brand}
              </a>
            </p>
          ) : null}
        </Reveal>
      </div>
    </footer>
  );
}

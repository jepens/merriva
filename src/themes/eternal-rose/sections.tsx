import { Calendar, CalendarPlus, Clock, MapPin } from "lucide-react";

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
import type {
  InvitationEventView,
  InvitationMediaView,
} from "@/types/invitation";

import { Countdown } from "./countdown";
import { CopyButton } from "./copy-button";
import { L } from "./labels";
import { Reveal } from "./reveal";

const PRELINE = { whiteSpace: "pre-line" as const };

/* -------------------------------------------------------------- Hero ------ */
export function Hero({
  groomName,
  brideName,
  dateLabel,
  bgUrl,
}: {
  groomName: string;
  brideName: string;
  dateLabel: string | null;
  bgUrl?: string;
}) {
  return (
    <header className={bgUrl ? "er-hero" : "er-hero er-hero--plain"}>
      {bgUrl ? (
        <>
          {/* Eager <img> (bukan CSS background) → LCP ter-preload saat parse HTML,
              dan menghindari interpolasi nilai ke string CSS url("…"). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="er-hero__bg"
            src={bgUrl}
            alt=""
            aria-hidden
            fetchPriority="high"
            decoding="async"
          />
          <div className="er-hero__scrim" aria-hidden />
        </>
      ) : null}
      <div className="er-hero__inner">
        <p className="er-eyebrow">{L.hero.eyebrow}</p>
        <h1 className="er-hero__names er-script">
          {groomName}
          <span className="er-hero__amp">&amp;</span>
          {brideName}
        </h1>
        {dateLabel ? <p className="er-hero__date">{dateLabel}</p> : null}
      </div>
      <span className="er-hero__scroll" aria-hidden>
        {L.hero.scroll}
      </span>
    </header>
  );
}

/* ------------------------------------------------------------- Quote ------ */
export function QuoteBlock({
  greetingOpen,
  quote,
}: {
  greetingOpen?: string;
  quote?: { text: string; source?: string };
}) {
  return (
    <section className="er-section">
      <Reveal>
        {greetingOpen ? (
          <p
            className="er-lead"
            style={{ ...PRELINE, marginBottom: quote ? "1.75rem" : 0 }}
          >
            {greetingOpen}
          </p>
        ) : null}
        {quote ? (
          <>
            <div className="er-divider" aria-hidden>
              ❦
            </div>
            <p className="er-lead" style={{ fontStyle: "italic" }}>
              “{quote.text}”
            </p>
            {quote.source ? (
              <p className="er-eyebrow" style={{ marginTop: "0.75rem" }}>
                {quote.source}
              </p>
            ) : null}
          </>
        ) : null}
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------ Couple ------ */
function PersonCard({ person, role }: { person: Person; role: string }) {
  const initial = (person.nickname || person.name || "•")
    .trim()
    .charAt(0)
    .toUpperCase();
  const parents = L.couple.parents(person.fatherName, person.motherName);
  return (
    <div>
      <div className="er-person__mono er-script" aria-hidden>
        {initial}
      </div>
      <p className="er-eyebrow">{role}</p>
      <h3 className="er-person__name">{person.name || "—"}</h3>
      {person.childOrder ? (
        <p className="er-person__meta">{person.childOrder}</p>
      ) : null}
      {parents ? <p className="er-person__meta">{parents}</p> : null}
    </div>
  );
}

export function Couple({ groom, bride }: { groom: Person; bride: Person }) {
  return (
    <section className="er-section er-section--tint">
      <div className="er-inner">
        <Reveal>
          <h2 className="er-eyebrow">{L.couple.eyebrow}</h2>
          <div className="er-divider" aria-hidden>
            ❦
          </div>
        </Reveal>
        <div className="er-couple">
          <Reveal>
            <PersonCard person={groom} role={L.couple.groom} />
          </Reveal>
          <div className="er-amp-lg er-script" aria-hidden>
            &amp;
          </div>
          <Reveal delay={120}>
            <PersonCard person={bride} role={L.couple.bride} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- Countdown ------ */
export function CountdownBlock({ targetIso }: { targetIso: string }) {
  return (
    <section className="er-section">
      <Reveal>
        <p className="er-eyebrow">{L.countdown.eyebrow}</p>
      </Reveal>
      <Reveal>
        <Countdown targetIso={targetIso} />
      </Reveal>
    </section>
  );
}

/* ---------------------------------------------------------- Schedule ------ */
export function Schedule({
  events,
  tz,
  slug,
}: {
  events: InvitationEventView[];
  tz: TimezoneId;
  slug: string;
}) {
  // Berkas .ics hanya dilayani route untuk undangan AKTIF & slug publik. Pada
  // showcase demo (slug "demo" = reserved) dan pratinjau draft (slug "draft-…")
  // tautan itu 404 → sembunyikan opsi Apple/Outlook di situ (Google tetap jalan,
  // tak butuh server). Halaman publik nyata tak pernah reserved/draft → tampil.
  const icsServable = !isReservedSlug(slug) && !isDraftSlug(slug);
  return (
    <section className="er-section">
      <Reveal>
        <p className="er-eyebrow">{L.schedule.eyebrow}</p>
        <h2 className="er-h2">{L.schedule.heading}</h2>
      </Reveal>
      <div className="er-stack">
        {events.map((e, i) => {
          const f = formatEventDateTime(e.startAt, tz);
          // Hanya izinkan http(s) sebagai href (cegah `javascript:` XSS —
          // mapsUrl draft belum tervalidasi format).
          const maps =
            e.mapsUrl && /^https?:\/\//i.test(e.mapsUrl) ? e.mapsUrl : null;
          // Aksi kalender (SPEC §4.5). Google = tautan render langsung; .ics =
          // route handler (jalur Apple/Outlook). Keduanya dirakit saat render
          // statis (tanpa JS klien) → ramah WebView & ISR. Tampil hanya bila
          // waktu mulai valid (googleUrl non-null).
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
              <article className="er-card">
                <h3 className="er-card__title">{e.name}</h3>
                {f ? (
                  <>
                    <p className="er-card__row">
                      <Calendar size={16} />
                      {f.weekday}, {f.date}
                    </p>
                    <p className="er-card__row">
                      <Clock size={16} />
                      {f.time} {f.tzLabel}
                    </p>
                  </>
                ) : null}
                {e.venueName ? (
                  <p className="er-card__row">
                    <MapPin size={16} />
                    {e.venueName}
                  </p>
                ) : null}
                {e.address ? (
                  <p className="er-person__meta">{e.address}</p>
                ) : null}
                <div className="er-card__actions">
                  {maps ? (
                    <a
                      className="er-btn"
                      href={maps}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MapPin size={15} />
                      {L.schedule.maps}
                    </a>
                  ) : null}
                  {gcal ? (
                    <details className="er-cal">
                      <summary className="er-btn er-cal__trigger">
                        <CalendarPlus size={15} />
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
                          // target=_blank memberi WebView (WKWebView iOS) jalan
                          // menyerahkan unduhan .ics ke browser sistem; aman utk
                          // Android (Content-Disposition tetap memicu unduhan).
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
              </article>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- Gallery ------ */
export function Gallery({ media }: { media: InvitationMediaView[] }) {
  return (
    <section className="er-section er-section--tint">
      <div className="er-inner">
        <Reveal>
          <p className="er-eyebrow">{L.gallery.eyebrow}</p>
          <h2 className="er-h2">{L.gallery.heading}</h2>
        </Reveal>
        <Reveal>
          <div className="er-gallery">
            {media.map((m) => (
              <div key={m.id} className="er-gallery__item">
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
export function Story({ story }: { story: StoryEntry[] }) {
  return (
    <section className="er-section">
      <Reveal>
        <p className="er-eyebrow">{L.story.eyebrow}</p>
        <h2 className="er-h2">{L.story.heading}</h2>
      </Reveal>
      <div className="er-timeline">
        {story.map((s, i) => (
          <Reveal key={i} delay={i * 70}>
            <div className="er-story">
              {s.date ? <p className="er-story__date">{s.date}</p> : null}
              <h3 className="er-story__title">{s.title}</h3>
              <p className="er-story__body">{s.narrative}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- Envelope ------ */
export function Envelope({
  envelope,
  slug,
}: {
  envelope: EnvelopeType;
  slug: string;
}) {
  return (
    <section className="er-section er-section--tint">
      <div className="er-inner">
        <Reveal>
          <p className="er-eyebrow">{L.envelope.eyebrow}</p>
          <h2 className="er-h2">{L.envelope.heading}</h2>
          <p className="er-lead" style={{ marginBottom: "2rem" }}>
            {L.envelope.note}
          </p>
        </Reveal>
        <div className="er-stack">
          {envelope.banks.map((b, i) => (
            <Reveal key={`b${i}`}>
              <article className="er-card">
                <p className="er-account__label">{b.bank}</p>
                <p className="er-account__num">{b.number}</p>
                <p className="er-person__meta">
                  {L.envelope.holder} {b.holder}
                </p>
                <CopyButton value={b.number} />
              </article>
            </Reveal>
          ))}
          {envelope.ewallets.map((w, i) => (
            <Reveal key={`w${i}`}>
              <article className="er-card">
                <p className="er-account__label">{w.provider}</p>
                <p className="er-account__num">{w.number}</p>
                {w.holder ? (
                  <p className="er-person__meta">
                    {L.envelope.holder} {w.holder}
                  </p>
                ) : null}
                <CopyButton value={w.number} />
              </article>
            </Reveal>
          ))}
          {envelope.giftAddress ? (
            <Reveal>
              <article className="er-card">
                <p className="er-account__label">{L.envelope.giftAddress}</p>
                <p
                  className="er-person__meta"
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
  greetingClose,
  groomName,
  brideName,
  watermark,
}: {
  greetingClose?: string;
  groomName: string;
  brideName: string;
  watermark: boolean;
}) {
  return (
    <footer className="er-footer">
      <Reveal>
        {greetingClose ? (
          <p className="er-lead" style={{ ...PRELINE, marginBottom: "2rem" }}>
            {greetingClose}
          </p>
        ) : null}
        <p className="er-footer__thanks er-script">{L.footer.thanks}</p>
        <p className="er-eyebrow" style={{ marginTop: "1rem" }}>
          {groomName} &amp; {brideName}
        </p>
        {watermark ? (
          <p className="er-watermark">
            {L.footer.by}{" "}
            <a
              href="https://merriva.id"
              target="_blank"
              rel="noopener noreferrer"
            >
              {L.footer.brand}
            </a>
          </p>
        ) : null}
      </Reveal>
    </footer>
  );
}

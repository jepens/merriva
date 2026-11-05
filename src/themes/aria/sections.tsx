import { GuestbookSection } from "@/components/public/guestbook/guestbook-section";
import { GiftConfirm } from "@/components/public/guestbook/gift-confirm";
import { googleCalendarUrl } from "@/lib/calendar";
import { formatEventDateTime } from "@/lib/datetime";
import { isDraftSlug, isReservedSlug } from "@/lib/slug";
import { CopyButton } from "@/themes/_shared/copy-button";
import { fotoStyle } from "@/themes/_shared/foto";
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
  PhotoView,
} from "@/types/invitation";

import { LightboxThumb } from "@/themes/_shared/lightbox";
import { copy } from "@/lib/copy";
import { ThemeVideo, type VideoView } from "@/themes/_shared/video";

import { L } from "./labels";

const PRELINE = { whiteSpace: "pre-line" as const };

/** Kepala section bernomor (angka italic merah + label). */
function SecHead({ no, title }: { no: string; title: string }) {
  return (
    <Reveal>
      <div className="ar-sec-head">
        <span className="ar-sec-head__num">{no}</span>
        <span className="ar-sec-head__t">{title}</span>
      </div>
    </Reveal>
  );
}

/* ------------------------------------------------------------ Opening ------ */
export function Opening({
  no,
  greetingOpen,
  quote,
}: {
  no: string;
  greetingOpen?: string;
  quote?: { text: string; source?: string };
}) {
  return (
    <section className="ar-section">
      <SecHead no={no} title={L.sec.opening} />
      {greetingOpen ? (
        <Reveal>
          <p className="ar-big" style={PRELINE}>
            {greetingOpen}
          </p>
        </Reveal>
      ) : null}
      {quote?.text ? (
        <Reveal>
          <p className="ar-body">
            “{quote.text}”
            {quote.source ? (
              <span className="ar-cite"> — {quote.source}</span>
            ) : null}
          </p>
        </Reveal>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------- Couple ------ */
const initialOf = (s: string) => (s.trim()[0] ?? "•").toUpperCase();

function CoupleOne({
  person,
  photo,
}: {
  person: Person;
  photo?: PhotoView | null;
}) {
  const parents = L.couple.parents(person.fatherName, person.motherName);
  return (
    <div className="ar-couple__one">
      {/* Dekoratif: namanya sudah tercetak besar persis di bawahnya, jadi foto
          ini tak menambah informasi bagi pembaca layar. */}
      <div className="ar-couple__ph" aria-hidden>
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
      <div className="ar-couple__name">{person.name || "—"}</div>
      {person.childOrder ? (
        <p className="ar-body ar-body--tight">{person.childOrder}</p>
      ) : null}
      {parents ? <p className="ar-body ar-body--tight">{parents}</p> : null}
    </div>
  );
}

export function Couple({
  no,
  groom,
  bride,
  groomPhoto,
  bridePhoto,
}: {
  no: string;
  groom: Person;
  bride: Person;
  groomPhoto?: PhotoView | null;
  bridePhoto?: PhotoView | null;
}) {
  return (
    <section className="ar-section">
      <SecHead no={no} title={L.sec.couple} />
      <Reveal>
        <div className="ar-couple">
          <CoupleOne person={groom} photo={groomPhoto} />
          <div className="ar-couple__amp">&amp;</div>
          <CoupleOne person={bride} photo={bridePhoto} />
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------- Event ------- */
export function EventBlock({
  no,
  events,
  tz,
  slug,
  countdownTarget,
}: {
  no: string;
  events: InvitationEventView[];
  tz: TimezoneId;
  slug: string;
  countdownTarget: string | null;
}) {
  const icsServable = !isReservedSlug(slug) && !isDraftSlug(slug);
  return (
    <section className="ar-section">
      <SecHead no={no} title={L.sec.event} />
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
          <Reveal key={e.id}>
            <div className="ar-event">
              {f ? <div className="ar-when">{f.date}</div> : null}
              <div className="ar-event__name">{e.name}</div>
              <dl className="ar-kv">
                {f ? (
                  <>
                    <dt>{L.event.time}</dt>
                    <dd>
                      {f.weekday} · {f.time} {f.tzLabel}
                    </dd>
                  </>
                ) : null}
                {e.venueName || e.address ? (
                  <>
                    <dt>{L.event.place}</dt>
                    <dd>
                      {e.venueName ? <b>{e.venueName}</b> : null}
                      {e.venueName && e.address ? <br /> : null}
                      {e.address ?? null}
                    </dd>
                  </>
                ) : null}
              </dl>
              <div className="ar-links">
                {maps ? (
                  <a
                    className="ar-lnk"
                    href={maps}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {L.event.maps}
                  </a>
                ) : null}
                {gcal ? (
                  <details className="ar-cal">
                    <summary className="ar-lnk">{L.event.calendar}</summary>
                    <div className="ar-cal__menu">
                      <a
                        className="ar-cal__opt"
                        href={gcal}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {L.event.calendarGoogle}
                      </a>
                      {icsServable ? (
                        <a
                          className="ar-cal__opt"
                          href={icsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {L.event.calendarIcs}
                        </a>
                      ) : null}
                    </div>
                  </details>
                ) : null}
              </div>
            </div>
          </Reveal>
        );
      })}
      {countdownTarget ? (
        <Reveal>
          <Countdown targetIso={countdownTarget} labels={L.countdown} />
        </Reveal>
      ) : null}
    </section>
  );
}

/** Countdown mandiri (dipakai bila jadwal disembunyikan tapi countdown aktif). */
export function CountdownSection({
  no,
  targetIso,
}: {
  no: string;
  targetIso: string;
}) {
  return (
    <section className="ar-section">
      <SecHead no={no} title={L.sec.event} />
      <Reveal>
        <Countdown targetIso={targetIso} labels={L.countdown} />
      </Reveal>
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
    <section className="ar-section">
      <SecHead no={no} title={L.sec.gallery} />
      {media.map((m, i) => (
        <Reveal key={m.id}>
          <figure className="ar-fig">
            <LightboxThumb m={m} index={i} />
            <figcaption>
              <span>Fig. {String(i + 1).padStart(2, "0")}</span>
            </figcaption>
          </figure>
        </Reveal>
      ))}
    </section>
  );
}

/* ------------------------------------------------------------- Video ------- */
export function VideoSection({
  no,
  video,
  youtubeUrl,
}: {
  no: string;
  video: VideoView | null | undefined;
  youtubeUrl: string | undefined;
}) {
  return (
    <section className="ar-section">
      <SecHead no={no} title={L.sec.video} />
      <Reveal>
        <div className="ar-video">
          <ThemeVideo
            video={video}
            youtubeUrl={youtubeUrl}
            labels={copy.public.video}
          />
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------- Story ------- */
export function StoryBlock({ no, story }: { no: string; story: StoryEntry[] }) {
  return (
    <section className="ar-section">
      <SecHead no={no} title={L.sec.story} />
      {story.map((s, i) => (
        <Reveal key={i}>
          <div className="ar-story">
            {s.date ? <span className="ar-story__date">{s.date}</span> : null}
            <div className="ar-big ar-big--sm">{s.title}</div>
            <p className="ar-body">{s.narrative}</p>
          </div>
        </Reveal>
      ))}
    </section>
  );
}

/* -------------------------------------------------------------- RSVP ------- */
export function Rsvp({ no, slug }: { no: string; slug: string }) {
  return (
    <section className="ar-section">
      <SecHead no={no} title={L.sec.rsvp} />
      <Reveal>
        <GuestbookSection slug={slug} />
      </Reveal>
    </section>
  );
}

/* -------------------------------------------------------------- Gift ------- */
export function Gift({
  no,
  envelope,
  slug,
}: {
  no: string;
  envelope: EnvelopeType;
  slug: string;
}) {
  return (
    <section className="ar-section">
      <SecHead no={no} title={L.sec.gift} />
      <Reveal>
        <p className="ar-body">{L.envelope.note}</p>
      </Reveal>
      {envelope.banks.map((b, i) => (
        <Reveal key={`b${i}`}>
          <div className="ar-acct">
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
              className="ar-copy"
            />
          </div>
        </Reveal>
      ))}
      {envelope.ewallets.map((w, i) => (
        <Reveal key={`w${i}`}>
          <div className="ar-acct">
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
              className="ar-copy"
            />
          </div>
        </Reveal>
      ))}
      {envelope.giftAddress ? (
        <Reveal>
          <div className="ar-acct ar-acct--addr">
            <div>
              <small>{L.envelope.giftAddress}</small>
              <p style={{ ...PRELINE, marginTop: "0.3rem" }}>
                {envelope.giftAddress}
              </p>
            </div>
          </div>
        </Reveal>
      ) : null}
      <Reveal>
        <GiftConfirm slug={slug} />
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------ Footer ------- */
export function Footer({
  groomName,
  brideName,
  dateLabel,
  watermark,
}: {
  groomName: string;
  brideName: string;
  dateLabel: string | null;
  watermark: boolean;
}) {
  const gi = (groomName.trim()[0] ?? "•").toUpperCase();
  const bi = (brideName.trim()[0] ?? "•").toUpperCase();
  return (
    <footer className="ar-footer">
      <Reveal>
        <div className="ar-footer__mono">
          {gi} &amp; {bi}
        </div>
        <span className="ar-footer__dot" aria-hidden />
        {dateLabel ? <p className="ar-footer__meta">{dateLabel}</p> : null}
        {watermark ? (
          <p>
            <span className="ar-watermark">
              {L.footer.by}{" "}
              <a
                href="https://merriva.id"
                target="_blank"
                rel="noopener noreferrer"
              >
                {L.footer.brand}
              </a>
            </span>
          </p>
        ) : null}
      </Reveal>
    </footer>
  );
}

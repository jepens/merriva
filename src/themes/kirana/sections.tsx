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
import { Countdown } from "@/themes/_shared/motion";
import type {
  InvitationEventView,
  InvitationMediaView,
  PhotoView,
} from "@/types/invitation";

import { LightboxThumb } from "@/themes/_shared/lightbox";
import { copy } from "@/lib/copy";
import { ThemeVideo, type VideoView } from "@/themes/_shared/video";

import { L } from "./labels";
import { ORN } from "./ornaments";

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

/** Pita truntum — pembatas antar-section (ubin webp seamless, tepi memudar). */
function TruntumBand() {
  return (
    <div className="kr-reveal">
      <div className="kr-pita" aria-hidden />
    </div>
  );
}

/** Sepasang sulur lung-lungan di sudut kartu (aset sudut kiri-bawah dirotasi). */
function SulurCorners() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="kr-sulur kr-sulur--tl"
        src={ORN.sulur}
        alt=""
        width={480}
        height={480}
        loading="lazy"
        decoding="async"
        aria-hidden
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="kr-sulur kr-sulur--br"
        src={ORN.sulur}
        alt=""
        width={480}
        height={480}
        loading="lazy"
        decoding="async"
        aria-hidden
      />
    </>
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
      <TruntumBand />
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
  photo,
}: {
  person: Person;
  role: string;
  initial: string;
  photo?: PhotoView | null;
}) {
  const parents = L.couple.parents(person.fatherName, person.motherName);
  return (
    <div className="kr-keraton kr-reveal">
      <div className="kr-keraton__inner">
        <SulurCorners />
        <div className="kr-foto-oval">
          <div className="kr-foto-oval__ph" aria-hidden>
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
    <section className="kr-section">
      <div className="kr-center kr-reveal">
        <span className="kr-eyebrow">{L.couple.eyebrow}</span>
      </div>
      <div className="kr-pengapit kr-reveal" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ORN.wayangPutri}
          alt=""
          width={420}
          height={833}
          loading="lazy"
          decoding="async"
        />
        {/* Kayon kecil di antara sepasang wayang — ikonografi pakeliran.
            Aset sama dengan cover → sudah ter-cache. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="kr-pengapit__gn"
          src={ORN.gunungan}
          alt=""
          width={700}
          height={1050}
          loading="lazy"
          decoding="async"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ORN.wayangPutra}
          alt=""
          width={420}
          height={833}
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="kr-couple">
        <Keraton
          person={bride}
          role={L.couple.bride}
          initial={initialOf(bride.nickname || bride.name || "•")}
          photo={bridePhoto}
        />
        <Keraton
          person={groom}
          role={L.couple.groom}
          initial={initialOf(groom.nickname || groom.name || "•")}
          photo={groomPhoto}
        />
      </div>
      <TruntumBand />
    </section>
  );
}

/* --------------------------------------------------------- Countdown ------- */
export function CountdownBlock({ targetIso }: { targetIso: string }) {
  return (
    <section className="kr-section kr-center">
      <span className="kr-eyebrow kr-reveal">{L.countdown.eyebrow}</span>
      <div className="kr-cd-frame kr-reveal">
        <SulurCorners />
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
      {livestreamUrl ? (
        <div className="kr-live kr-reveal">
          <a
            className="kr-pill kr-pill--gold"
            href={livestreamUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Radio size={14} />
            {L.schedule.livestream}
          </a>
        </div>
      ) : null}
      <TruntumBand />
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
      <div className="kr-g-track" data-lb-scroll>
        {media.map((m, i) => (
          <figure className="kr-g-item" key={m.id}>
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
    <section className="kr-section">
      <div className="kr-center kr-reveal">
        <span className="kr-eyebrow">{L.video.eyebrow}</span>
      </div>
      <div className="kr-video kr-reveal">
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
      <TruntumBand />
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
      {/* Kayon ukiran yang sama dengan cover (menggantikan siluet garis lama)
          — aset sudah ter-cache dari cover, jadi tanpa unduhan tambahan. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="kr-gn-mini"
        src={ORN.gunungan}
        alt=""
        width={700}
        height={1050}
        loading="lazy"
        decoding="async"
      />
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

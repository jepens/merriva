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
import { XiMark } from "./xi-mark";

/**
 * Section tema `meihua` (Tionghoa, tier Story) — acuan visual
 * `prototypes/meihua-story.html`. 囍 dirender sebagai SVG (`XiMark`) — JANGAN
 * sebagai teks: font CJK tidak di-bundle (tofu di sebagian HP; THEME-WAVE3).
 * Kuntum mei hua berkelompok 3/5 — tidak pernah 4 (§3.4).
 */

const PRELINE = { whiteSpace: "pre-line" as const };

const initialOf = (s: string) => (s.trim()[0] ?? "•").toUpperCase();

function MaskLine({ children }: { children: ReactNode }) {
  return (
    <span className="mh-line">
      <span>{children}</span>
    </span>
  );
}

/** Ranting mei hua — dahan + kuntum (kelompok 3/5, BUKAN 4); digerakkan fx. */
export function Branch() {
  return (
    <svg className="mh-branch" viewBox="0 0 520 150" aria-hidden>
      <path
        className="mh-bough"
        d="M-6 118 C80 96 150 102 210 78 C260 58 300 64 352 44 C400 26 450 30 516 10"
      />
      <path
        className="mh-bough"
        d="M210 78 C224 92 246 98 268 94"
        opacity=".8"
      />
      <path
        className="mh-bough"
        d="M352 44 C360 60 376 68 394 66"
        opacity=".8"
      />
      <g className="mh-bloom-group">
        <circle className="mh-bloom" cx="150" cy="100" r="5" />
        <circle className="mh-bloom" cx="160" cy="92" r="4" />
        <circle className="mh-bud" cx="142" cy="92" r="2.6" />
      </g>
      <g className="mh-bloom-group">
        <circle className="mh-bloom" cx="262" cy="92" r="5.4" />
        <circle className="mh-bloom" cx="272" cy="86" r="4" />
        <circle className="mh-bloom" cx="254" cy="84" r="3.6" />
        <circle className="mh-bud" cx="266" cy="78" r="2.6" />
        <circle className="mh-bud" cx="248" cy="94" r="2.2" />
      </g>
      <g className="mh-bloom-group">
        <circle className="mh-bloom" cx="390" cy="62" r="5" />
        <circle className="mh-bloom" cx="400" cy="56" r="4" />
        <circle className="mh-bud" cx="384" cy="54" r="2.6" />
      </g>
      <g className="mh-bloom-group">
        <circle className="mh-bloom" cx="470" cy="26" r="4.6" />
        <circle className="mh-bloom" cx="480" cy="20" r="3.6" />
        <circle className="mh-bloom" cx="462" cy="18" r="3.2" />
        <circle className="mh-bud" cx="474" cy="12" r="2.4" />
        <circle className="mh-bud" cx="456" cy="28" r="2" />
      </g>
    </svg>
  );
}

/**
 * Lentera gantung (§2.4) — sepasang di padding atas section mempelai, diayun
 * fx. Letaknya jauh di atas 囍 pemisah sehingga tak pernah menumpuk atau
 * memotongnya (§3.4).
 */
function Lantern({ side }: { side: "l" | "r" }) {
  return (
    <span className={`mh-lantern mh-lantern--${side}`} aria-hidden>
      <svg viewBox="0 0 44 74" focusable="false">
        <path d="M22 0 V10" />
        <ellipse cx="22" cy="32" rx="18" ry="22" />
        <path d="M8 18 H36 M8 46 H36" />
        <path d="M22 54 V62 M16 62 H28 M18 62 V72 M22 62 V74 M26 62 V71" />
      </svg>
    </span>
  );
}

/* -------------------------------------------------------------- Hero ------- */
export function Hero({ greetingOpen }: { greetingOpen?: string }) {
  return (
    <header className="mh-section mh-center mh-hero">
      <Branch />
      <span className="mh-eyebrow mh-reveal">{L.hero.eyebrow}</span>
      <p className="mh-lead mh-reveal" style={PRELINE}>
        {greetingOpen ?? L.hero.lead}
      </p>
    </header>
  );
}

/* ------------------------------------------------------------- Quote ------- */
export function MaknaBlock({ quote }: { quote?: Quote | null }) {
  const text = quote?.text || L.quote.fallbackText;
  const source = quote?.source || L.quote.fallbackSource;
  return (
    <section className="mh-section mh-ivory mh-center">
      <span className="mh-eyebrow mh-reveal">{L.quote.caption}</span>
      <div className="mh-reveal">
        <XiMark className="mh-xi--makna" />
      </div>
      <blockquote className="mh-quote">
        <MaskLine>“{text}”</MaskLine>
      </blockquote>
      <div className="mh-reveal">
        <cite className="mh-quote__cite">{source}</cite>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Couple ------- */
function Orang({
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
    <div className="mh-person mh-reveal">
      <div className="mh-foto">
        <div className="mh-foto__ph">
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
      <h3 className="mh-person__name">
        <MaskLine>{person.name || "—"}</MaskLine>
      </h3>
      <div className="mh-person__role">{role}</div>
      {person.childOrder || parents ? (
        <p className="mh-person__meta" style={PRELINE}>
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
    <section className="mh-section">
      <Lantern side="l" />
      <Lantern side="r" />
      <div className="mh-center mh-reveal">
        <span className="mh-eyebrow">{L.couple.eyebrow}</span>
        <h2 className="mh-title">{L.couple.heading}</h2>
      </div>
      <div className="mh-couple">
        <Orang person={bride} role={L.couple.bride} photo={bridePhoto} />
        <div className="mh-amp mh-reveal" aria-hidden>
          <XiMark className="mh-xi--amp" />
        </div>
        <Orang person={groom} role={L.couple.groom} photo={groomPhoto} />
      </div>
    </section>
  );
}

/* --------------------------------------------------------- Countdown ------- */
export function CountdownBlock({ targetIso }: { targetIso: string }) {
  return (
    <section className="mh-section mh-center">
      <span className="mh-eyebrow mh-reveal">{L.countdown.eyebrow}</span>
      <div className="mh-cd mh-reveal">
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
    <section className="mh-section mh-darker">
      <div className="mh-center mh-reveal">
        <span className="mh-eyebrow">{L.schedule.eyebrow}</span>
        <h2 className="mh-title">{L.schedule.heading}</h2>
      </div>
      <div className="mh-events">
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
            <article className="mh-event mh-reveal" key={e.id}>
              <h3 className="mh-event__title">
                <MaskLine>{e.name}</MaskLine>
              </h3>
              {f ? (
                <>
                  <div className="mh-event__tgl">
                    {f.weekday}, {f.date}
                  </div>
                  <div className="mh-event__jam">
                    {f.time} {f.tzLabel}
                  </div>
                </>
              ) : null}
              {e.venueName || e.address ? (
                <p className="mh-event__tempat">
                  {e.venueName}
                  {e.venueName && e.address ? <br /> : null}
                  {e.address}
                </p>
              ) : null}
              {maps || gcal ? (
                <div className="mh-pills">
                  {maps ? (
                    <a
                      className="mh-pill"
                      href={maps}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MapPin size={14} aria-hidden />
                      {L.schedule.maps}
                    </a>
                  ) : null}
                  {gcal ? (
                    <details className="mh-cal">
                      <summary className="mh-pill">
                        <CalendarPlus size={14} aria-hidden />
                        {L.schedule.calendar}
                      </summary>
                      <div className="mh-cal__menu">
                        <a
                          className="mh-cal__opt"
                          href={gcal}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {L.schedule.calendarGoogle}
                        </a>
                        {icsServable ? (
                          <a
                            className="mh-cal__opt"
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
    </section>
  );
}

/* ------------------------------------------------------------- Story ------- */
export function Story({ story }: { story: StoryEntry[] }) {
  return (
    <section className="mh-section">
      <div className="mh-center mh-reveal">
        <span className="mh-eyebrow">{L.story.eyebrow}</span>
        <h2 className="mh-title">{L.story.heading}</h2>
      </div>
      <div className="mh-story">
        {story.map((s, i) => (
          <article className="mh-beat mh-reveal" key={i}>
            {s.date ? <div className="mh-beat__thn">{s.date}</div> : null}
            <h3 className="mh-beat__title">
              <MaskLine>{s.title}</MaskLine>
            </h3>
            <p className="mh-beat__text">{s.narrative}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- Gallery ------- */
export function Gallery({ media }: { media: InvitationMediaView[] }) {
  return (
    <section className="mh-section mh-ivory">
      <div className="mh-center mh-reveal">
        <span className="mh-eyebrow">{L.gallery.eyebrow}</span>
        <h2 className="mh-title">{L.gallery.heading}</h2>
      </div>
      {/* Dua kolom block-flow — bukan CSS grid (catatan prototipe wave-3). */}
      <div className="mh-galeri" data-lb-scroll>
        {media.map((m, i) => (
          <figure
            className={`mh-g-item ${i % 5 === 0 ? "mh-g-item--okta" : ""}`}
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

/* --------------------------------------------------- Envelope (Angpao) ----- */
export function Envelope({
  envelope,
  slug,
}: {
  envelope: EnvelopeType;
  slug: string;
}) {
  return (
    <section className="mh-section mh-darker mh-center">
      <span className="mh-eyebrow mh-reveal">{L.envelope.eyebrow}</span>
      <h2 className="mh-title mh-reveal">{L.envelope.heading}</h2>
      <p className="mh-lead mh-reveal">{L.envelope.note}</p>
      <div className="mh-gifts">
        {envelope.banks.map((b, i) => (
          <article className="mh-angpao mh-reveal" key={`b${i}`}>
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
              className="mh-copy"
            />
          </article>
        ))}
        {envelope.ewallets.map((w, i) => (
          <article className="mh-angpao mh-reveal" key={`w${i}`}>
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
              className="mh-copy"
            />
          </article>
        ))}
        {envelope.giftAddress ? (
          <article className="mh-angpao mh-angpao--addr mh-reveal">
            <div>
              <small>{L.envelope.giftAddress}</small>
              <p style={PRELINE}>{envelope.giftAddress}</p>
            </div>
          </article>
        ) : null}
        <div className="mh-reveal mh-gift-confirm">
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
    <footer className="mh-footer mh-center">
      <span className="mh-eyebrow mh-reveal">{L.footer.eyebrow}</span>
      <div className="mh-reveal">
        <p className="mh-lead" style={PRELINE}>
          {greetingClose ?? L.footer.thanks}
        </p>
      </div>
      {watermark ? (
        <div className="mh-reveal">
          <span className="mh-watermark">
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

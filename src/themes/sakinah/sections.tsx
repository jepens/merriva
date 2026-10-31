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
  TimezoneId,
} from "@/lib/validation/content";
import { CopyButton } from "@/themes/_shared/copy-button";
import { Countdown, Reveal } from "@/themes/_shared/motion";
import type { InvitationEventView } from "@/types/invitation";

import { L } from "./labels";

/**
 * Section tema `sakinah` (syar'i TANPA FOTO, tier Craft) — acuan visual
 * `prototypes/sakinah-craft.html`. TANPA gsap/canvas: hanya `Reveal` bersama
 * (IO) + CSS. Nol foto & nol siluet wajah di seluruh tema (THEME-WAVE3 §3.3):
 * kartu mempelai memakai MEDALI INISIAL, galeri tak ada (diganti section Doa).
 */

const PRELINE = { whiteSpace: "pre-line" as const };

const initialOf = (s: string) => (s.trim()[0] ?? "•").toUpperCase();

/** Bintang-8 (rub el hizb) kecil — dua persegi diputar, warna mengikuti teks. */
function Star8({ className }: { className?: string }) {
  return (
    <span className={`sk-star8${className ? ` ${className}` : ""}`} aria-hidden>
      <i />
      <b />
    </span>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="sk-eyebrow">
      <Star8 /> {children}
    </p>
  );
}

/* -------------------------------------------------------------- Hero ------- */
export function Hero({ greetingOpen }: { greetingOpen?: string }) {
  return (
    <header className="sk-section sk-center sk-hero">
      <Reveal>
        <Eyebrow>{L.hero.eyebrow}</Eyebrow>
      </Reveal>
      <Reveal delay={90}>
        <p className="sk-lead" style={PRELINE}>
          {greetingOpen ?? L.hero.lead}
        </p>
      </Reveal>
    </header>
  );
}

/* ------------------------------------------------------- Ayat (quote) ------ */
export function AyatBlock({ quote }: { quote?: Quote | null }) {
  // Teks ayat milik pemilik undangan dipakai apa adanya; bila kosong, tampilkan
  // Ar-Rūm 21 (teks Arab hanya menyertai kutipan bawaan — jangan menyandingkan
  // Arab bawaan dengan terjemahan lain).
  const isDefault = !quote?.text;
  return (
    <section className="sk-section sk-tinted sk-center">
      <Reveal>
        <Eyebrow>{L.quote.caption}</Eyebrow>
      </Reveal>
      {isDefault ? (
        <Reveal delay={90}>
          <p className="sk-ar sk-ayat-ar" lang="ar" dir="rtl">
            {L.quote.ar}
          </p>
        </Reveal>
      ) : null}
      <Reveal delay={isDefault ? 180 : 90}>
        <p className="sk-ayat-id">“{quote?.text || L.quote.fallbackText}”</p>
      </Reveal>
      <Reveal delay={isDefault ? 240 : 150}>
        <p className="sk-ayat-ref">{quote?.source || L.quote.fallbackSource}</p>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------- Couple (tanpa foto) ----- */
function Medali({ person, role }: { person: Person; role: string }) {
  const parents = L.couple.parents(person.fatherName, person.motherName);
  return (
    <Reveal>
      <article className="sk-person">
        <div className="sk-initial" aria-hidden>
          <i />
          <b />
          <span>{initialOf(person.nickname || person.name || "•")}</span>
        </div>
        <h3 className="sk-person__name">{person.name || "—"}</h3>
        <div className="sk-person__role">{role}</div>
        {person.childOrder || parents ? (
          <p className="sk-person__meta" style={PRELINE}>
            {person.childOrder ? `${person.childOrder}\n` : ""}
            {parents}
          </p>
        ) : null}
      </article>
    </Reveal>
  );
}

export function Couple({ groom, bride }: { groom: Person; bride: Person }) {
  return (
    <section className="sk-section">
      <div className="sk-center">
        <Reveal>
          <Eyebrow>{L.couple.eyebrow}</Eyebrow>
          <h2 className="sk-title">{L.couple.heading}</h2>
        </Reveal>
      </div>
      <div className="sk-couple">
        <Medali person={bride} role={L.couple.bride} />
        <Reveal>
          <div className="sk-amp sk-ar" aria-hidden>
            {L.couple.and}
          </div>
        </Reveal>
        <Medali person={groom} role={L.couple.groom} />
      </div>
    </section>
  );
}

/* --------------------------------------------------------- Countdown ------- */
export function CountdownBlock({ targetIso }: { targetIso: string }) {
  return (
    <section className="sk-section sk-center">
      <Reveal>
        <Eyebrow>{L.countdown.eyebrow}</Eyebrow>
      </Reveal>
      <Reveal delay={90}>
        <div className="sk-cd">
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
      </Reveal>
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
    <section className="sk-section sk-tinted">
      <div className="sk-center">
        <Reveal>
          <Eyebrow>{L.schedule.eyebrow}</Eyebrow>
          <h2 className="sk-title">{L.schedule.heading}</h2>
        </Reveal>
      </div>
      <div className="sk-events">
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
              <article className="sk-event">
                <div className="sk-event__head">
                  <Star8 className="sk-star8--light" />
                  <h3>{e.name}</h3>
                  <Star8 className="sk-star8--light" />
                </div>
                <div className="sk-event__body">
                  {f ? (
                    <>
                      <div className="sk-event__tgl">
                        {f.weekday}, {f.date}
                      </div>
                      <div className="sk-event__jam">
                        {f.time} {f.tzLabel}
                      </div>
                    </>
                  ) : null}
                  {e.venueName ? (
                    <p className="sk-event__tempat">
                      {e.venueName}
                      {e.address ? (
                        <>
                          <br />
                          {e.address}
                        </>
                      ) : null}
                    </p>
                  ) : e.address ? (
                    <p className="sk-event__tempat">{e.address}</p>
                  ) : null}
                  {maps || gcal ? (
                    <div className="sk-pills">
                      {maps ? (
                        <a
                          className="sk-pill"
                          href={maps}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MapPin size={14} aria-hidden />
                          {L.schedule.maps}
                        </a>
                      ) : null}
                      {gcal ? (
                        <details className="sk-cal">
                          <summary className="sk-pill">
                            <CalendarPlus size={14} aria-hidden />
                            {L.schedule.calendar}
                          </summary>
                          <div className="sk-cal__menu">
                            <a
                              className="sk-cal__opt"
                              href={gcal}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {L.schedule.calendarGoogle}
                            </a>
                            {icsServable ? (
                              <a
                                className="sk-cal__opt"
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
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------ Doa (pengganti galeri) --- */
export function DoaBlock() {
  return (
    <section className="sk-section sk-center">
      <Reveal>
        <Eyebrow>{L.doa.eyebrow}</Eyebrow>
        <h2 className="sk-title">{L.doa.heading}</h2>
      </Reveal>
      <Reveal delay={120}>
        <div className="sk-doa">
          <p className="sk-ar sk-doa__ar" lang="ar" dir="rtl">
            {L.doa.ar}
          </p>
          <p className="sk-doa__id">
            {L.doa.id}
            <br />— {L.doa.source}
          </p>
        </div>
      </Reveal>
      <Reveal delay={200}>
        <p className="sk-lead sk-doa__note">{L.doa.note}</p>
      </Reveal>
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
    <section className="sk-section sk-tinted sk-center">
      <Reveal>
        <Eyebrow>{L.envelope.eyebrow}</Eyebrow>
        <h2 className="sk-title">{L.envelope.heading}</h2>
      </Reveal>
      <Reveal delay={90}>
        <p className="sk-lead">{L.envelope.note}</p>
      </Reveal>
      <div className="sk-gifts">
        {envelope.banks.map((b, i) => (
          <Reveal key={`b${i}`} delay={(i % 3) * 70}>
            <article className="sk-acct">
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
                className="sk-copy"
              />
            </article>
          </Reveal>
        ))}
        {envelope.ewallets.map((w, i) => (
          <Reveal key={`w${i}`} delay={(i % 3) * 70}>
            <article className="sk-acct">
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
                className="sk-copy"
              />
            </article>
          </Reveal>
        ))}
        {envelope.giftAddress ? (
          <Reveal>
            <article className="sk-acct sk-acct--addr">
              <div>
                <small>{L.envelope.giftAddress}</small>
                <p style={PRELINE}>{envelope.giftAddress}</p>
              </div>
            </article>
          </Reveal>
        ) : null}
        <Reveal>
          <div className="sk-gift-confirm">
            <GiftConfirm slug={slug} />
          </div>
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
    <footer className="sk-footer sk-center">
      <Reveal>
        <p className="sk-lead" style={PRELINE}>
          {greetingClose ?? L.footer.thanksLead}
        </p>
      </Reveal>
      <Reveal delay={90}>
        <p className="sk-ar sk-footer__salam" lang="ar" dir="rtl">
          {L.footer.salam}
        </p>
      </Reveal>
      {watermark ? (
        <Reveal delay={150}>
          <span className="sk-watermark">
            {L.footer.by}{" "}
            <a
              href="https://merriva.id"
              target="_blank"
              rel="noopener noreferrer"
            >
              {L.footer.brand}
            </a>
          </span>
        </Reveal>
      ) : null}
    </footer>
  );
}

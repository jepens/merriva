import { CalendarPlus, MapPin, Radio } from "lucide-react";

import { GiftConfirm } from "@/components/public/guestbook/gift-confirm";
import { GuestbookSection } from "@/components/public/guestbook/guestbook-section";
import { googleCalendarUrl } from "@/lib/calendar";
import { copy } from "@/lib/copy";
import { formatEventDateTime, utcToLocal } from "@/lib/datetime";
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
import { Countdown, Reveal } from "@/themes/_shared/motion";
import { ThemeVideo, type VideoView } from "@/themes/_shared/video";
import type {
  InvitationEventView,
  InvitationMediaView,
  PhotoView,
} from "@/types/invitation";

import type { FotoCerita } from "./foto-cerita";
import { DEKOR, dwi, L, type Dwibahasa } from "./labels";

/**
 * Halaman-halaman koran tema `warta` (tier Craft) — SERVER components. Motion
 * hanya `Reveal` bersama (IO) + CSS; foto selalu hitam-putih + raster halftone
 * (CSS `.wt-photo`), jadi foto berwarna apa pun tampil seperti cetakan koran.
 * Edisi Indonesia (`data-variant="indonesia"`) mencetaknya polos.
 */

const PRELINE = { whiteSpace: "pre-line" as const };

/** `sizes` foto selebar kolom isi (`.wt-inner`: 100% − 2×24 px, maks 440). */
const LEBAR_KOLOM = "(max-width: 488px) calc(100vw - 48px), 440px";

/** Teks dekoratif: satu string (sama di kedua edisi) atau pasangan en/id. */
export type Teks = string | Dwibahasa;

/**
 * Judul dekoratif DUA EDISI (DECISIONS #130): keduanya dirender, CSS
 * `.wt[data-variant="indonesia"]` memilih yang tampil (yang lain
 * `display:none` → tak dibaca pembaca layar, heading tetap satu). Bukan
 * pilihan server: pratinjau langsung editor Tampilan hanya mengganti
 * `data-variant` di iframe tanpa render ulang, jadi hanya CSS yang bisa
 * menukar teksnya seketika.
 */
function Dwi({ t }: { t: Teks }) {
  if (typeof t === "string") return t;
  return (
    <>
      <span className="wt-bi" lang="en">
        {t.en}
      </span>
      <span className="wt-bi" lang="id">
        {t.id}
      </span>
    </>
  );
}

/**
 * Kepala halaman koran: "PAGE 3 · COUPLE ………… THE WEDDING POST" / "HALAMAN 3
 * . MEMPELAI ………… UNDANGAN PERNIKAHAN". Dekoratif. Nomornya CSS counter
 * (`.wt-folio__n::before`, sampul = halaman 1): mengikuti urutan DOM dan
 * melewati section tersembunyi — juga di pratinjau langsung editor yang
 * mengurutkan ulang tanpa render ulang.
 */
function Folio({ rubric }: { rubric: Teks }) {
  const r = typeof rubric === "string" ? { en: rubric, id: rubric } : rubric;
  return (
    <div className="wt-folio" aria-hidden>
      <span className="wt-folio__n">
        <Dwi
          t={{
            en: `${DEKOR.en.folioSep}${r.en}`,
            id: `${DEKOR.id.folioSep}${r.id}`,
          }}
        />
      </span>
      <span>
        <Dwi t={dwi((d) => d.folioRight)} />
      </span>
    </div>
  );
}

const initialOf = (s: string) => (s.trim()[0] ?? "•").toUpperCase();

/** Foto bernama (penyesuaian pemilik via `fotoStyle`) atau monogram. */
function NamedPhoto({
  photo,
  initial,
  className,
  loading = "lazy",
}: {
  photo?: PhotoView | null;
  initial: string;
  className: string;
  /** "eager" HANYA untuk foto di layar pertama (foto berita) — lihat Hero. */
  loading?: "lazy" | "eager";
}) {
  return (
    <div className={`wt-photo ${className}`}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.url}
          alt=""
          loading={loading}
          decoding="async"
          style={{ width: "100%", height: "100%", ...fotoStyle(photo) }}
        />
      ) : (
        <span className="wt-photo__mono" aria-hidden>
          {initial}
        </span>
      )}
    </div>
  );
}

/**
 * Foto latar pita gelap (hitung mundur & penutup). `fotoStyle` → titik fokus &
 * perbesaran pemilik dipakai juga di pita yang jauh lebih lebar dari sampul.
 */
function BandPhoto({ photo }: { photo: PhotoView | null }) {
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="wt-band__img"
      src={photo.url}
      alt=""
      loading="lazy"
      decoding="async"
      style={fotoStyle(photo)}
    />
  ) : null;
}

/** Foto galeri dua varian (400 & 1600 px) — browser memilih sesuai layar. */
function MediaPhoto({
  m,
  className,
}: {
  m: InvitationMediaView;
  className: string;
}) {
  return (
    <div className={`wt-photo ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={m.url}
        srcSet={`${m.thumbUrl} 400w, ${m.url} 1600w`}
        sizes={LEBAR_KOLOM}
        alt=""
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

/* ------------------------------------------------------- News (hero) ----- */
export function Hero({
  rubric,
  greetingOpen,
  city,
  photo,
}: {
  /** Rubrik halaman koran ("News", "Couple", …). */
  rubric: Teks;
  greetingOpen?: string;
  city: string | null;
  /**
   * Foto berita utama (slot `x-berita`, DECISIONS #131) — lebar penuh di
   * bawah teks pembuka, di kedua edisi. Tanpa foto: tak ada wadah sama sekali
   * (bukan monogram) — halaman Berita tampil seperti sebelumnya.
   */
  photo?: PhotoView | null;
}) {
  return (
    <section className="wt-page wt-news">
      <Folio rubric={rubric} />
      <div className="wt-inner">
        <Reveal className="wt-center">
          <p className="wt-kicker">
            <Dwi t={dwi((d) => d.hero.kicker)} />
          </p>
          <h2 className="wt-h2 wt-h2--md">
            <Dwi t={dwi((d) => d.hero.headline)} />
          </h2>
          <p className="wt-eyebrow">
            <Dwi t={dwi((d) => d.hero.reported(city))} />
          </p>
        </Reveal>
        <Reveal delay={120}>
          <p className="wt-cols wt-dropcap" style={PRELINE}>
            {greetingOpen || L.hero.lead}
          </p>
          <p className="wt-byline">
            <span className="wt-byline__dash">—</span> {L.hero.byline(city)}
          </p>
        </Reveal>
      </div>
      {photo ? (
        <Reveal>
          <NamedPhoto
            photo={photo}
            initial=""
            className="wt-photo--news"
            // Halaman Berita sudah di layar pertama sebelum hidrasi: foto ini
            // bisa jadi elemen LCP, dan `lazy` menunda unduhannya sampai tata
            // letak. Tanpa fetchPriority tinggi — itu milik foto sampul.
            loading="eager"
          />
        </Reveal>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------ Quote (sisipan) -- */
export function QuoteBox({ quote }: { quote: Quote }) {
  return (
    <section className="wt-page wt-page--insert">
      <div className="wt-inner">
        <Reveal>
          <blockquote className="wt-quote">
            <span className="wt-quote__mark" aria-hidden>
              “
            </span>
            <p>{quote.text}</p>
            {quote.source ? <cite>{quote.source}</cite> : null}
          </blockquote>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Couple ------ */
function Profile({
  heading,
  caption,
  person,
  photo,
  roleWord,
  side,
}: {
  heading: Teks;
  caption: string;
  person: Person;
  photo?: PhotoView | null;
  roleWord: string;
  side: "left" | "right";
}) {
  const parents = L.couple.parents(person.fatherName, person.motherName);
  // "PUTRI KEDUA DARI" + orang tua; tanpa orang tua cukup urutan anaknya.
  const of = parents
    ? L.couple.childOf(person.childOrder, roleWord)
    : person.childOrder?.trim();
  return (
    <article className={`wt-profile wt-profile--${side}`}>
      <Reveal>
        <h2 className="wt-h2 wt-h2--sm">
          <Dwi t={heading} />
        </h2>
      </Reveal>
      <Reveal className={side === "left" ? "wt-from-left" : "wt-from-right"}>
        <figure className="wt-fig">
          <NamedPhoto
            photo={photo}
            initial={initialOf(person.nickname || person.name || "•")}
            className="wt-photo--portrait wt-photo--lift"
          />
          <figcaption className="wt-caption">{caption}</figcaption>
        </figure>
      </Reveal>
      <Reveal delay={90}>
        <h3 className="wt-profile__name" data-wt-fit>
          {person.name || "—"}
        </h3>
        {of ? <p className="wt-profile__of">{of}</p> : null}
        {parents ? <p className="wt-profile__parents">{parents}</p> : null}
      </Reveal>
    </article>
  );
}

export function Couple({
  rubric,
  groom,
  bride,
  groomPhoto,
  bridePhoto,
}: {
  /** Rubrik halaman koran ("News", "Couple", …). */
  rubric: Teks;
  groom: Person;
  bride: Person;
  groomPhoto?: PhotoView | null;
  bridePhoto?: PhotoView | null;
}) {
  return (
    <section className="wt-page">
      <Folio rubric={rubric} />
      <div className="wt-inner">
        <Profile
          heading={dwi((d) => d.couple.bride)}
          caption={L.couple.brideCaption}
          person={bride}
          photo={bridePhoto}
          roleWord={L.couple.daughter}
          side="left"
        />
      </div>
      <hr className="wt-rule" />
      <div className="wt-inner">
        <Profile
          heading={dwi((d) => d.couple.groom)}
          caption={L.couple.groomCaption}
          person={groom}
          photo={groomPhoto}
          roleWord={L.couple.son}
          side="right"
        />
      </div>
    </section>
  );
}

/* ------------------------------------------------------ Feature (story) --- */
export function Story({
  rubric,
  items,
  photos,
}: {
  /** Rubrik halaman koran ("News", "Couple", …). */
  rubric: Teks;
  items: StoryEntry[];
  /** Foto pendamping per entri (`fotoCerita`) — `null` = tanpa foto. */
  photos: FotoCerita[];
}) {
  return (
    <section className="wt-page wt-feature">
      <Folio rubric={rubric} />
      <div className="wt-inner">
        <Reveal>
          <h2 className="wt-h2 wt-h2--lg">
            <Dwi t={dwi((d) => d.story.heading)} />
          </h2>
          <p className="wt-eyebrow wt-eyebrow--start">
            <Dwi t={dwi((d) => d.story.eyebrow)} />
          </p>
        </Reveal>
        {items.map((s, i) => {
          const ph = photos[i];
          const right = i % 2 === 1;
          return (
            <article
              key={i}
              // Spasi DI LUAR ternary: Prettier (plugin Tailwind) memangkas
              // spasi di awal string kelas di dalamnya → kelas menempel.
              className={`wt-story ${right ? "wt-story--right" : ""}`}
            >
              <Reveal>
                <h3 className="wt-h3">
                  {/* Pembungkus inline: Edisi Indonesia menegakkan judul
                      kanan ber-font Dhaksinarga dengan skewX (warta.css). */}
                  <span className="wt-h3__t">{s.title}</span>
                </h3>
              </Reveal>
              {ph ? (
                <Reveal>
                  <figure className="wt-fig">
                    {"unggah" in ph ? (
                      // Unggahan pemilik: titik fokus & perbesarannya dipakai.
                      <NamedPhoto
                        photo={ph.unggah}
                        initial=""
                        className={right ? "wt-photo--tall" : "wt-photo--wide"}
                      />
                    ) : (
                      <MediaPhoto
                        m={ph.galeri}
                        className={right ? "wt-photo--tall" : "wt-photo--wide"}
                      />
                    )}
                    {s.date ? (
                      <figcaption className="wt-caption">{s.date}</figcaption>
                    ) : null}
                  </figure>
                </Reveal>
              ) : s.date ? (
                <p className="wt-caption">{s.date}</p>
              ) : null}
              <Reveal>
                <p className="wt-cols" style={PRELINE}>
                  {s.narrative}
                </p>
              </Reveal>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ----------------------------------------------- Diary (countdown) -------- */
interface CalCell {
  n: number;
  out: boolean;
  mark: boolean;
}

/** Kisi satu bulan (Senin di kolom pertama) untuk tanggal lokal `YYYY-MM-DD`. */
function bulanKalender(localDate: string): {
  year: number;
  month: string;
  day: number;
  cells: CalCell[];
} | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!m) return null;
  const year = Number(m[1]);
  const mon = Number(m[2]);
  const day = Number(m[3]);
  const first = new Date(Date.UTC(year, mon - 1, 1));
  if (Number.isNaN(first.getTime())) return null;
  const lead = (first.getUTCDay() + 6) % 7;
  const inMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const prevLen = new Date(Date.UTC(year, mon - 1, 0)).getUTCDate();
  const cells: CalCell[] = [];
  for (let i = lead; i > 0; i--)
    cells.push({ n: prevLen - i + 1, out: true, mark: false });
  for (let d = 1; d <= inMonth; d++)
    cells.push({ n: d, out: false, mark: d === day });
  for (let d = 1; cells.length % 7 !== 0; d++)
    cells.push({ n: d, out: true, mark: false });
  return { year, month: L.countdown.months[mon - 1], day, cells };
}

function Calendar({ localDate }: { localDate: string }) {
  const cal = bulanKalender(localDate);
  if (!cal) return null;
  return (
    <div
      className="wt-cal"
      role="img"
      aria-label={L.countdown.calendarLabel(cal.month, cal.year, cal.day)}
    >
      <p className="wt-cal__title" aria-hidden>
        {cal.month} {cal.year}
      </p>
      <div className="wt-cal__grid" aria-hidden>
        {L.countdown.weekdays.map((w) => (
          <span key={w} className="wt-cal__head">
            {w}
          </span>
        ))}
        {cal.cells.map((c, i) =>
          c.out ? (
            // Tanggal bulan tetangga = hiasan pudar, digambar CSS dari
            // `data-n` (bukan teks) — tak terbaca sebagai isi kalender.
            <span key={i} className="wt-cal__day is-out" data-n={c.n} />
          ) : (
            <span key={i} className={`wt-cal__day ${c.mark ? "is-mark" : ""}`}>
              {c.mark ? (
                <svg viewBox="0 0 24 22" focusable="false">
                  <path d="M12 21C5 15.6 1.6 12 1.6 7.7 1.6 4.6 4 2.2 7 2.2c2 0 3.8 1.1 5 2.8 1.2-1.7 3-2.8 5-2.8 3 0 5.4 2.4 5.4 5.5 0 4.3-3.4 7.9-10.4 13.3z" />
                </svg>
              ) : null}
              <b>{c.n}</b>
            </span>
          ),
        )}
      </div>
    </div>
  );
}

export function CountdownBlock({
  rubric,
  targetIso,
  localDate,
  numericDate,
  photo,
}: {
  /** Rubrik halaman koran ("News", "Couple", …). */
  rubric: Teks;
  targetIso: string;
  localDate: string | null;
  numericDate: string | null;
  photo: PhotoView | null;
}) {
  return (
    <section className="wt-page wt-diary">
      <Folio rubric={rubric} />
      <div className="wt-inner wt-center">
        <Reveal>
          <p className="wt-eyebrow">
            <Dwi t={dwi((d) => d.countdown.eyebrow)} />
          </p>
          <h2 className="wt-h2 wt-h2--xl">
            <Dwi t={dwi((d) => d.countdown.heading)} />
          </h2>
          <p className="wt-sub">
            <Dwi t={dwi((d) => d.countdown.sub)} />
          </p>
        </Reveal>
      </div>
      {localDate ? (
        <Reveal>
          <Calendar localDate={localDate} />
        </Reveal>
      ) : null}
      {numericDate ? (
        <Reveal className="wt-center">
          <p className="wt-stamp">
            <Dwi t={dwi((d) => d.countdown.stamp(numericDate))} />
          </p>
        </Reveal>
      ) : null}
      <div className="wt-band">
        <BandPhoto photo={photo} />
        <div className="wt-band__body">
          <p className="wt-eyebrow wt-eyebrow--light">
            <Dwi t={dwi((d) => d.countdown.band)} />
          </p>
          <div className="wt-cd">
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
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------ Classified (acara) ------ */
export function Schedule({
  rubric,
  events,
  tz,
  slug,
  livestreamUrl,
}: {
  /** Rubrik halaman koran ("News", "Couple", …). */
  rubric: Teks;
  events: InvitationEventView[];
  tz: TimezoneId;
  slug: string;
  /** Sudah digerbang server: Premium + https (DECISIONS #116). */
  livestreamUrl?: string;
}) {
  const icsServable = !isReservedSlug(slug) && !isDraftSlug(slug);
  const tanggal = (utc: string) => utcToLocal(utc, tz).slice(0, 10);
  const sameDay = new Set(events.map((e) => tanggal(e.startAt))).size === 1;
  return (
    <section className="wt-page">
      <Folio rubric={rubric} />
      <div className="wt-inner">
        <Reveal className="wt-center">
          <h2 className="wt-h2 wt-h2--lg">
            <Dwi t={dwi((d) => d.schedule.heading)} />
          </h2>
          <p className="wt-eyebrow">
            <Dwi
              t={dwi((d) => d.schedule.announcements(events.length, sameDay))}
            />
          </p>
        </Reveal>
        <div className="wt-events">
          {events.map((e) => {
            const f = formatEventDateTime(e.startAt, tz);
            // Jam selesai hanya bila di hari yang sama; selain itu "– selesai".
            const end =
              e.endAt && tanggal(e.endAt) === tanggal(e.startAt)
                ? formatEventDateTime(e.endAt, tz)
                : null;
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
                <article className="wt-event">
                  <h3 className="wt-event__name">{e.name}</h3>
                  {f ? (
                    <>
                      <p className="wt-event__date">
                        {f.weekday}, {f.date}
                      </p>
                      <p className="wt-event__time">
                        {L.schedule.time(f.time, end?.time ?? null, f.tzLabel)}
                      </p>
                    </>
                  ) : null}
                  {e.venueName || e.address ? (
                    <p className="wt-event__venue">
                      {e.venueName ? <strong>{e.venueName}</strong> : null}
                      {e.venueName && e.address ? <br /> : null}
                      {e.address}
                    </p>
                  ) : null}
                  {maps || gcal ? (
                    <div className="wt-actions">
                      {maps ? (
                        <a
                          className="wt-btn"
                          href={maps}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MapPin size={14} aria-hidden />
                          {L.schedule.maps}
                        </a>
                      ) : null}
                      {gcal ? (
                        <details className="wt-cal-menu">
                          <summary className="wt-btn wt-btn--ghost">
                            <CalendarPlus size={14} aria-hidden />
                            {L.schedule.calendar}
                          </summary>
                          <div className="wt-cal-menu__list">
                            <a
                              href={gcal}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {L.schedule.calendarGoogle}
                            </a>
                            {icsServable ? (
                              <a
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
              </Reveal>
            );
          })}
        </div>
        {livestreamUrl ? (
          <Reveal className="wt-center">
            <a
              className="wt-btn wt-live"
              href={livestreamUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Radio size={14} aria-hidden />
              {L.schedule.livestream}
            </a>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Video ------ */
export function VideoSection({
  rubric,
  video,
  youtubeUrl,
}: {
  /** Rubrik halaman koran ("News", "Couple", …). */
  rubric: Teks;
  video: VideoView | null | undefined;
  youtubeUrl: string | undefined;
}) {
  return (
    <section className="wt-page">
      <Folio rubric={rubric} />
      <div className="wt-inner">
        <Reveal className="wt-center">
          <p className="wt-eyebrow">
            <Dwi t={dwi((d) => d.video.eyebrow)} />
          </p>
          <h2 className="wt-h2 wt-h2--lg">
            <Dwi t={dwi((d) => d.video.heading)} />
          </h2>
        </Reveal>
        <Reveal>
          <div className="wt-video">
            <ThemeVideo
              video={video}
              youtubeUrl={youtubeUrl}
              labels={copy.public.video}
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------- Reply (RSVP) ----- */
export function Rsvp({ rubric, slug }: { rubric: Teks; slug: string }) {
  return (
    <section className="wt-page wt-reply">
      <Folio rubric={rubric} />
      <div className="wt-inner">
        <Reveal className="wt-center">
          <p className="wt-eyebrow">
            <Dwi t={dwi((d) => d.rsvp.eyebrow)} />
          </p>
          <h2 className="wt-h2 wt-h2--xl">
            <Dwi t={dwi((d) => d.rsvp.heading)} />
          </h2>
          <p className="wt-lead">{L.rsvp.lead}</p>
        </Reveal>
        <GuestbookSection slug={slug} />
      </div>
    </section>
  );
}

/* --------------------------------------------------- Archive (galeri) ----- */
export function Gallery({
  rubric,
  media,
}: {
  /** Rubrik halaman koran ("News", "Couple", …). */
  rubric: Teks;
  media: InvitationMediaView[];
}) {
  const [lead, ...rest] = media;
  return (
    <section className="wt-page">
      <Folio rubric={rubric} />
      <div className="wt-inner">
        <Reveal className="wt-center">
          <h2 className="wt-h2 wt-h2--lg">
            <Dwi t={dwi((d) => d.gallery.heading)} />
          </h2>
        </Reveal>
        {lead ? (
          <Reveal>
            <figure className="wt-fig">
              <div className="wt-photo wt-photo--lead">
                <LightboxThumb m={lead} index={0} sizes={LEBAR_KOLOM} />
              </div>
              <figcaption className="wt-caption">
                {L.gallery.caption}
              </figcaption>
            </figure>
          </Reveal>
        ) : null}
        {rest.length > 0 ? (
          <div className="wt-archive">
            {rest.map((m, i) => (
              <Reveal key={m.id} delay={(i % 2) * 80}>
                <div className="wt-photo wt-photo--sq">
                  <LightboxThumb
                    m={m}
                    index={i + 1}
                    // Jumlah ganjil: ubin terakhir selebar kolom (warta.css).
                    sizes={
                      i === rest.length - 1 && rest.length % 2 === 1
                        ? LEBAR_KOLOM
                        : undefined
                    }
                  />
                </div>
              </Reveal>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ------------------------------------------------ Kupon (amplop) ---------- */
function Account({
  label,
  number,
  holder,
}: {
  label: string;
  number: string;
  holder?: string;
}) {
  return (
    <article className="wt-acct">
      <p className="wt-acct__bank">{label}</p>
      <div className="wt-acct__row">
        <b className="wt-acct__num">{number}</b>
        <CopyButton
          value={number}
          labelCopy={L.envelope.copy}
          labelCopied={L.envelope.copied}
          className="wt-copy"
        />
      </div>
      {holder ? (
        <p className="wt-acct__holder">
          {L.envelope.holder} {holder}
        </p>
      ) : null}
    </article>
  );
}

export function Envelope({
  envelope,
  slug,
  numericDate,
}: {
  envelope: EnvelopeType;
  slug: string;
  numericDate: string | null;
}) {
  const hasAccounts = envelope.banks.length + envelope.ewallets.length > 0;
  const address = envelope.giftAddress?.trim() || null;
  const tabs = hasAccounts && Boolean(address);

  const accounts = hasAccounts ? (
    <div className="wt-accts">
      <p className="wt-gift__lead">{L.envelope.transferLead}</p>
      {envelope.banks.map((b, i) => (
        <Account
          key={`b${i}`}
          label={b.bank}
          number={b.number}
          holder={b.holder}
        />
      ))}
      {envelope.ewallets.map((w, i) => (
        <Account
          key={`w${i}`}
          label={w.provider}
          number={w.number}
          holder={w.holder}
        />
      ))}
    </div>
  ) : null;

  const addressBlock = address ? (
    <div className="wt-accts">
      <p className="wt-gift__lead">{L.envelope.giftLead}</p>
      <article className="wt-acct">
        <p className="wt-acct__addr" style={PRELINE}>
          {address}
        </p>
        <CopyButton
          value={address}
          labelCopy={L.envelope.copy}
          labelCopied={L.envelope.copied}
          className="wt-copy wt-copy--addr"
        />
      </article>
    </div>
  ) : null;

  // Nomor "ISSN" dekoratif di bawah barcode, diturunkan dari tanggal acara.
  const digits = (numericDate ?? "").replace(/\D/g, "");
  const code =
    digits.length === 8
      ? `9 77${digits.slice(0, 4)} ${digits.slice(4)}00`
      : "9 770000 000000";

  return (
    <section className="wt-page wt-page--insert">
      <div className="wt-inner">
        <Reveal>
          <div className="wt-coupon">
            <div className="wt-coupon__in">
              <p className="wt-eyebrow">
                <Dwi t={dwi((d) => d.envelope.clip)} />
              </p>
              <h2 className="wt-coupon__title" id="wt-gift-title">
                <Dwi t={dwi((d) => d.envelope.heading)} />
              </h2>
              <p className="wt-lead">{L.envelope.note}</p>
              {tabs ? (
                <div
                  className="wt-gift"
                  role="group"
                  // Nama grup = judul kupon yang TAMPIL: `aria-label` tak bisa
                  // ikut berganti edisi di pratinjau langsung, sedangkan
                  // labelledby melewati span edisi yang `display:none`.
                  aria-labelledby="wt-gift-title"
                >
                  {/* Tab tanpa JS: radio + label; panel ditampilkan CSS. */}
                  <input
                    type="radio"
                    name="wt-gift"
                    id="wt-gift-transfer"
                    className="wt-gift__radio"
                    defaultChecked
                  />
                  <input
                    type="radio"
                    name="wt-gift"
                    id="wt-gift-kado"
                    className="wt-gift__radio"
                  />
                  <div className="wt-gift__tabs">
                    <label htmlFor="wt-gift-transfer" className="wt-gift__tab">
                      {L.envelope.tabTransfer}
                    </label>
                    <label htmlFor="wt-gift-kado" className="wt-gift__tab">
                      {L.envelope.tabGift}
                    </label>
                  </div>
                  <div className="wt-gift__pane wt-gift__pane--transfer">
                    {accounts}
                  </div>
                  <div className="wt-gift__pane wt-gift__pane--kado">
                    {addressBlock}
                  </div>
                </div>
              ) : (
                <>
                  {accounts}
                  {addressBlock}
                </>
              )}
              <div className="wt-gift-confirm">
                <GiftConfirm slug={slug} />
              </div>
              <div className="wt-barcode" aria-hidden>
                <span className="wt-barcode__bars" />
                <span className="wt-barcode__num">{code}</span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Footer ------ */
export function Footer({
  greetingClose,
  names,
  city,
  photo,
  watermark,
}: {
  greetingClose?: string;
  names: string;
  city: string | null;
  photo: PhotoView | null;
  watermark: boolean;
}) {
  return (
    <footer className="wt-footer">
      <div className="wt-band wt-band--footer">
        <BandPhoto photo={photo} />
        <div className="wt-band__body">
          <Reveal>
            <p className="wt-eyebrow wt-eyebrow--light">
              <Dwi t={dwi((d) => d.footer.eyebrow)} />
            </p>
            <p className="wt-footer__thanks" style={PRELINE}>
              {greetingClose || L.footer.thanks}
            </p>
            <p className="wt-footer__names" data-wt-fit>
              {names}
            </p>
          </Reveal>
          <div className="wt-footer__rule" aria-hidden />
          {/* Tanpa Reveal: blok pendek di dasar dokumen tak pernah terpicu di
              layar tinggi (tablet potret, desktop 1440p) bila tanpa watermark
              — kelas bug DECISIONS #112. */}
          <p className="wt-footer__mast">
            <Dwi t={dwi((d) => d.masthead)} />
          </p>
          <p className="wt-footer__motto">
            <Dwi t={dwi((d) => d.footer.motto)} />
          </p>
          <p className="wt-footer__printed">
            <Dwi t={dwi((d) => d.footer.printed(city))} />
          </p>
        </div>
      </div>
      {watermark ? (
        // Tanpa Reveal: watermark adalah batas paket Basic. Reveal pendek di
        // dasar halaman tak pernah terpicu pada layar tinggi (DECISIONS #112).
        <div className="wt-watermark">
          {L.footer.by}{" "}
          <a
            href="https://merriva.id"
            target="_blank"
            rel="noopener noreferrer"
          >
            {L.footer.brand}
          </a>
        </div>
      ) : null}
    </footer>
  );
}

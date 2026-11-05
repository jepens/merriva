import localFont from "next/font/local";
import type { ReactNode } from "react";

import { appearanceStyle } from "@/lib/customizer/appearance-style";
import { resolveAppearance } from "@/lib/customizer/resolve";
import {
  formatDateOnly,
  formatEventDateTime,
  localToUtc,
} from "@/lib/datetime";
import { isSectionVisible } from "@/lib/validation/content";
import { CoverGate } from "@/themes/_shared/cover-gate";
import { hasVideoSection } from "@/themes/_shared/video-gate";
import { Lightbox } from "@/themes/_shared/lightbox";
import type { ThemeComponentProps } from "@/themes/registry";

// CSS tema TIDAK di-import di sini: ia dikirim sebagai aset statis lewat
// `<ThemeStyles slug="prisma" />` supaya undangan tak mengunduh stylesheet
// kesepuluh tema (AUDIT PER-2 / DECISIONS #31). Sumbernya tetap ./prisma.css
import { PrismaCover } from "./cover";
import { PrismaFx } from "./fx";
import { L } from "./labels";
import { prismaOptions } from "./options";
import {
  Envelope,
  EventBlock,
  Footer,
  Gallery,
  Intro,
  Marquee,
  Rsvp,
  Rundown,
  type PrismaStat,
  VideoSection,
} from "./sections";

// Self-hosted (next/font) → tanpa request eksternal saat runtime (WebView/LCP).
// Space Grotesk = grotesque display eksperimental; Space Mono = mono untuk label,
// index section, kode tiket. Palet aurora violet/cyan/lime (di CSS).
// SEMUA instance `preload:false` (AUDIT-2026-09-04 PER-1): `next/font` meng-emit
// `<link rel=preload as=font>` untuk SETIAP tema yang tergabung di graph modul
// `/[slug]`, bukan hanya tema yang dipakai — 116 berkas / 2,03 MB per pembukaan
// undangan. Tanpa preload, `@font-face` + `unicode-range` tetap terbit dan
// browser hanya mengunduh slice yang benar-benar dipakai.
const prDisp = localFont({
  src: [
    {
      path: "../../fonts/themes/space-grotesk-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/space-grotesk-500.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../fonts/themes/space-grotesk-700.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--pr-disp",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1 di atas.
  preload: false,
});
const prMono = localFont({
  src: [
    {
      path: "../../fonts/themes/space-mono-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/space-mono-700.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--pr-mono",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1 di atas.
  preload: false,
});

/** Inisial merek dari nama organizer (buang prefiks badan usaha), fallback "M". */
function brandInitials(name: string): string {
  const skip = new Set(["pt", "cv", "tbk", "persero", "pt.", "cv."]);
  const letters = name
    .split(/\s+/)
    .filter((w) => !skip.has(w.toLowerCase()) && /^[a-z]/i.test(w))
    .map((w) => w.charAt(0).toUpperCase());
  return (
    letters.join("").slice(0, 4) || name.trim().charAt(0).toUpperCase() || "M"
  );
}

/**
 * Tema "Prisma" (corporate, tier Signature) — TEMA BARU, acuan
 * `prototypes/prisma-signature.html`. Eksperimental Modern: shader aurora, mega
 * type, agenda mono, tiket RSVP dengan barcode, angka count-up. SERVER component
 * dibungkus `CoverGate` (klien) yang memegang cover + musik (`coverMode:'theme'`).
 * TIDAK mengambil data sendiri (SPEC §7.1); tiket RSVP membungkus
 * `GuestbookSection` yang sudah ada (bukan form baru).
 */
export default function Prisma({ data }: ThemeComponentProps) {
  const rootClass = `pr ${prDisp.variable} ${prMono.variable}`;
  const { settings } = data;

  if (data.content.category !== "corporate") {
    return (
      <div className={rootClass}>
        <section className="pr-section">
          <p className="pr-lead">{L.wrongCategory}</p>
        </section>
      </div>
    );
  }

  const content = data.content;
  const eventName = content.eventName;
  const organizer = content.organizer;

  const firstEvent = data.events[0];
  const dateLabel = firstEvent
    ? (() => {
        const f = formatEventDateTime(firstEvent.startAt, settings.timezone);
        return f ? `${f.weekday}, ${f.date}` : null;
      })()
    : data.eventDate
      ? (() => {
          const f = formatDateOnly(data.eventDate);
          return f ? `${f.weekday}, ${f.date}` : null;
        })()
      : null;

  const dateShort = firstEvent
    ? (formatEventDateTime(firstEvent.startAt, settings.timezone)?.date ?? null)
    : data.eventDate
      ? (formatDateOnly(data.eventDate)?.date ?? null)
      : null;

  const countdownTarget =
    firstEvent?.startAt ??
    (data.eventDate
      ? localToUtc(`${data.eventDate}T00:00`, settings.timezone)
      : null);

  // Stats adaptif dari data hidup (angka non-fiktif, count-up di klien). Dimensi
  // waktu ada di section Countdown → stats fokus ke skala konten (bukan Date.now,
  // yang tak murni saat render).
  const stats: PrismaStat[] = [];
  if (content.agenda.length > 0)
    stats.push({ value: content.agenda.length, label: L.stats.sessions });
  if (data.media.length > 0)
    stats.push({ value: data.media.length, label: L.stats.moments });
  if (data.events.length > 1)
    stats.push({ value: data.events.length, label: L.stats.locations });

  const env = content.envelope;
  const hasEnvelope =
    env.enabled &&
    (env.banks.length > 0 ||
      env.ewallets.length > 0 ||
      Boolean(env.giftAddress));

  const showRundown =
    isSectionVisible(settings, "story") && content.agenda.length > 0;
  const showCountdown =
    isSectionVisible(settings, "countdown") && Boolean(countdownTarget);
  const showSchedule =
    isSectionVisible(settings, "schedule") && data.events.length > 0;
  const showEventBlock = showCountdown || showSchedule;
  const hasVideo = hasVideoSection(data.video, content.youtubeUrl);
  const showGallery =
    isSectionVisible(settings, "gallery") && data.media.length > 0;
  // `rsvp` dideklarasikan `toggle: false` di options.ts = WAJIB TAMPIL
  // (CUSTOMIZER-SPEC §3). Jalur lama ini dulu tetap menanyakan toggle lama,
  // sehingga buku tamu bisa hilang dari undangan yang sudah terbit. Tema
  // berjalur tunggal menutupnya lewat `defaultSectionOrder`; tema dua-jalur
  // seperti ini menutupnya di sini.
  const showRsvp = true;
  const showEnvelope = isSectionVisible(settings, "envelope") && hasEnvelope;

  const headText = content.quote?.text ?? L.intro.fallbackHead;
  const lead = content.description ?? content.greetingOpen;

  // Kode & nomor tiket dekoratif (deterministik dari slug — aman SSR).
  const codeSum = Array.from(data.slug).reduce(
    (a, c) => a + c.charCodeAt(0),
    0,
  );
  const ticketNo = String(codeSum % 10000).padStart(4, "0");
  const ticketCode =
    data.slug
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 10) || "MERRIVA";

  const footerLogo = brandInitials(organizer ?? eventName);
  const contact =
    [content.pic?.phone, content.pic?.email].filter(Boolean).join(" · ") ||
    L.footer.contact;

  const marqueeItems = [
    eventName,
    organizer,
    dateShort,
    firstEvent?.venueName,
  ].filter((x): x is string => Boolean(x));

  // Kustomisasi (Fase G). Tanpa `custom` → render legacy PERSIS (di bawah).
  // Dengan `custom` → section-map bernomor sesuai urutan resolver (countdown &
  // jadwal menyatu di blok Acara). Prisma bernomor/gabungan → dua jalur (aman).
  const custom = settings.custom ?? null;
  const resolved = custom ? resolveAppearance(prismaOptions, custom) : null;

  if (resolved) {
    const grainOn = resolved.grain;
    const appearance = {
      style: appearanceStyle(prismaOptions.preview.vars, resolved),
      motion: resolved.motion,
    };
    const defs: Record<
      string,
      { has: boolean; render: (no: string) => ReactNode }
    > = {
      hero: {
        has: true,
        render: (no) => (
          <Intro no={no} headText={headText} lead={lead} stats={stats} />
        ),
      },
      agenda: {
        has: content.agenda.length > 0,
        render: (no) => <Rundown no={no} agenda={content.agenda} />,
      },
      schedule: {
        has: Boolean(countdownTarget) || data.events.length > 0,
        render: (no) => (
          <EventBlock
            no={no}
            showCountdown={Boolean(countdownTarget)}
            countdownTarget={countdownTarget}
            showSchedule={data.events.length > 0}
            events={data.events}
            tz={settings.timezone}
            slug={data.slug}
          />
        ),
      },
      gallery: {
        has: data.media.length > 0,
        render: (no) => (
          <Lightbox media={data.media}>
            <Gallery no={no} media={data.media} />
          </Lightbox>
        ),
      },
      video: {
        has: hasVideo,
        render: (no) => (
          <VideoSection
            no={no}
            video={data.video}
            youtubeUrl={content.youtubeUrl}
          />
        ),
      },
      rsvp: {
        has: true,
        render: (no) => (
          <Rsvp
            no={no}
            slug={data.slug}
            eventName={eventName}
            code={ticketCode}
            ticketNo={ticketNo}
          />
        ),
      },
      envelope: {
        has: hasEnvelope,
        render: (no) => <Envelope no={no} envelope={env} slug={data.slug} />,
      },
    };
    let cn = 0;
    return (
      <CoverGate
        rootClassName={rootClass}
        contentClassName="pr-stage"
        coverClassName="pr-cover"
        musicClassName="pr-music"
        wipeMs={1100}
        music={data.music}
        appearance={appearance}
        cover={
          <PrismaCover
            eventName={eventName}
            organizer={organizer}
            dateLabel={dateLabel}
          />
        }
        fx={<PrismaFx />}
      >
        {grainOn ? <div className="pr-grain" aria-hidden /> : null}
        <div className="pr-progress" aria-hidden />

        <Marquee items={marqueeItems} />

        {resolved.sections
          .filter((s) => s.visible)
          .map((s) => {
            const def = defs[s.id];
            if (!def || !def.has) return null;
            const no = String(++cn).padStart(2, "0");
            return (
              <div
                key={s.id}
                data-section-id={s.id}
                style={{ display: "contents" }}
              >
                {def.render(no)}
              </div>
            );
          })}

        <Footer
          logo={footerLogo}
          organizer={organizer}
          picName={content.pic?.name}
          closing={content.greetingClose}
          contact={contact}
          watermark={data.watermark}
        />
      </CoverGate>
    );
  }

  // Penomoran section berurutan — hanya section yang tampil yang diberi nomor.
  let n = 0;
  const no = () => String(++n).padStart(2, "0");

  return (
    <CoverGate
      rootClassName={rootClass}
      contentClassName="pr-stage"
      coverClassName="pr-cover"
      musicClassName="pr-music"
      wipeMs={1100}
      music={data.music}
      cover={
        <PrismaCover
          eventName={eventName}
          organizer={organizer}
          dateLabel={dateLabel}
        />
      }
      fx={<PrismaFx />}
    >
      <div className="pr-grain" aria-hidden />
      <div className="pr-progress" aria-hidden />

      <Marquee items={marqueeItems} />

      <Intro no={no()} headText={headText} lead={lead} stats={stats} />

      {showRundown ? <Rundown no={no()} agenda={content.agenda} /> : null}

      {showEventBlock ? (
        <EventBlock
          no={no()}
          showCountdown={showCountdown}
          countdownTarget={showCountdown ? countdownTarget : null}
          showSchedule={showSchedule}
          events={data.events}
          tz={settings.timezone}
          slug={data.slug}
        />
      ) : null}

      {showGallery ? (
        <Lightbox media={data.media}>
          <Gallery no={no()} media={data.media} />
        </Lightbox>
      ) : null}

      {hasVideo ? (
        <VideoSection
          no={no()}
          video={data.video}
          youtubeUrl={content.youtubeUrl}
        />
      ) : null}

      {showRsvp ? (
        <Rsvp
          no={no()}
          slug={data.slug}
          eventName={eventName}
          code={ticketCode}
          ticketNo={ticketNo}
        />
      ) : null}

      {showEnvelope ? (
        <Envelope no={no()} envelope={env} slug={data.slug} />
      ) : null}

      <Footer
        logo={footerLogo}
        organizer={organizer}
        picName={content.pic?.name}
        closing={content.greetingClose}
        contact={contact}
        watermark={data.watermark}
      />
    </CoverGate>
  );
}

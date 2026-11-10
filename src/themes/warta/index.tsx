import localFont from "next/font/local";
import type { ReactNode } from "react";

import { appearanceStyle } from "@/lib/customizer/appearance-style";
import { defaultSectionOrder } from "@/lib/customizer/default-order";
import { resolveAppearance } from "@/lib/customizer/resolve";
import {
  formatDateOnly,
  formatEventDateTime,
  localToUtc,
  utcToLocal,
} from "@/lib/datetime";
import { CoverGate } from "@/themes/_shared/cover-gate";
import { Lightbox } from "@/themes/_shared/lightbox";
import { hasVideoSection } from "@/themes/_shared/video-gate";
import type { ThemeComponentProps } from "@/themes/registry";
import type { InvitationMediaView, PhotoView } from "@/types/invitation";

// CSS tema TIDAK di-import di sini: ia dikirim sebagai aset statis lewat
// `<ThemeStyles slug="warta" />` supaya undangan tak mengunduh stylesheet
// semua tema (DECISIONS #31). Sumbernya tetap ./warta.css
import { WartaCover } from "./cover";
import { WartaFx } from "./fx";
import { kotaDari } from "./kota";
import { L } from "./labels";
import { wartaOptions } from "./options";
import {
  CountdownBlock,
  Couple,
  Envelope,
  Footer,
  Gallery,
  Hero,
  QuoteBox,
  Rsvp,
  Schedule,
  Story,
  VideoSection,
} from "./sections";

// Self-hosted (next/font) → tanpa request eksternal (WebView/LCP). SEMUA
// `preload:false` (AUDIT-2026-09-04 PER-1): font tema hanya terunduh bila glyph-
// nya benar-benar dirender. Nama binding = `font-family` → berprefiks `wt`
// (DECISIONS #107, dijaga tests/unit/font-binding-unik.test.ts).
// Pasangan a — Anton (judul kondensed) + PT Serif (isi berita).
const wtDispA = localFont({
  src: [
    {
      path: "../../fonts/themes/anton-400.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--wt-disp-a",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1.
  preload: false,
  // Fallback otomatis next/font (Arial ±92%) jauh lebih lebar dari Anton yang
  // kondensed: judul kapital membungkus 2 baris lalu kembali 1 baris saat font
  // tiba → CLS ±0,03 di sampul. Penggantinya `wtAntonFallback` (warta.css):
  // Arial/Roboto lokal diperkecil ±72% → lebar huruf kapital setara Anton.
  adjustFontFallback: false,
  fallback: ["wtAntonFallback", "Impact", "sans-serif"],
});
const wtBodyA = localFont({
  src: [
    {
      path: "../../fonts/themes/pt-serif-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/pt-serif-400-italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../fonts/themes/pt-serif-700.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--wt-body-a",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1.
  preload: false,
});
// Identitas tema (bukan pilihan pemilik): kop blackletter, subjudul serif
// kontras tinggi, eyebrow geometris, mesin ketik, tanda tangan penutup.
const wtMast = localFont({
  src: [
    {
      path: "../../fonts/themes/unifrakturmaguntia-400.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--wt-mast",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1.
  preload: false,
});
const wtSub = localFont({
  src: [
    {
      path: "../../fonts/themes/playfair-display-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/playfair-display-400-italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../fonts/themes/playfair-display-700.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--wt-sub",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1.
  preload: false,
});
const wtCaps = localFont({
  src: [
    {
      path: "../../fonts/themes/montserrat-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/montserrat-600.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--wt-caps",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1.
  preload: false,
});
const wtType = localFont({
  src: [
    {
      path: "../../fonts/themes/special-elite-400.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--wt-type",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1.
  preload: false,
});
const wtSign = localFont({
  src: [
    {
      path: "../../fonts/themes/great-vibes-400.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--wt-sign",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1.
  preload: false,
});

const FONT_VARS = [
  wtDispA.variable,
  wtBodyA.variable,
  wtMast.variable,
  wtSub.variable,
  wtCaps.variable,
  wtType.variable,
  wtSign.variable,
].join(" ");

/** Foto galeri sebagai foto latar (titik fokus tengah, tanpa perbesaran). */
const fotoGaleri = (m: InvitationMediaView | undefined): PhotoView | null =>
  m ? { url: m.url, x: 0.5, y: 0.5, zoom: 1 } : null;

/**
 * Tema "Warta" (wedding, tier Craft) — undangan berwujud koran retro "The
 * Wedding Post": kop blackletter, pita ticker, foto halftone, halaman bernomor
 * (News → Couple → Feature → Diary → Classified → Reply → Archive), kalender
 * berhati, stempel mesin ketik, kupon amplop berbarcode. TANPA gsap/lenis/
 * canvas: reveal via `Reveal` (IO) + CSS. SERVER component; section tampil
 * sesuai `settings.sections` + customizer. TIDAK mengambil data sendiri.
 */
export default function WartaTheme({ data }: ThemeComponentProps) {
  const rootClass = `wt ${FONT_VARS}`;
  const { settings } = data;

  if (data.content.category !== "wedding") {
    return (
      <div className={rootClass}>
        <section className="wt-page">
          <p className="wt-lead">Tema ini khusus untuk undangan pernikahan.</p>
        </section>
      </div>
    );
  }

  const content = data.content;
  const tz = settings.timezone;
  const groomName =
    content.groom.nickname || content.groom.name || "Mempelai Pria";
  const brideName =
    content.bride.nickname || content.bride.name || "Mempelai Wanita";

  const firstEvent = data.events[0];
  // Tanggal LOKAL acara (YYYY-MM-DD, zona acara) — dasar kalender & tanggal
  // angka di ticker/stempel.
  const localDate = firstEvent
    ? utcToLocal(firstEvent.startAt, tz).slice(0, 10) || null
    : data.eventDate;
  const dateLabel = firstEvent
    ? (() => {
        const f = formatEventDateTime(firstEvent.startAt, tz);
        return f ? `${f.weekday}, ${f.date}` : null;
      })()
    : data.eventDate
      ? (() => {
          const f = formatDateOnly(data.eventDate);
          return f ? `${f.weekday}, ${f.date}` : null;
        })()
      : null;
  const numericDate = localDate
    ? (() => {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
        return m ? `${m[3]} · ${m[2]} · ${m[1]}` : null;
      })()
    : null;

  const countdownTarget =
    firstEvent?.startAt ??
    (data.eventDate ? localToUtc(`${data.eventDate}T00:00`, tz) : null);

  const city = kotaDari(firstEvent?.address);
  const venueLine = firstEvent?.venueName
    ? city && !firstEvent.venueName.includes(city)
      ? `${firstEvent.venueName}, ${city}`
      : firstEvent.venueName
    : city;

  const envelope = content.envelope;
  const hasEnvelope =
    envelope.enabled &&
    (envelope.banks.length > 0 ||
      envelope.ewallets.length > 0 ||
      Boolean(envelope.giftAddress));
  const hasVideo = hasVideoSection(data.video, content.youtubeUrl);

  const custom = settings.custom ?? null;
  const resolved = custom ? resolveAppearance(wartaOptions, custom) : null;
  const order =
    resolved?.sections ?? defaultSectionOrder(wartaOptions, settings);

  // Section yang benar-benar punya isi. Nomor halaman ("Page N") TIDAK dihitung
  // di sini: CSS counter (`.wt-folio`) mengikuti urutan DOM dan melewati
  // pembungkus `display:none`, jadi tetap berurutan juga saat editor Tampilan
  // mengurutkan/menyembunyikan section langsung di iframe tanpa render ulang.
  const tersedia: Record<string, boolean> = {
    hero: true,
    quote: Boolean(content.quote?.text),
    couple: true,
    story: content.story.length > 0,
    countdown: Boolean(countdownTarget),
    schedule: data.events.length > 0,
    video: hasVideo,
    rsvp: true,
    gallery: data.media.length > 0,
    envelope: hasEnvelope,
  };
  const visible = order.filter((o) => o.visible && tersedia[o.id]);

  // Foto latar pita hitung mundur & penutup: sampul (dengan titik fokus
  // pemilik) dulu, lalu galeri. Penutup memakai foto galeri terakhir bila ada
  // lebih dari satu, supaya tak mengulang foto pita.
  const bandPhoto = data.coverPhoto ?? fotoGaleri(data.media[0]);
  const footerPhoto =
    data.media.length > 1
      ? fotoGaleri(data.media[data.media.length - 1])
      : bandPhoto;

  const sectionNodes: Record<string, ReactNode> = {
    hero: (
      <Hero
        rubric={L.folio.hero}
        greetingOpen={content.greetingOpen}
        city={city}
      />
    ),
    quote: content.quote?.text ? <QuoteBox quote={content.quote} /> : null,
    couple: (
      <Couple
        rubric={L.folio.couple}
        groom={content.groom}
        bride={content.bride}
        groomPhoto={data.groomPhoto}
        bridePhoto={data.bridePhoto}
      />
    ),
    story:
      content.story.length > 0 ? (
        <Story
          rubric={L.folio.story}
          items={content.story}
          photos={content.story.map((_, i) => data.media[i] ?? null)}
        />
      ) : null,
    countdown: countdownTarget ? (
      <CountdownBlock
        rubric={L.folio.countdown}
        targetIso={countdownTarget}
        localDate={localDate}
        numericDate={numericDate}
        photo={bandPhoto}
      />
    ) : null,
    schedule:
      data.events.length > 0 ? (
        <Schedule
          rubric={L.folio.schedule}
          events={data.events}
          tz={tz}
          slug={data.slug}
          livestreamUrl={content.livestreamUrl}
        />
      ) : null,
    video: hasVideo ? (
      <VideoSection
        rubric={L.folio.video}
        video={data.video}
        youtubeUrl={content.youtubeUrl}
      />
    ) : null,
    rsvp: <Rsvp rubric={L.folio.rsvp} slug={data.slug} />,
    gallery:
      data.media.length > 0 ? (
        <Lightbox media={data.media}>
          <Gallery rubric={L.folio.gallery} media={data.media} />
        </Lightbox>
      ) : null,
    envelope: hasEnvelope ? (
      <Envelope
        envelope={envelope}
        slug={data.slug}
        numericDate={numericDate}
      />
    ) : null,
  };

  const grainOn = resolved ? resolved.grain : true;
  const appearance = resolved
    ? {
        style: appearanceStyle(wartaOptions.preview.vars, resolved),
        motion: resolved.motion,
      }
    : undefined;

  return (
    <CoverGate
      rootClassName={rootClass}
      contentClassName="wt-stage"
      coverClassName="wt-cover"
      musicClassName="wt-music"
      wipeMs={950}
      music={data.music}
      appearance={appearance}
      cover={
        <WartaCover
          groomName={groomName}
          brideName={brideName}
          dateLabel={dateLabel}
          tickerLine={[L.cover.saveTheDate, numericDate, venueLine].filter(
            (x): x is string => Boolean(x),
          )}
          photo={data.coverPhoto ?? null}
        />
      }
      fx={<WartaFx />}
    >
      {grainOn ? <div className="wt-grain" aria-hidden /> : null}

      {visible.map((o) => {
        const node = sectionNodes[o.id];
        if (!node) return null;
        return (
          <div
            key={o.id}
            data-section-id={o.id}
            style={{ display: "contents" }}
          >
            {node}
          </div>
        );
      })}

      <Footer
        greetingClose={content.greetingClose}
        names={`${groomName} & ${brideName}`}
        city={city}
        photo={footerPhoto}
        watermark={data.watermark}
      />
    </CoverGate>
  );
}

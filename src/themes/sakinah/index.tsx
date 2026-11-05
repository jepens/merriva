import localFont from "next/font/local";
import type { ReactNode } from "react";

import { GuestbookSection } from "@/components/public/guestbook/guestbook-section";
import { appearanceStyle } from "@/lib/customizer/appearance-style";
import { defaultSectionOrder } from "@/lib/customizer/default-order";
import { resolveAppearance } from "@/lib/customizer/resolve";
import {
  formatDateOnly,
  formatEventDateTime,
  localToUtc,
} from "@/lib/datetime";
import { CoverGate } from "@/themes/_shared/cover-gate";
import { hasVideoSection } from "@/themes/_shared/video-gate";
import type { ThemeComponentProps } from "@/themes/registry";

// CSS tema TIDAK di-import di sini: ia dikirim sebagai aset statis lewat
// `<ThemeStyles slug="sakinah" />` (AUDIT PER-2 / DECISIONS #31). Sumber: ./sakinah.css
import { SakinahCover } from "./cover";
import { sakinahOptions } from "./options";
import {
  AyatBlock,
  CountdownBlock,
  Couple,
  DoaBlock,
  Envelope,
  Footer,
  Hero,
  Schedule,
  VideoSection,
} from "./sections";

// Self-hosted (next/font) → tanpa request eksternal (WebView/LCP). SEMUA
// `preload:false` (AUDIT-2026-09-04 PER-1 — lihat catatan di tema lain).
// a: Amiri (serif Naskh — Latin) + Plus Jakarta Sans (humanist sans Indonesia).
const skDispA = localFont({
  src: [
    {
      path: "../../fonts/themes/amiri-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/amiri-700.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--sk-disp-a",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1.
  preload: false,
});
const skBodyA = localFont({
  src: [
    {
      path: "../../fonts/themes/plus-jakarta-sans-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/plus-jakarta-sans-600.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--sk-body-a",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1.
  preload: false,
});
// b: EB Garamond + Karla (berkas sudah ada di repo — tanpa byte font baru).
const skDispB = localFont({
  src: [
    {
      path: "../../fonts/themes/eb-garamond-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/eb-garamond-500.woff2",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--sk-disp-b",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1.
  preload: false,
});
const skBodyB = localFont({
  src: [
    {
      path: "../../fonts/themes/karla-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/karla-600.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--sk-body-b",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1.
  preload: false,
});
// Glyph Arab (bismillah, ayat, doa, salam): subset Arabic Amiri terpisah —
// localFont tak mendukung unicode-range per berkas, jadi keluarga tersendiri
// (CSS `.sk-ar` memakai var ini lebih dulu). `preload:false` → hanya terunduh
// saat dipakai.
const skArab = localFont({
  src: [
    {
      path: "../../fonts/themes/amiri-arabic-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/amiri-arabic-700.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--sk-arab",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1.
  preload: false,
});

const FONT_VARS = [
  skDispA.variable,
  skBodyA.variable,
  skDispB.variable,
  skBodyB.variable,
  skArab.variable,
].join(" ");

/**
 * Tema "Sakinah" (wedding syar'i TANPA FOTO, tier Craft) — acuan
 * `prototypes/sakinah-craft.html` + THEME-WAVE3 §2.3. Nol foto & nol siluet
 * wajah secara DESAIN (bukan galeri dimatikan): medali inisial menggantikan
 * foto, galeri tak dikenal tema ini, section khas `x-doa` menggantikannya.
 * CRAFT MURNI: dilarang gsap/lenis/canvas (hanya Reveal bersama + CSS).
 * SERVER component; section tampil sesuai `settings.sections` + customizer.
 */
export default function Sakinah({ data }: ThemeComponentProps) {
  const rootClass = `sk ${FONT_VARS}`;
  const { settings } = data;

  if (data.content.category !== "wedding") {
    return (
      <div className={rootClass}>
        <section className="sk-section sk-center">
          <p className="sk-lead">Tema ini khusus untuk undangan pernikahan.</p>
        </section>
      </div>
    );
  }

  const content = data.content;
  const groomName =
    content.groom.nickname || content.groom.name || "Mempelai Pria";
  const brideName =
    content.bride.nickname || content.bride.name || "Mempelai Wanita";

  const firstEvent = data.events[0];
  const heroDateLabel = firstEvent
    ? (() => {
        const f = formatEventDateTime(firstEvent.startAt, settings.timezone);
        return f ? `${f.weekday} · ${f.date}` : null;
      })()
    : data.eventDate
      ? (() => {
          const f = formatDateOnly(data.eventDate);
          return f ? `${f.weekday} · ${f.date}` : null;
        })()
      : null;

  const countdownTarget =
    firstEvent?.startAt ??
    (data.eventDate
      ? localToUtc(`${data.eventDate}T00:00`, settings.timezone)
      : null);

  const envelope = content.envelope;
  const hasEnvelope =
    envelope.enabled &&
    (envelope.banks.length > 0 ||
      envelope.ewallets.length > 0 ||
      Boolean(envelope.giftAddress));

  const custom = settings.custom ?? null;
  const resolved = custom ? resolveAppearance(sakinahOptions, custom) : null;

  const sectionNodes: Record<string, ReactNode> = {
    hero: (
      <Hero
        greetingOpen={content.greetingOpen}
        brideName={brideName}
        groomName={groomName}
      />
    ),
    quote: <AyatBlock quote={content.quote} />,
    couple: <Couple groom={content.groom} bride={content.bride} />,
    countdown: countdownTarget ? (
      <CountdownBlock targetIso={countdownTarget} />
    ) : null,
    schedule:
      data.events.length > 0 ? (
        <Schedule
          events={data.events}
          tz={settings.timezone}
          slug={data.slug}
        />
      ) : null,
    "x-doa": <DoaBlock />,
    video: hasVideoSection(data.video, content.youtubeUrl) ? (
      <VideoSection video={data.video} youtubeUrl={content.youtubeUrl} />
    ) : null,
    rsvp: (
      <section className="sk-section">
        <div className="sk-inner">
          <GuestbookSection slug={data.slug} />
        </div>
      </section>
    ),
    envelope: hasEnvelope ? (
      <Envelope envelope={envelope} slug={data.slug} />
    ) : null,
  };

  const order =
    resolved?.sections ?? defaultSectionOrder(sakinahOptions, settings);

  const grainOn = resolved ? resolved.grain : true;

  const appearance = resolved
    ? {
        style: appearanceStyle(sakinahOptions.preview.vars, resolved),
        data: {},
        motion: resolved.motion,
      }
    : undefined;

  return (
    <CoverGate
      rootClassName={rootClass}
      contentClassName="sk-stage"
      coverClassName="sk-cover"
      musicClassName="sk-music"
      wipeMs={900}
      music={data.music}
      appearance={appearance}
      cover={
        <SakinahCover
          brideName={brideName}
          groomName={groomName}
          dateLabel={heroDateLabel}
        />
      }
    >
      {grainOn ? <div className="sk-grain" aria-hidden /> : null}

      {order
        .filter((o) => o.visible)
        .map((o) => {
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
        watermark={data.watermark}
      />
    </CoverGate>
  );
}

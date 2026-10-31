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
import { Lightbox } from "@/themes/_shared/lightbox";
import type { ThemeComponentProps } from "@/themes/registry";

// CSS tema TIDAK di-import di sini: dikirim sebagai aset statis lewat
// `<ThemeStyles slug="marawa" />` (AUDIT PER-2 / DECISIONS #31). Sumber: ./marawa.css
import { MarawaCover } from "./cover";
import { MarawaFx } from "./fx";
import { marawaOptions } from "./options";
import {
  CountdownBlock,
  Couple,
  Envelope,
  Footer,
  Gallery,
  Hero,
  PepatahBlock,
  Schedule,
  Story,
} from "./sections";

// Self-hosted (next/font); SEMUA `preload:false` (AUDIT-2026-09-04 PER-1).
// a: Cinzel (kapital terpahat — kesan ukiran emas) + Albert Sans.
const dispA = localFont({
  src: [
    {
      path: "../../fonts/themes/cinzel-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/cinzel-600.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../fonts/themes/cinzel-700.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--mw-disp-a",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1.
  preload: false,
});
const bodyA = localFont({
  src: [
    {
      path: "../../fonts/themes/albert-sans-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/albert-sans-600.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--mw-body-a",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1.
  preload: false,
});
// b: Playfair Display + Figtree (berkas sudah ada di repo).
const dispB = localFont({
  src: [
    {
      path: "../../fonts/themes/playfair-display-500.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../fonts/themes/playfair-display-600.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--mw-disp-b",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1.
  preload: false,
});
const bodyB = localFont({
  src: [
    {
      path: "../../fonts/themes/figtree-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/figtree-600.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--mw-body-b",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1.
  preload: false,
});

const FONT_VARS = [
  dispA.variable,
  bodyA.variable,
  dispB.variable,
  bodyB.variable,
].join(" ");

/**
 * Tema "Marawa" (wedding adat Minang, tier Story, dark-luxe) — acuan
 * `prototypes/marawa-story.html` + THEME-WAVE3 §2.2. Gonjong, pita marawa,
 * songket wajik, kaluak paku; maroon + hitam + emas. SERVER component; section
 * tampil sesuai `settings.sections` + customizer. Khusus wedding. Budaya
 * (§3.2): urutan pita hitam–merah–kuning tetap; pepatah dikutip utuh.
 */
export default function Marawa({ data }: ThemeComponentProps) {
  const rootClass = `mw ${FONT_VARS}`;
  const { settings } = data;

  if (data.content.category !== "wedding") {
    return (
      <div className={rootClass}>
        <section className="mw-section mw-center">
          <p className="mw-lead">Tema ini khusus untuk undangan pernikahan.</p>
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
  const resolved = custom ? resolveAppearance(marawaOptions, custom) : null;

  const sectionNodes: Record<string, ReactNode> = {
    hero: <Hero greetingOpen={content.greetingOpen} />,
    quote: <PepatahBlock quote={content.quote} />,
    couple: (
      <Couple
        groom={content.groom}
        bride={content.bride}
        groomPhoto={data.groomPhoto}
        bridePhoto={data.bridePhoto}
      />
    ),
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
    story: content.story.length > 0 ? <Story story={content.story} /> : null,
    gallery:
      data.media.length > 0 ? (
        <Lightbox media={data.media}>
          <Gallery media={data.media} />
        </Lightbox>
      ) : null,
    envelope: hasEnvelope ? (
      <Envelope envelope={envelope} slug={data.slug} />
    ) : null,
    rsvp: (
      <section className="mw-section">
        <div className="mw-inner">
          <GuestbookSection slug={data.slug} />
        </div>
      </section>
    ),
  };

  const order =
    resolved?.sections ?? defaultSectionOrder(marawaOptions, settings);

  const grainOn = resolved ? resolved.grain : true;

  const appearance = resolved
    ? {
        style: appearanceStyle(marawaOptions.preview.vars, resolved),
        data: { gallery: resolved.styles.gallery },
        motion: resolved.motion,
      }
    : undefined;

  return (
    <CoverGate
      rootClassName={rootClass}
      contentClassName="mw-stage"
      coverClassName="mw-cover"
      musicClassName="mw-music"
      wipeMs={1000}
      music={data.music}
      appearance={appearance}
      cover={
        <MarawaCover
          brideName={brideName}
          groomName={groomName}
          dateLabel={heroDateLabel}
        />
      }
      fx={<MarawaFx />}
    >
      <div className="mw-ribbon" aria-hidden>
        <i />
        <i />
        <i />
      </div>
      {grainOn ? <div className="mw-grain" aria-hidden /> : null}

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

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
  utcToLocal,
} from "@/lib/datetime";
import { CoverGate } from "@/themes/_shared/cover-gate";
import { Lightbox } from "@/themes/_shared/lightbox";
import type { ThemeComponentProps } from "@/themes/registry";

// CSS tema TIDAK di-import di sini: dikirim sebagai aset statis lewat
// `<ThemeStyles slug="meihua" />` (AUDIT PER-2 / DECISIONS #31). Sumber: ./meihua.css
import { MeihuaCover } from "./cover";
import { MeihuaFx } from "./fx";
import { meihuaOptions } from "./options";
import {
  CountdownBlock,
  Couple,
  Envelope,
  Footer,
  Gallery,
  Hero,
  MaknaBlock,
  Schedule,
  Story,
} from "./sections";

// Self-hosted (next/font); SEMUA `preload:false` (AUDIT-2026-09-04 PER-1).
// a: DM Serif Display + Work Sans.
const mhDispA = localFont({
  src: [
    {
      path: "../../fonts/themes/dm-serif-display-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/dm-serif-display-400-italic.woff2",
      weight: "400",
      style: "italic",
    },
  ],
  variable: "--mh-disp-a",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1.
  preload: false,
});
const mhBodyA = localFont({
  src: [
    {
      path: "../../fonts/themes/work-sans-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/work-sans-600.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--mh-body-a",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1.
  preload: false,
});
// b: Playfair Display + Figtree (berkas sudah ada di repo).
const mhDispB = localFont({
  src: [
    {
      path: "../../fonts/themes/playfair-display-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/themes/playfair-display-600.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--mh-disp-b",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1.
  preload: false,
});
const mhBodyB = localFont({
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
  variable: "--mh-body-b",
  display: "swap",
  // WAJIB tetap false — lihat catatan PER-1.
  preload: false,
});

const FONT_VARS = [
  mhDispA.variable,
  mhBodyA.variable,
  mhDispB.variable,
  mhBodyB.variable,
].join(" ");

/**
 * Tema "Meihua" (wedding Tionghoa, tier Story) — acuan
 * `prototypes/meihua-story.html` + THEME-WAVE3 §2.4. 囍 (SVG) + ranting mei
 * hua mekar + merah lacquer/emas/ivory; amplop bernama "Angpao Digital".
 * SERVER component; section tampil sesuai `settings.sections` + customizer.
 * Khusus wedding. Budaya (§3.4): 囍 utuh; kuntum berkelompok 3/5 (bukan 4);
 * putih/hitam tak pernah jadi latar dominan.
 */
export default function Meihua({ data }: ThemeComponentProps) {
  const rootClass = `mh ${FONT_VARS}`;
  const { settings } = data;

  if (data.content.category !== "wedding") {
    return (
      <div className={rootClass}>
        <section className="mh-section mh-center">
          <p className="mh-lead">Tema ini khusus untuk undangan pernikahan.</p>
        </section>
      </div>
    );
  }

  const content = data.content;
  const groomName =
    content.groom.nickname || content.groom.name || "Mempelai Pria";
  const brideName =
    content.bride.nickname || content.bride.name || "Mempelai Wanita";

  // Acara utama = yang jatuh pada "Tanggal acara utama" (`eventDate`). Pola
  // meihua menaruh Sangjit lebih dulu di hari lain — `events[0]` membuat
  // sampul & countdown menuju Sangjit, bukan hari pernikahan (§2.4).
  const mainEvent =
    data.events.find(
      (e) =>
        utcToLocal(e.startAt, settings.timezone).slice(0, 10) ===
        data.eventDate,
    ) ?? data.events[0];
  const heroDateLabel = mainEvent
    ? (() => {
        const f = formatEventDateTime(mainEvent.startAt, settings.timezone);
        return f ? `${f.weekday} · ${f.date}` : null;
      })()
    : data.eventDate
      ? (() => {
          const f = formatDateOnly(data.eventDate);
          return f ? `${f.weekday} · ${f.date}` : null;
        })()
      : null;

  const countdownTarget =
    mainEvent?.startAt ??
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
  const resolved = custom ? resolveAppearance(meihuaOptions, custom) : null;

  const sectionNodes: Record<string, ReactNode> = {
    hero: <Hero greetingOpen={content.greetingOpen} />,
    quote: <MaknaBlock quote={content.quote} />,
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
    // Ivory seperti prototipe: guestbook.css bersama mengandaikan latar terang —
    // di gradien merah label formulirnya hanya ±1,3:1.
    rsvp: (
      <section className="mh-section mh-ivory">
        <div className="mh-inner">
          <GuestbookSection slug={data.slug} />
        </div>
      </section>
    ),
  };

  const order =
    resolved?.sections ?? defaultSectionOrder(meihuaOptions, settings);

  const grainOn = resolved ? resolved.grain : true;

  const appearance = resolved
    ? {
        style: appearanceStyle(meihuaOptions.preview.vars, resolved),
        // `variant` → `data-variant` di akar: champagne butuh override token
        // di permukaan merah tua (meihua.css), bukan hanya peta `preview.vars`.
        data: { gallery: resolved.styles.gallery, variant: resolved.variantId },
        motion: resolved.motion,
      }
    : undefined;

  return (
    <CoverGate
      rootClassName={rootClass}
      contentClassName="mh-stage"
      coverClassName="mh-cover"
      musicClassName="mh-music"
      wipeMs={1000}
      music={data.music}
      appearance={appearance}
      cover={
        <MeihuaCover
          brideName={brideName}
          groomName={groomName}
          dateLabel={heroDateLabel}
        />
      }
      fx={<MeihuaFx />}
    >
      {grainOn ? <div className="mh-grain" aria-hidden /> : null}

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

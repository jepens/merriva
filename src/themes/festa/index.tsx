import { Bricolage_Grotesque, Figtree } from "next/font/google";
import type { ReactNode } from "react";

import { GuestbookSection } from "@/components/public/guestbook/guestbook-section";
import { appearanceStyle } from "@/lib/customizer/appearance-style";
import { resolveAppearance } from "@/lib/customizer/resolve";
import {
  formatDateOnly,
  formatEventDateTime,
  localToUtc,
} from "@/lib/datetime";
import { isSectionVisible, type SectionKey } from "@/lib/validation/content";
import { CoverGate } from "@/themes/_shared/cover-gate";
import { Lightbox } from "@/themes/_shared/lightbox";
import type { ThemeComponentProps } from "@/themes/registry";

// CSS tema TIDAK di-import di sini: ia dikirim sebagai aset statis lewat
// `<ThemeStyles slug="festa" />` supaya undangan tak mengunduh stylesheet
// kesepuluh tema (AUDIT PER-2 / DECISIONS #31). Sumbernya tetap ./festa.css
import { FestaCover } from "./cover";
import { FestaFx } from "./fx";
import { L } from "./labels";
import { festaOptions } from "./options";
import {
  CountdownBlock,
  Envelope,
  Footer,
  Gallery,
  Marquee,
  Opening,
  Scallop,
  Schedule,
  Wishes,
} from "./sections";

/** Section yang bisa disembunyikan lewat toggle lama (`settings.sections`). */
const LEGACY_TOGGLE = new Set<SectionKey>([
  "countdown",
  "schedule",
  "gallery",
  "story",
  "envelope",
  "rsvp",
]);
const isLegacyToggle = (id: string): id is SectionKey =>
  LEGACY_TOGGLE.has(id as SectionKey);

// Self-hosted (next/font) → tanpa request eksternal (WebView/LCP). Bricolage
// Grotesque = display ekspresif tebal (nama + judul); Figtree = sans humanis
// (teks). Nuansa hangat & meriah.
// SEMUA instance `preload:false` (AUDIT-2026-09-04 PER-1): `next/font` meng-emit
// `<link rel=preload as=font>` untuk SETIAP tema yang tergabung di graph modul
// `/[slug]`, bukan hanya tema yang dipakai — 116 berkas / 2,03 MB per pembukaan
// undangan. Tanpa preload, `@font-face` + `unicode-range` tetap terbit dan
// browser hanya mengunduh slice yang benar-benar dipakai.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--ft-disp",
  display: "swap",
  preload: false,
});
const body = Figtree({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--ft-body",
  display: "swap",
  preload: false,
});

/**
 * Tema "Festa" (family, tier Craft) — acuan `prototypes/family-warm-craft.html`.
 * MEMBUKA kategori family (khitan, ulang tahun, syukuran). SERVER component:
 * section dirender di server lalu dibungkus `CoverGate` (klien) yang memegang
 * cover + musik (`coverMode:'theme'`); confetti burst saat dibuka via `FestaFx`
 * (ParticlesCanvas — TANPA gsap). TIDAK mengambil data sendiri (SPEC §7.1).
 */
export default function Festa({ data }: ThemeComponentProps) {
  const rootClass = `ft ${display.variable} ${body.variable}`;
  const { settings } = data;

  if (data.content.category !== "family") {
    return (
      <div className={rootClass}>
        <section className="ft-section ft-center">
          <p className="ft-lead">{L.wrongCategory}</p>
        </section>
      </div>
    );
  }

  const c = data.content;
  const firstEvent = data.events[0];
  const eventFmt = firstEvent
    ? formatEventDateTime(firstEvent.startAt, settings.timezone)
    : null;
  const dateOnly =
    !eventFmt && data.eventDate ? formatDateOnly(data.eventDate) : null;

  const dateLabel = eventFmt
    ? `${eventFmt.weekday}, ${eventFmt.date}`
    : dateOnly
      ? `${dateOnly.weekday}, ${dateOnly.date}`
      : null;

  const chips = eventFmt
    ? [eventFmt.weekday, eventFmt.date, `${eventFmt.time} ${eventFmt.tzLabel}`]
    : dateOnly
      ? [dateOnly.weekday, dateOnly.date]
      : [];

  const countdownTarget =
    firstEvent?.startAt ??
    (data.eventDate
      ? localToUtc(`${data.eventDate}T00:00`, settings.timezone)
      : null);

  const bigName = c.celebrant || c.eventName;
  const marqueeText = `${c.eventName}${dateLabel ? ` ✦ ${dateLabel}` : ""} ✦ Mohon Doa Restu ✦`;

  const hasOpening = Boolean(
    c.greetingOpen || c.celebrant || c.parents || c.quote?.text,
  );
  const env = c.envelope;
  const hasEnvelope =
    env.enabled &&
    (env.banks.length > 0 ||
      env.ewallets.length > 0 ||
      Boolean(env.giftAddress));

  const custom = settings.custom ?? null;
  const resolved = custom ? resolveAppearance(festaOptions, custom) : null;

  const sectionNodes: Record<string, ReactNode> = {
    opening: hasOpening ? (
      <Opening
        celebrant={c.celebrant}
        parents={c.parents}
        greetingOpen={c.greetingOpen}
        quote={c.quote?.text ? c.quote : undefined}
      />
    ) : null,
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
    gallery:
      data.media.length > 0 ? (
        <>
          <Scallop teal />
          <Lightbox media={data.media}>
            <Gallery media={data.media} />
          </Lightbox>
        </>
      ) : null,
    story: c.wishes.length > 0 ? <Wishes wishes={c.wishes} /> : null,
    envelope: hasEnvelope ? <Envelope envelope={env} slug={data.slug} /> : null,
    rsvp: (
      <section className="ft-section">
        <div className="ft-inner">
          <GuestbookSection slug={data.slug} />
        </div>
      </section>
    ),
  };

  const order = resolved
    ? resolved.sections
    : festaOptions.sections.map((s) => ({
        id: s.id,
        visible: isLegacyToggle(s.id) ? isSectionVisible(settings, s.id) : true,
      }));

  const grainOn = resolved ? resolved.grain : true;

  const appearance = resolved
    ? {
        style: appearanceStyle(festaOptions.preview.vars, resolved),
        motion: resolved.motion,
      }
    : undefined;

  return (
    <CoverGate
      rootClassName={rootClass}
      contentClassName="ft-stage"
      coverClassName="ft-cover"
      musicClassName="ft-music"
      music={data.music}
      appearance={appearance}
      cover={
        <FestaCover eventName={c.eventName} bigName={bigName} chips={chips} />
      }
      fx={<FestaFx />}
    >
      {grainOn ? <div className="ft-grain" aria-hidden /> : null}

      <Marquee text={marqueeText} />
      <Scallop />

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

      <Footer greetingClose={c.greetingClose} watermark={data.watermark} />
    </CoverGate>
  );
}

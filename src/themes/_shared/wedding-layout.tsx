import { GuestbookSection } from "@/components/public/guestbook/guestbook-section";
import {
  formatDateOnly,
  formatEventDateTime,
  localToUtc,
} from "@/lib/datetime";
import { isSectionVisible } from "@/lib/validation/content";
import { ThemeRoot } from "@/themes/_shared/motion";
import type { InvitationData } from "@/types/invitation";

import {
  Couple,
  CountdownBlock,
  Envelope,
  Footer,
  Gallery,
  Hero,
  QuoteBlock,
  Schedule,
  Story,
  type WeddingLabels,
} from "./wedding-sections";

/**
 * Orkestrasi BERSAMA tema wedding (SPEC §7.1). Merakit section-bersama sesuai
 * `settings.sections`. Tiap tema hanya menyuntik `cx` (prefix kelas), `labels`,
 * dan `rootClass` (font variables) — identitas ada di CSS tema.
 */
export function WeddingLayout({
  data,
  cx,
  labels,
  rootClass,
  wrongCategory,
}: {
  data: InvitationData;
  cx: string;
  labels: WeddingLabels;
  rootClass: string;
  wrongCategory: string;
}) {
  const { settings } = data;

  if (data.content.category !== "wedding") {
    return (
      <ThemeRoot className={rootClass}>
        <section className={`${cx}-section`}>
          <div className={`${cx}-inner`}>
            <p className={`${cx}-lead`}>{wrongCategory}</p>
          </div>
        </section>
      </ThemeRoot>
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
        return f ? `${f.weekday}, ${f.date}` : null;
      })()
    : data.eventDate
      ? (() => {
          const f = formatDateOnly(data.eventDate);
          return f ? `${f.weekday}, ${f.date}` : null;
        })()
      : null;

  const countdownTarget =
    firstEvent?.startAt ??
    (data.eventDate
      ? localToUtc(`${data.eventDate}T00:00`, settings.timezone)
      : null);

  const hasQuote = Boolean(content.greetingOpen || content.quote?.text);
  const env = content.envelope;
  const hasEnvelope =
    env.enabled &&
    (env.banks.length > 0 ||
      env.ewallets.length > 0 ||
      Boolean(env.giftAddress));

  return (
    <ThemeRoot className={rootClass}>
      <Hero
        cx={cx}
        labels={labels}
        groomName={groomName}
        brideName={brideName}
        dateLabel={heroDateLabel}
        bgUrl={data.media[0]?.url}
      />

      {hasQuote ? (
        <QuoteBlock
          cx={cx}
          greetingOpen={content.greetingOpen}
          quote={content.quote?.text ? content.quote : undefined}
        />
      ) : null}

      <Couple
        cx={cx}
        labels={labels}
        groom={content.groom}
        bride={content.bride}
      />

      {isSectionVisible(settings, "countdown") && countdownTarget ? (
        <CountdownBlock cx={cx} labels={labels} targetIso={countdownTarget} />
      ) : null}

      {isSectionVisible(settings, "schedule") && data.events.length > 0 ? (
        <Schedule
          cx={cx}
          labels={labels}
          events={data.events}
          tz={settings.timezone}
          slug={data.slug}
        />
      ) : null}

      {isSectionVisible(settings, "gallery") && data.media.length > 0 ? (
        <Gallery cx={cx} labels={labels} media={data.media} />
      ) : null}

      {isSectionVisible(settings, "story") && content.story.length > 0 ? (
        <Story cx={cx} labels={labels} story={content.story} />
      ) : null}

      {isSectionVisible(settings, "envelope") && hasEnvelope ? (
        <Envelope cx={cx} labels={labels} envelope={env} slug={data.slug} />
      ) : null}

      {isSectionVisible(settings, "rsvp") ? (
        <section className={`${cx}-section`}>
          <div className={`${cx}-inner`}>
            <GuestbookSection slug={data.slug} />
          </div>
        </section>
      ) : null}

      <Footer
        cx={cx}
        labels={labels}
        greetingClose={content.greetingClose}
        groomName={groomName}
        brideName={brideName}
        watermark={data.watermark}
      />
    </ThemeRoot>
  );
}

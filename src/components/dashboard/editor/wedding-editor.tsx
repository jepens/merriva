"use client";

import { copy } from "@/lib/copy";
import type { InvitationMediaView } from "@/types/invitation";

import { EditorShell, type EditorStep } from "./editor-shell";
import { CoupleStep } from "./steps/couple-step";
import { EnvelopeStep } from "./steps/envelope-step";
import { GalleryStep } from "./steps/gallery-step";
import { InfoStep } from "./steps/info-step";
import { ScheduleStep } from "./steps/schedule-step";
import { SettingsStep } from "./steps/settings-step";
import { TimelineStep } from "./steps/timeline-step";
import type { EditorValues } from "./types";

const STEPS: EditorStep[] = [
  {
    key: "info",
    label: copy.editor.steps.info,
    render: (c) => (
      <InfoStep form={c.form} invitationId={c.invitationId} slug={c.slug} />
    ),
    complete: (v) =>
      v.content.category === "wedding" &&
      Boolean(
        v.content.title ||
        (v.content.groom?.nickname && v.content.bride?.nickname) ||
        v.eventDate,
      ),
  },
  {
    key: "couple",
    label: copy.editor.steps.couple,
    render: (c) => <CoupleStep form={c.form} />,
    complete: (v) =>
      v.content.category === "wedding" &&
      Boolean(v.content.groom?.name && v.content.bride?.name),
  },
  {
    key: "schedule",
    label: copy.editor.steps.schedule,
    render: (c) => <ScheduleStep form={c.form} />,
    complete: (v) => v.events.some((e) => Boolean(e.startAt)),
  },
  {
    key: "gallery",
    label: copy.editor.steps.gallery,
    render: (c) => (
      <GalleryStep
        invitationId={c.invitationId}
        maxPhotos={c.maxPhotos}
        media={c.media}
        setMedia={c.setMedia}
      />
    ),
    complete: (_v, mediaCount) => mediaCount > 0,
  },
  {
    key: "story",
    label: copy.editor.steps.story,
    render: (c) => (
      <TimelineStep
        form={c.form}
        name="content.story"
        labels={copy.editor.timeline.wedding}
      />
    ),
    complete: (v) =>
      v.content.category === "wedding" && (v.content.story?.length ?? 0) > 0,
  },
  {
    key: "envelope",
    label: copy.editor.steps.envelope,
    render: (c) => <EnvelopeStep form={c.form} />,
    complete: (v) => Boolean(v.content.envelope?.enabled),
  },
  {
    key: "settings",
    label: copy.editor.steps.settings,
    render: (c) => (
      <SettingsStep
        form={c.form}
        timelineLabel={copy.editor.timeline.wedding.section}
      />
    ),
    complete: (v) => Boolean(v.content.greetingOpen || v.content.greetingClose),
  },
];

/** Editor undangan pernikahan (SPEC §4.4). Kerangka & autosave dari EditorShell. */
export function WeddingEditor(props: {
  invitationId: string;
  slug: string;
  defaultValues: EditorValues;
  initialMedia: InvitationMediaView[];
  maxPhotos: number;
}) {
  return <EditorShell {...props} steps={STEPS} />;
}

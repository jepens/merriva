"use client";

import { copy } from "@/lib/copy";
import { isScheduleComplete } from "@/lib/event-draft";
import type { InvitationMediaView } from "@/types/invitation";

import { EditorShell, type EditorStep } from "./editor-shell";
import { EnvelopeStep } from "./steps/envelope-step";
import { GalleryStep } from "./steps/gallery-step";
import { InfoCorporateStep } from "./steps/info-corporate-step";
import { OrganizerStep } from "./steps/organizer-step";
import { ScheduleStep } from "./steps/schedule-step";
import { SettingsStep } from "./steps/settings-step";
import { TimelineStep } from "./steps/timeline-step";
import type {
  EditorValues,
  PhotoSlots,
  SongOption,
  VideoSlotView,
} from "./types";

const STEPS: EditorStep[] = [
  {
    key: "info",
    label: copy.editor.steps.info,
    render: (c) => (
      <InfoCorporateStep
        form={c.form}
        invitationId={c.invitationId}
        slug={c.slug}
      />
    ),
    complete: (v) =>
      v.content.category === "corporate" &&
      Boolean(v.content.eventName || v.eventDate),
  },
  {
    key: "detail",
    label: copy.editor.steps.detail,
    render: (c) => (
      <OrganizerStep
        form={c.form}
        invitationId={c.invitationId}
        logoSlot={c.photoSlots.logo}
      />
    ),
    complete: (v) =>
      v.content.category === "corporate" &&
      Boolean(v.content.description || v.content.pic?.name),
  },
  {
    key: "schedule",
    label: copy.editor.steps.schedule,
    render: (c) => <ScheduleStep form={c.form} />,
    complete: (v) => isScheduleComplete(v.events),
  },
  {
    key: "gallery",
    label: copy.editor.steps.gallery,
    render: (c) => (
      <GalleryStep
        form={c.form}
        invitationId={c.invitationId}
        coverSlot={c.photoSlots.cover}
        maxPhotos={c.maxPhotos}
        media={c.media}
        setMedia={c.setMedia}
      />
    ),
    complete: (_v, mediaCount) => mediaCount > 0,
  },
  {
    key: "agenda",
    label: copy.editor.steps.agenda,
    render: (c) => (
      <TimelineStep
        form={c.form}
        name="content.agenda"
        labels={copy.editor.timeline.corporate}
      />
    ),
    complete: (v) =>
      v.content.category === "corporate" && (v.content.agenda?.length ?? 0) > 0,
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
        invitationId={c.invitationId}
        songs={c.songs}
        video={c.video}
        timelineLabel={copy.editor.timeline.corporate.section}
      />
    ),
    complete: (v) => Boolean(v.content.greetingOpen || v.content.greetingClose),
  },
];

/** Editor undangan corporate (SPEC §4.4). */
export function CorporateEditor(props: {
  invitationId: string;
  slug: string;
  defaultValues: EditorValues;
  initialMedia: InvitationMediaView[];
  maxPhotos: number;
  songs: SongOption[];
  photoSlots: PhotoSlots;
  video: VideoSlotView;
  initialStep?: string;
}) {
  return <EditorShell {...props} steps={STEPS} />;
}

"use client";

import { copy } from "@/lib/copy";
import { isScheduleComplete } from "@/lib/event-draft";
import type { InvitationMediaView } from "@/types/invitation";

import { EditorShell, type EditorStep } from "./editor-shell";
import { EnvelopeStep } from "./steps/envelope-step";
import { GalleryStep, slotFotoTema } from "./steps/gallery-step";
import { InfoFamilyStep } from "./steps/info-family-step";
import { ScheduleStep } from "./steps/schedule-step";
import { SettingsStep } from "./steps/settings-step";
import { TimelineStep } from "./steps/timeline-step";
import type {
  EditorValues,
  MusicSlotView,
  PhotoSlots,
  SongOption,
  VideoSlotView,
} from "./types";

const STEPS: EditorStep[] = [
  {
    key: "info",
    label: copy.editor.steps.info,
    render: (c) => (
      <InfoFamilyStep
        form={c.form}
        invitationId={c.invitationId}
        slug={c.slug}
      />
    ),
    complete: (v) =>
      v.content.category === "family" &&
      Boolean(v.content.eventName || v.content.celebrant || v.eventDate),
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
        themeSlots={slotFotoTema(c.photoSlots)}
        maxPhotos={c.maxPhotos}
        media={c.media}
        setMedia={c.setMedia}
      />
    ),
    complete: (_v, mediaCount) => mediaCount > 0,
  },
  {
    key: "wishes",
    label: copy.editor.steps.wishes,
    render: (c) => (
      <TimelineStep
        form={c.form}
        name="content.wishes"
        labels={copy.editor.timeline.family}
      />
    ),
    complete: (v) =>
      v.content.category === "family" && (v.content.wishes?.length ?? 0) > 0,
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
        music={c.music}
        video={c.video}
        timelineLabel={copy.editor.timeline.family.section}
      />
    ),
    complete: (v) => Boolean(v.content.greetingOpen || v.content.greetingClose),
  },
];

/** Editor undangan keluarga (SPEC §4.4). */
export function FamilyEditor(props: {
  invitationId: string;
  slug: string;
  defaultValues: EditorValues;
  initialMedia: InvitationMediaView[];
  maxPhotos: number;
  songs: SongOption[];
  photoSlots: PhotoSlots;
  music: MusicSlotView;
  video: VideoSlotView;
  initialStep?: string;
}) {
  return <EditorShell {...props} steps={STEPS} />;
}

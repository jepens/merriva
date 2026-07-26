"use client";

import { useState } from "react";

import { copy } from "@/lib/copy";

import { GuestbookWall } from "./guestbook-wall";
import { RsvpForm } from "./rsvp-form";
import "./guestbook.css";

/**
 * Section RSVP + dinding ucapan (SPEC §4.6). Komponen BERSAMA (lintas tema) —
 * dirender tema di dalam bungkus section-nya; memakai `data.slug` + (kelak)
 * `?g=token`, tanpa mengubah kontrak props tema. Kiriman baru → naikkan
 * `refreshKey` agar dinding memuat ulang.
 */
export function GuestbookSection({
  slug,
  guestToken,
}: {
  slug: string;
  guestToken?: string;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const t = copy.guestbook;

  return (
    <div className="gb">
      <p className="gb-eyebrow">{t.eyebrow}</p>
      <h2 className="gb-heading">{t.heading}</h2>
      <p className="gb-sub">{t.subheading}</p>
      <RsvpForm
        slug={slug}
        guestToken={guestToken}
        onSubmitted={() => setRefreshKey((k) => k + 1)}
      />
      <GuestbookWall slug={slug} refreshKey={refreshKey} />
    </div>
  );
}

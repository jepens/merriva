"use client";

import { useState } from "react";

import { copy } from "@/lib/copy";

import { useGuestContext } from "../guest-context";
import { GuestbookWall } from "./guestbook-wall";
import { RsvpForm } from "./rsvp-form";
import "./guestbook.css";

/**
 * Section RSVP + dinding ucapan (SPEC §4.6). Komponen BERSAMA (lintas tema) —
 * dirender tema di dalam bungkus section-nya; memakai `data.slug` + personalisasi
 * `?g=token` via `GuestContext` (nama prefill + token penaut tamu), tanpa
 * mengubah kontrak props tema. Kiriman baru → naikkan `refreshKey` agar dinding
 * memuat ulang.
 */
export function GuestbookSection({ slug }: { slug: string }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const { recipientName, guestToken } = useGuestContext();
  const t = copy.guestbook;

  return (
    <div className="gb">
      <p className="gb-eyebrow">{t.eyebrow}</p>
      <h2 className="gb-heading">{t.heading}</h2>
      <p className="gb-sub">{t.subheading}</p>
      <RsvpForm
        // Re-mount saat nama prefill tiba (null → nama) agar field terisi otomatis
        // tanpa efek set-state; input pengguna sebelum itu jarang terjadi.
        key={recipientName ?? ""}
        slug={slug}
        guestToken={guestToken ?? undefined}
        prefillName={recipientName ?? undefined}
        onSubmitted={() => setRefreshKey((k) => k + 1)}
      />
      <GuestbookWall slug={slug} refreshKey={refreshKey} />
    </div>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";

import { viewGuestByTokenAction } from "@/server/actions/personalization";

import { GuestContextProvider } from "./guest-context";

/**
 * Penyedia personalisasi tamu (SPEC §4.5) — SATU saluran untuk seluruh cara tema
 * dirender: cover-gate tiap tema (semua tema memegang cover sendiri) dan
 * `/preview/tema/{slug}`.
 *
 * Resolusi dilakukan SETELAH hidrasi dari `?g={token}` / `?to={Nama}` (halaman
 * `/{slug}` tetap ISR — server tak membaca searchParams). Render awal = generik
 * (cocok dgn HTML statis → tanpa mismatch hidrasi), lalu di-update.
 */
export function GuestPersonalizationProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const [guest, setGuest] = useState<{
    name: string | null;
    token: string | null;
  }>({ name: null, token: null });

  // Resolusi selalu lewat promise → setGuest hanya di `.then()` (bukan sinkron di
  // badan efek) demi menghindari cascading render.
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const g = params.get("g");
    const to = params.get("to");
    void (async (): Promise<{ name: string; token: string | null } | null> => {
      if (g) {
        // `?g=token` → resolve nama via server (service-role) + catat first_viewed_at.
        let res = await viewGuestByTokenAction(slug, g);
        // Link undangan biasanya disebar serentak di grup WA → lonjakan tajam.
        // Satu kali coba-ulang ber-jitter menyelamatkan sapaan personal tamu
        // yang kebetulan kena rate limit (AUDIT-2026-09-04 PER-3); tanpa ini
        // penolakan sementara tak bisa dibedakan dari token tak dikenal.
        if (res.status === "rate") {
          await new Promise((r) => setTimeout(r, 1200 + Math.random() * 1800));
          if (!active) return null;
          res = await viewGuestByTokenAction(slug, g);
        }
        return res.status === "ok" ? { name: res.name, token: g } : null;
      }
      if (to) {
        // `?to=Nama` fallback manual (sudah ter-decode oleh URLSearchParams).
        const name = to.replace(/[<>]/g, "").trim().slice(0, 60);
        return name ? { name, token: null } : null;
      }
      return null;
    })().then((r) => {
      if (active && r) setGuest(r);
    });
    return () => {
      active = false;
    };
  }, [slug]);

  return (
    <GuestContextProvider
      value={{ recipientName: guest.name, guestToken: guest.token }}
    >
      {children}
    </GuestContextProvider>
  );
}

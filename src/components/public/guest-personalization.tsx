"use client";

import { useEffect, useState, type ReactNode } from "react";

import { viewGuestByTokenAction } from "@/server/actions/personalization";

import { GuestContextProvider } from "./guest-context";

interface ResolvedGuest {
  name: string | null;
  token: string | null;
}

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
  const [guest, setGuest] = useState<ResolvedGuest>({
    name: null,
    token: null,
  });

  // Resolusi selalu lewat promise → setGuest hanya di `.then()` (bukan sinkron di
  // badan efek) demi menghindari cascading render.
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const g = params.get("g");
    const to = params.get("to");
    void (async (): Promise<ResolvedGuest | null> => {
      if (g) {
        try {
          return await resolveByToken(slug, g, () => active);
        } catch {
          // Aksi MELEMPAR (WiFi venue putus, id aksi basi sesudah deploy)
          // diperlakukan sama dengan status "error": TOKEN tetap dipakai.
          // Dulu lemparan ini tak tertangkap sama sekali — `setGuest` tak
          // pernah jalan, token hilang, dan RSVP tamu kembali tersimpan tanpa
          // tertaut, jumlah orangnya dipotong ke 2 (DECISIONS #46).
          return { name: null, token: g };
        }
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

/**
 * `?g={token}` → nama tamu via server (service-role) + catat `first_viewed_at`.
 * Token dipertahankan pada SETIAP kegagalan sementara: server memvalidasinya
 * ulang saat RSVP/amplop, jadi konfirmasi tamu tetap tertaut dan jatah pax-nya
 * utuh meski sapaannya gagal diambil.
 */
async function resolveByToken(
  slug: string,
  g: string,
  stillActive: () => boolean,
): Promise<ResolvedGuest | null> {
  let res = await viewGuestByTokenAction(slug, g);
  // Link undangan biasanya disebar serentak di grup WA → lonjakan tajam. Satu
  // kali coba-ulang ber-jitter menyelamatkan sapaan personal tamu yang kebetulan
  // kena rate limit (AUDIT-2026-09-04 PER-3) atau kedipan DB (#46); tanpa ini
  // penolakan sementara tak bisa dibedakan dari token tak dikenal.
  if (res.status === "rate" || res.status === "error") {
    await new Promise((r) => setTimeout(r, 1200 + Math.random() * 1800));
    if (!stillActive()) return null;
    res = await viewGuestByTokenAction(slug, g);
  }
  if (res.status === "ok") return { name: res.name, token: g };
  if (res.status === "rate" || res.status === "error") {
    return { name: null, token: g };
  }
  // `none` = token MEMANG tak dikenal → jangan pegang token itu.
  return null;
}

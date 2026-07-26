"use client";

import { createContext, useContext } from "react";

/**
 * Konteks personalisasi tamu (SPEC §4.5). Diisi klien dari `?g={token}` /
 * `?to={Nama}` SETELAH hidrasi (halaman `/{slug}` tetap ISR — tak membaca
 * searchParams di server). Disediakan oleh `InvitationShell`, dikonsumsi oleh
 * cover (nama penerima) & form RSVP (prefill nama + token untuk penautan tamu).
 */
export interface GuestContextValue {
  /** Nama penerima terpersonalisasi, atau null (generik). */
  recipientName: string | null;
  /** Token tamu terdaftar (`?g=`), atau null (tanpa token / `?to=` manual). */
  guestToken: string | null;
}

const GuestContext = createContext<GuestContextValue>({
  recipientName: null,
  guestToken: null,
});

export const GuestContextProvider = GuestContext.Provider;

export function useGuestContext(): GuestContextValue {
  return useContext(GuestContext);
}

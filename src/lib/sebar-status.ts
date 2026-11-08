/**
 * Status penyebaran per tamu di halaman Sebar (SPEC §4.7, DECISIONS #120) —
 * MURNI/teruji, diturunkan dari kolom yang SUDAH ada:
 *
 *   Belum dikirim → Terkirim (`wa_clicked_at`, ditandai pemilik)
 *                → Dibuka (`first_viewed_at`, tamu benar-benar membuka link)
 *                → Hadir / Tidak hadir (RSVP tertaut `guest_id`)
 *
 * Yang tampil adalah status TERTINGGI. "Dibuka" dihitung terkirim walau belum
 * ditandai (tamu jelas sudah menerima linknya, mis. lewat tempel manual), jadi
 * status objektif tak pernah turun karena tanda pemilik dibatalkan.
 */

export type SebarStatus =
  "unsent" | "sent" | "opened" | "attending" | "notAttending";

export type SebarFilter = "unsent" | "sent" | "opened" | "rsvp" | "all";

export interface SebarGuestState {
  sent: boolean;
  opened: boolean;
  rsvp: "yes" | "no" | null;
}

export function sebarStatus(g: SebarGuestState): SebarStatus {
  if (g.rsvp === "yes") return "attending";
  if (g.rsvp === "no") return "notAttending";
  if (g.opened) return "opened";
  if (g.sent) return "sent";
  return "unsent";
}

const PERINGKAT: Record<SebarStatus, number> = {
  unsent: 0,
  sent: 1,
  opened: 2,
  attending: 3,
  notAttending: 3,
};

/**
 * Keanggotaan filter bersifat KUMULATIF: "Terkirim" memuat semua yang sudah
 * sampai (termasuk yang dibuka/RSVP), "Dibuka" memuat yang sudah RSVP. Filter
 * "Belum dikirim" adalah antrean kerja pemilik.
 */
export function matchesFilter(g: SebarGuestState, f: SebarFilter): boolean {
  const p = PERINGKAT[sebarStatus(g)];
  switch (f) {
    case "unsent":
      return p === 0;
    case "sent":
      return p >= 1;
    case "opened":
      return p >= 2;
    case "rsvp":
      return p >= 3;
    case "all":
      return true;
  }
}

export interface SebarCounts {
  total: number;
  sent: number;
  opened: number;
  rsvp: number;
  unsent: number;
}

export function sebarCounts(guests: readonly SebarGuestState[]): SebarCounts {
  const c: SebarCounts = {
    total: guests.length,
    sent: 0,
    opened: 0,
    rsvp: 0,
    unsent: 0,
  };
  for (const g of guests) {
    if (matchesFilter(g, "unsent")) c.unsent += 1;
    if (matchesFilter(g, "sent")) c.sent += 1;
    if (matchesFilter(g, "opened")) c.opened += 1;
    if (matchesFilter(g, "rsvp")) c.rsvp += 1;
  }
  return c;
}

/** Pencarian nama/grup, tak peka huruf besar & spasi ganda. */
export function matchesSearch(
  g: { name: string; groupLabel?: string | null },
  q: string,
): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const needle = norm(q);
  if (!needle) return true;
  return (
    norm(g.name).includes(needle) || norm(g.groupLabel ?? "").includes(needle)
  );
}

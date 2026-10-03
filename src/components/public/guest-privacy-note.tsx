import { copy } from "@/lib/copy";

const g = copy.guestPrivacy;

/**
 * Pemberitahuan privasi di titik pengumpulan data TAMU (AUDIT-2026-10-01).
 *
 * Tamu menyerahkan nama, nomor WhatsApp, ucapan, dan — di Album Momen — foto
 * wajahnya, tanpa pernah punya hubungan apa pun dengan Merriva. Sebelum ini
 * tak satu pun formulir publik menyebut ke mana data itu pergi; `/privasi`
 * hanya tertaut dari footer halaman marketing yang takkan pernah tamu buka.
 *
 * Server Component tanpa `"use client"` dan tanpa `next/link`: halaman undangan
 * punya anggaran bundel 64 KB gzip, dan mem-prefetch halaman marketing tak ada
 * gunanya bagi tamu.
 */
export function GuestPrivacyNote({ className }: { className?: string }) {
  return (
    <p className={className} style={{ fontSize: "0.75rem", opacity: 0.7 }}>
      {g.note}{" "}
      <a href={g.href} target="_blank" rel="noopener noreferrer">
        {g.link}
      </a>
    </p>
  );
}

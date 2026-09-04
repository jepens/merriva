import { copy } from "@/lib/copy";

import "./momen-fab.css";

/**
 * Tombol melayang menuju kamera Album Momen (`/{slug}/momen`). Dirender oleh
 * halaman undangan publik DI LUAR komponen tema — nol perubahan kontrak/kode
 * tema. Hanya ditampilkan bila undangan punya album AKTIF (dicek di server).
 * Tautan `<a>` biasa: navigasi penuh ke pengalaman kamera yang terpisah.
 */
export function MomenFab({ slug }: { slug: string }) {
  return (
    <a
      className="mn-fab"
      href={`/${slug}/momen`}
      aria-label={copy.momen.fab.aria}
    >
      <span className="mn-fab-ic" aria-hidden>
        📸
      </span>
      {copy.momen.fab.label}
    </a>
  );
}

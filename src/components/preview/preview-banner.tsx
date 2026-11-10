import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { copy } from "@/lib/copy";

/** Ajakan aktivasi milik PEMILIK undangan (tak pernah di pratinjau tema publik). */
export interface PreviewActivateCta {
  href: string;
  label: string;
}

/**
 * Chrome pratinjau punya dua wajah yang saling eksklusif: `demo` (showcase tema
 * publik) dan pratinjau pemilik. Union ini membuat kombinasi "demo + CTA
 * pemilik" TAK BISA ditulis — kebocoran CTA ke halaman publik jadi galat
 * kompilasi, bukan bug yang menunggu ketahuan di produksi.
 */
export type PreviewChrome =
  | {
      demo: true;
      editHref?: never;
      backLabel?: never;
      note?: never;
      activate?: never;
    }
  | {
      demo?: false;
      editHref?: string;
      /** Label tautan kembali (bawaan "Edit"). */
      backLabel?: string;
      /**
       * Catatan pratinjau yang WAJIB terbaca juga di ponsel (mis. "belum
       * disimpan" pada pratinjau ganti tema). Bawaannya catatan umum yang
       * disembunyikan di layar sempit.
       */
      note?: string;
      activate?: PreviewActivateCta;
    };

/** Bar tetap penanda mode pratinjau (di atas render tema full-screen). */
export function PreviewBanner({
  demo = false,
  editHref,
  backLabel,
  note,
  activate,
}: PreviewChrome) {
  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 bg-neutral-900/85 px-3 py-2 text-xs text-white backdrop-blur-sm">
      <span className="flex min-w-0 items-center gap-2">
        {demo ? (
          <Link
            href="/tema"
            className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 transition-colors hover:bg-white/25"
          >
            <ArrowLeft size={14} /> {copy.preview.allThemes}
          </Link>
        ) : null}
        <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 font-medium">
          {demo ? copy.preview.demoBadge : copy.preview.badge}
        </span>
        {!demo && note ? (
          <span className="min-w-0 truncate text-white/80">{note}</span>
        ) : !demo ? (
          <span className="hidden text-white/70 sm:inline">
            {copy.preview.note}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {editHref ? (
          <Link
            href={editHref}
            className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 transition-colors hover:bg-white/25"
          >
            <ArrowLeft size={14} /> {backLabel ?? copy.preview.backToEditor}
          </Link>
        ) : demo ? (
          <Link
            href="/"
            className="rounded-full bg-white/15 px-3 py-1 transition-colors hover:bg-white/25"
          >
            {copy.preview.home}
          </Link>
        ) : null}
        {/* Gerbang ganda: tipe melarang `demo` + `activate`, `!demo` menjaganya
            tetap benar bila kelak props datang dari data yang tak ter-cek tipe. */}
        {!demo && activate ? (
          <Link
            href={activate.href}
            className="rounded-full bg-white px-3 py-1 font-medium text-neutral-900 transition-colors hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            {activate.label}
          </Link>
        ) : null}
      </span>
    </div>
  );
}

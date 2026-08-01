import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { copy } from "@/lib/copy";

/** Bar tetap penanda mode pratinjau (di atas render tema full-screen). */
export function PreviewBanner({
  demo = false,
  editHref,
}: {
  demo?: boolean;
  editHref?: string;
}) {
  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 bg-neutral-900/85 px-3 py-2 text-xs text-white backdrop-blur-sm">
      <span className="flex items-center gap-2">
        {demo ? (
          <Link
            href="/tema"
            className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 transition-colors hover:bg-white/25"
          >
            <ArrowLeft size={14} /> {copy.preview.allThemes}
          </Link>
        ) : null}
        <span className="rounded-full bg-white/15 px-2 py-0.5 font-medium">
          {demo ? copy.preview.demoBadge : copy.preview.badge}
        </span>
        {!demo ? (
          <span className="hidden text-white/70 sm:inline">
            {copy.preview.note}
          </span>
        ) : null}
      </span>
      {editHref ? (
        <Link
          href={editHref}
          className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 transition-colors hover:bg-white/25"
        >
          <ArrowLeft size={14} /> {copy.preview.backToEditor}
        </Link>
      ) : demo ? (
        <Link
          href="/"
          className="rounded-full bg-white/15 px-3 py-1 transition-colors hover:bg-white/25"
        >
          {copy.preview.home}
        </Link>
      ) : null}
    </div>
  );
}

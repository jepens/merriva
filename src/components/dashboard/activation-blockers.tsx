import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ActivationBlocker } from "@/lib/activation-readiness";
import { copy } from "@/lib/copy";
import { editorHref } from "@/lib/editor-links";

/** Tujuan perbaikan tiap syarat: alamat ada di atas editor, jadwal di langkahnya. */
function fixHref(invitationId: string, blocker: ActivationBlocker): string {
  return blocker === "schedule"
    ? editorHref(invitationId, "jadwal")
    : editorHref(invitationId);
}

/**
 * Semua syarat bayar yang belum terpenuhi SEKALIGUS (SPEC §4.8 langkah 0,
 * DECISIONS #44). Dulu satu kartu per syarat: pemilik baru tahu jadwalnya kurang
 * setelah alamatnya beres. Tiap butir menautkan langsung ke tempat perbaikannya.
 */
export function ActivationBlockers({
  invitationId,
  blockers,
}: {
  invitationId: string;
  blockers: readonly ActivationBlocker[];
}) {
  return (
    <Card>
      <CardContent className="space-y-5 py-6">
        <div className="space-y-1">
          <h2 className="text-lg font-medium">
            {copy.checkout.readinessTitle}
          </h2>
          <p className="text-muted-foreground text-sm">
            {copy.checkout.readinessIntro}
          </p>
        </div>
        <ul className="space-y-4">
          {blockers.map((blocker) => {
            const text = copy.checkout.readiness[blocker];
            return (
              <li
                key={blocker}
                className="space-y-2 border-t pt-4 first:border-t-0 first:pt-0"
              >
                <h3 className="text-sm font-medium">{text.title}</h3>
                <p className="text-muted-foreground text-sm">{text.body}</p>
                <Link
                  href={fixHref(invitationId, blocker)}
                  className={buttonVariants({ size: "sm" })}
                >
                  {text.cta}
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * Sesi berisi yang belum berjam — TIDAK menghalangi pembayaran, tetapi sesi itu
 * tak akan tampil ke tamu (#42). Disebut di sini agar pemilik tak kaget setelah
 * membayar.
 */
export function UnscheduledNote({
  invitationId,
  names,
}: {
  invitationId: string;
  names: readonly string[];
}) {
  if (names.length === 0) return null;
  return (
    <p className="text-sm text-amber-700 dark:text-amber-400">
      {copy.checkout.unscheduledNote(names)}{" "}
      <Link
        href={editorHref(invitationId, "jadwal")}
        className="font-medium underline underline-offset-4"
      >
        {copy.checkout.unscheduledCta}
      </Link>
    </p>
  );
}

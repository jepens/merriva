"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { moderateRsvpAction } from "@/server/actions/moderation";

export interface RsvpRow {
  id: string;
  guestName: string;
  attendance: "yes" | "no";
  pax: number;
  message: string | null;
  isHidden: boolean;
  isApproved: boolean;
}

/**
 * Daftar & moderasi RSVP (SPEC §4.6). State lokal diperbarui optimistis setelah
 * action sukses (tanpa refresh penuh) — moderasi jarang & tak kritis-realtime.
 * Aksi hanya `setujui` / `sembunyikan` / `tampilkan`; menghapus RSVP bukan hak
 * pemilik (RLS delete = admin saja).
 */
export function GuestbookModeration({
  invitationId,
  initial,
}: {
  invitationId: string;
  initial: RsvpRow[];
}) {
  const t = copy.dashboard.guestbook;
  const [rows, setRows] = useState<RsvpRow[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function apply(
    id: string,
    patch: { isHidden?: boolean; isApproved?: boolean },
  ) {
    if (busyId) return;
    setBusyId(id);
    setError(false);
    const res = await moderateRsvpAction(invitationId, id, patch);
    if (res.status === "success") {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      );
    } else {
      setError(true);
    }
    setBusyId(null);
  }

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">{t.rsvpEmpty}</p>;
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {t.actionError}
        </p>
      ) : null}
      <ul className="space-y-3">
        {rows.map((r) => {
          const busy = busyId === r.id;
          return (
            <li key={r.id}>
              <Card className={cn(r.isHidden && "opacity-60")}>
                <CardContent className="space-y-3 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.guestName}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        r.attendance === "yes"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {r.attendance === "yes" ? t.attending : t.notAttending}
                    </span>
                    {r.attendance === "yes" ? (
                      <span className="text-muted-foreground text-xs">
                        {r.pax} {t.paxUnit}
                      </span>
                    ) : null}
                    {!r.isApproved ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        {t.pendingBadge}
                      </span>
                    ) : null}
                    {r.isHidden ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                        {t.hiddenBadge}
                      </span>
                    ) : null}
                  </div>

                  <p
                    className={cn(
                      "text-sm whitespace-pre-line",
                      r.message
                        ? "text-foreground"
                        : "text-muted-foreground italic",
                    )}
                  >
                    {r.message || t.noMessage}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {!r.isApproved ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => apply(r.id, { isApproved: true })}
                        disabled={busy}
                      >
                        {busy ? t.working : t.approve}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => apply(r.id, { isHidden: !r.isHidden })}
                      disabled={busy}
                    >
                      {busy ? t.working : r.isHidden ? t.unhide : t.hide}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

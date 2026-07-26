"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/lib/copy";
import { fillTemplate, personalLink, waMeUrl } from "@/lib/share-message";
import { markWaClickedAction } from "@/server/actions/guests";

export interface SebarGuest {
  id: string;
  name: string;
  phone: string | null;
  token: string;
  waClicked: boolean;
}

/**
 * Sebar Undangan (SPEC §4.7): template pesan editable ({nama}/{link}/{acara}) →
 * per tamu tombol "Kirim via WA" (`wa.me`, catat `wa_clicked_at`) & "Salin
 * pesan"; plus "Salin semua". Link personal & pesan dirakit di klien (butuh
 * `window.location.origin`).
 */
export function SebarUndangan({
  invitationId,
  slug,
  acara,
  initial,
}: {
  invitationId: string;
  slug: string;
  acara: string;
  initial: SebarGuest[];
}) {
  const t = copy.dashboard.sebar;
  const [template, setTemplate] = useState<string>(t.defaultTemplate);
  const [guests, setGuests] = useState<SebarGuest[]>(initial);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  function messageFor(g: SebarGuest): string {
    const link = personalLink(window.location.origin, slug, g.token);
    return fillTemplate(template, { nama: g.name, link, acara });
  }

  function sendWa(g: SebarGuest) {
    const url = waMeUrl(g.phone, messageFor(g));
    if (!url) return;
    window.open(url, "_blank", "noopener");
    setGuests((prev) =>
      prev.map((x) => (x.id === g.id ? { ...x, waClicked: true } : x)),
    );
    void markWaClickedAction(invitationId, g.id).catch(() => {});
  }

  async function copyMsg(g: SebarGuest) {
    try {
      await navigator.clipboard.writeText(messageFor(g));
      setCopiedId(g.id);
      setTimeout(() => setCopiedId((c) => (c === g.id ? null : c)), 1500);
    } catch {
      // clipboard tak tersedia — abaikan diam-diam.
    }
  }

  async function copyAll() {
    const all = guests.map(messageFor).join("\n\n———\n\n");
    try {
      await navigator.clipboard.writeText(all);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1500);
    } catch {
      // abaikan
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-2 py-5">
          <label htmlFor="tpl" className="text-sm font-medium">
            {t.templateLabel}
          </label>
          <Textarea
            id="tpl"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={7}
          />
          <p className="text-muted-foreground text-xs">{t.templateHint}</p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-medium">{t.guestListTitle}</h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={copyAll}
          disabled={guests.length === 0}
        >
          {copiedAll ? t.copiedAll : t.copyAll}
        </Button>
      </div>

      {guests.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t.empty}</p>
      ) : (
        <ul className="space-y-3">
          {guests.map((g) => (
            <li key={g.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{g.name}</span>
                      {g.waClicked ? (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-800">
                          {t.sent}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {g.phone ?? t.noPhone}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {g.phone ? (
                      <Button type="button" size="sm" onClick={() => sendWa(g)}>
                        {t.waSend}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => copyMsg(g)}
                    >
                      {copiedId === g.id ? t.copied : t.copyMsg}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

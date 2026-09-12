"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { FILM_PRESETS, getFilmPreset } from "@/lib/momen/film-presets";
import { cn } from "@/lib/utils";
import {
  moderateMomenPhotoAction,
  revealMomenNowAction,
  updateMomenSettingsAction,
} from "@/server/actions/momen-manage";

const m = copy.momen.manage;
const field =
  "border-input bg-background h-9 rounded-md border px-3 text-sm w-full";

export interface MomenPhotoRow {
  id: string;
  guestName: string;
  filterId: string;
  thumbUrl: string;
  status: "visible" | "hidden";
  /** Berkas storage sudah dihapus saat moderasi pasca-reveal (KEA-3). */
  purged: boolean;
}

export interface MomenManagerProps {
  invitationId: string;
  guestUrl: string;
  quotaPeserta: number | null;
  photoCount: number;
  participants: number;
  hiddenCount: number;
  /** Dihitung di server (dinamis) — album sudah terbuka untuk tamu. */
  revealed: boolean;
  settings: {
    quotaPerGuest: number;
    revealAt: string | null;
    defaultFilter: string;
    allowLibraryUpload: boolean;
  };
  photos: MomenPhotoRow[];
  /** Tautan "muat lebih" moderasi (server-rendered, `?foto=N`); null = habis. */
  moreHref: string | null;
}

/** datetime-local "YYYY-MM-DDTHH:mm" → ISO dengan offset WIB (+07:00). */
function localToWibIso(local: string): string {
  return `${local}:00+07:00`;
}
/** ISO (mengandung offset) → nilai datetime-local untuk input (jam WIB). */
function isoToWibLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Format komponen dalam zona Asia/Jakarta.
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function MomenManager(props: MomenManagerProps) {
  const { invitationId, guestUrl, quotaPeserta, settings, photos } = props;
  const router = useRouter();

  const [quotaPerGuest, setQuotaPerGuest] = useState(settings.quotaPerGuest);
  const [revealMode, setRevealMode] = useState<"instant" | "schedule">(
    settings.revealAt === null ? "instant" : "schedule",
  );
  const [revealLocal, setRevealLocal] = useState(
    isoToWibLocal(settings.revealAt),
  );
  const [defaultFilter, setDefaultFilter] = useState(settings.defaultFilter);
  const [allowLibrary, setAllowLibrary] = useState(settings.allowLibraryUpload);

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [busyPhoto, setBusyPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealErr, setRevealErr] = useState<string | null>(null);
  const [revealPast, setRevealPast] = useState(false);
  const [copied, setCopied] = useState(false);

  /**
   * Perbandingan waktu dilakukan di HANDLER, bukan saat render — `Date.now()` di
   * badan komponen melanggar `react-hooks/purity`.
   */
  function onRevealLocalChange(value: string) {
    setRevealLocal(value);
    setRevealErr(null);
    setRevealPast(
      value !== "" && new Date(localToWibIso(value)).getTime() <= Date.now(),
    );
  }

  const revealed = props.revealed;
  const pesertaLabel =
    quotaPeserta === null
      ? copy.momen.activate.pesertaUnlimited
      : copy.momen.activate.peserta(quotaPeserta);

  async function saveSettings() {
    setError(null);
    setSavedMsg(null);
    // Mode "Jadwal sendiri" TANPA tanggal sebelumnya tersimpan diam-diam sebagai
    // reveal_at = null = "langsung tampil" — sambil menampilkan "Tersimpan ✓".
    // Blokir di klien (pesan di dekat field) DAN di skema server.
    if (revealMode === "schedule" && !revealLocal) {
      setRevealErr(m.revealNeedsDate);
      return;
    }
    setRevealErr(null);
    setSaving(true);
    try {
      const res = await updateMomenSettingsAction(invitationId, {
        quotaPerGuest,
        revealMode,
        revealAt: revealMode === "schedule" ? localToWibIso(revealLocal) : null,
        defaultFilter,
        allowLibraryUpload: allowLibrary,
      });
      if (res.status === "success") {
        setSavedMsg(m.saved);
        router.refresh();
      } else {
        setError(res.message ?? m.error);
      }
    } finally {
      setSaving(false);
    }
  }

  async function revealNow() {
    if (!window.confirm(m.revealNowConfirm)) return;
    setError(null);
    setRevealing(true);
    try {
      const res = await revealMomenNowAction(invitationId);
      if (res.status === "success") {
        setRevealMode("instant");
        setRevealLocal("");
        setRevealErr(null);
        setRevealPast(false);
        router.refresh();
      } else {
        setError(res.message ?? m.error);
      }
    } finally {
      setRevealing(false);
    }
  }

  async function moderate(photoId: string, action: "hide" | "show" | "delete") {
    if (action === "delete" && !window.confirm(m.delConfirm)) return;
    // Pasca-reveal, "Sembunyikan" IKUT menghapus berkas agar tautan yang sudah
    // tersebar ke tamu benar-benar mati (KEA-3) — permanen, jadi konfirmasi dulu.
    if (
      action === "hide" &&
      revealed &&
      !window.confirm(m.hidePermanentConfirm)
    )
      return;
    setError(null);
    setBusyPhoto(photoId);
    try {
      const res = await moderateMomenPhotoAction(invitationId, {
        photoId,
        action,
      });
      if (res.status === "success") router.refresh();
      else setError(res.message ?? m.error);
    } finally {
      setBusyPhoto(null);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(guestUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard tak tersedia → abaikan */
    }
  }

  return (
    <div className="space-y-5">
      {/* Monitor */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label={m.monitorPhotos} value={props.photoCount} />
        <Stat label={m.monitorParticipants} value={props.participants} />
        <Stat label={m.monitorHidden} value={props.hiddenCount} />
      </div>
      <p className="text-muted-foreground text-xs">
        {m.tierLabel(pesertaLabel)}
      </p>

      {/* Link tamu */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{m.guestLinkTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <input
              readOnly
              value={guestUrl}
              className={cn(field, "font-mono text-xs")}
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyLink}
            >
              {copied ? m.copied : m.copy}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">{m.guestLinkHint}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href={`/dashboard/undangan/${invitationId}/momen/qr`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {m.qrCta}
            </Link>
            <a
              href={`/dashboard/undangan/${invitationId}/momen/zip`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {m.zipCta}
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Pengaturan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{m.settingsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="mn-quota">
              {m.quotaPerGuest}
            </label>
            <input
              id="mn-quota"
              type="number"
              min={1}
              max={20}
              value={quotaPerGuest}
              onChange={(e) =>
                setQuotaPerGuest(
                  Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                )
              }
              className={cn(field, "w-28")}
            />
            <p className="text-muted-foreground text-xs">
              {m.quotaPerGuestHint}
            </p>
          </div>

          <div className="grid gap-1.5">
            <span className="text-sm font-medium">{m.revealTitle}</span>
            {revealed ? (
              <p className="text-muted-foreground text-xs">{m.revealedNote}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={revealMode}
                onChange={(e) => {
                  setRevealMode(e.target.value as "instant" | "schedule");
                  setRevealErr(null);
                }}
                className={cn(field, "w-40")}
              >
                <option value="instant">{m.revealInstant}</option>
                <option value="schedule">{m.revealSchedule}</option>
              </select>
              {revealMode === "schedule" ? (
                <input
                  type="datetime-local"
                  value={revealLocal}
                  onChange={(e) => onRevealLocalChange(e.target.value)}
                  className={cn(field, "w-56")}
                  aria-label={m.revealAtLabel}
                  aria-invalid={revealErr !== null}
                  aria-describedby={revealErr ? "mn-reveal-err" : undefined}
                />
              ) : null}
            </div>
            {revealErr ? (
              <p
                id="mn-reveal-err"
                role="alert"
                className="text-destructive text-xs"
              >
                {revealErr}
              </p>
            ) : null}
            {revealMode === "schedule" && revealPast && !revealErr ? (
              <p className="text-xs text-amber-600">{m.revealPastWarning}</p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="mn-filter">
              {m.defaultFilter}
            </label>
            <select
              id="mn-filter"
              value={defaultFilter}
              onChange={(e) => setDefaultFilter(e.target.value)}
              className={cn(field, "w-40")}
            >
              {FILM_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allowLibrary}
              onChange={(e) => setAllowLibrary(e.target.checked)}
              className="size-4"
            />
            <span>
              {m.allowLibrary}
              <span className="text-muted-foreground block text-xs">
                {m.allowLibraryHint}
              </span>
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={saveSettings}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> {m.saving}
                </>
              ) : (
                m.save
              )}
            </Button>
            {!revealed ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={revealing}
                onClick={revealNow}
              >
                {revealing ? <Loader2 className="size-4 animate-spin" /> : null}
                {m.revealNow}
              </Button>
            ) : null}
            {savedMsg ? (
              <span className="text-xs text-emerald-600">{savedMsg}</span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Moderasi */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{m.moderationTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-xs">{m.moderationHint}</p>
          {photos.length === 0 ? (
            <p className="text-muted-foreground text-sm">{m.moderationEmpty}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((p) => (
                <li
                  key={p.id}
                  className="bg-muted/40 overflow-hidden rounded-lg border"
                >
                  <div className="relative aspect-3/4 bg-black/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.thumbUrl}
                      alt={m.by(p.guestName)}
                      loading="lazy"
                      className={cn(
                        "h-full w-full object-cover",
                        p.status === "hidden" && "opacity-40 grayscale",
                      )}
                    />
                    {p.status === "hidden" ? (
                      <span className="absolute top-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                        {p.purged ? m.purgedBadge : m.hiddenBadge}
                      </span>
                    ) : null}
                  </div>
                  <div className="space-y-1.5 p-2">
                    <p className="truncate text-xs font-medium">
                      {p.guestName}
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      {getFilmPreset(p.filterId).name}
                    </p>
                    <div className="flex gap-1.5">
                      {/* Berkas sudah dihapus → tak ada yang bisa ditampilkan
                          kembali; tombolnya dihilangkan, bukan sekadar mati. */}
                      {p.purged ? null : (
                        <button
                          type="button"
                          disabled={busyPhoto === p.id}
                          onClick={() =>
                            void moderate(
                              p.id,
                              p.status === "hidden" ? "show" : "hide",
                            )
                          }
                          className="rounded border px-2 py-1 text-[11px] font-medium"
                        >
                          {p.status === "hidden" ? m.show : m.hide}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyPhoto === p.id}
                        onClick={() => void moderate(p.id, "delete")}
                        className="text-destructive border-destructive/40 rounded border px-2 py-1 text-[11px] font-medium"
                      >
                        {m.del}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {props.moreHref ? (
            <Link
              href={props.moreHref}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {m.moderationMore}
            </Link>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-3 text-center">
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-muted-foreground text-xs">{label}</p>
      </CardContent>
    </Card>
  );
}

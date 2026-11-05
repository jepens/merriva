"use client";

import { useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { ENCODE_EXT } from "@/lib/image/encode";
import type { Video } from "@/lib/validation/content";
import {
  validateVideoFile,
  validateVideoMeta,
  VIDEO_ACCEPT_ATTR,
} from "@/lib/video";
import { bacaVideo } from "@/lib/video-client";
import {
  deleteInvitationVideoAction,
  type VideoUploadResult,
} from "@/server/actions/video";

const V = copy.editor.video;

/**
 * Blok "Video" di langkah Pengaturan (FASE J): unggah berkas + tautan YouTube
 * (`children`) dalam satu kelompok, karena keduanya SATU fitur — video unggahan
 * menang bila keduanya diisi, dan keduanya digerbang paket yang sama.
 *
 * Alur: tipe & ukuran → metadata dibaca peramban (durasi, landscape) → poster
 * satu bingkai → `POST /api/invitations/{id}/video`. Yang masuk ke form hanya
 * `{ path, poster, width, height, durationSec }`; AUTOSAVE yang menyimpannya
 * (pola foto bernama — route unggah tak menyentuh database).
 *
 * `allowed` = `limits.youtube` paket (dari server). Server tetap menolak
 * sendiri; tombol yang mati di sini hanya penjelasan. Pemilik yang turun paket
 * masih bisa MENGHAPUS video lamanya.
 */
export function VideoField({
  invitationId,
  allowed,
  value,
  initialUrl,
  initialPosterUrl,
  onChange,
  children,
}: {
  invitationId: string;
  allowed: boolean;
  value: Video | undefined;
  /** URL video & poster tersimpan, dirakit di server saat halaman dimuat. */
  initialUrl: string | null;
  initialPosterUrl: string | null;
  onChange: (video: Video | undefined) => void;
  children?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [posterUrl, setPosterUrl] = useState<string | null>(initialPosterUrl);
  const [busy, setBusy] = useState<"reading" | "working" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function buangObjek(v: Video | undefined) {
    if (!v) return;
    void deleteInvitationVideoAction(
      invitationId,
      v.poster ? [v.path, v.poster] : [v.path],
    );
  }

  function bersihkanInput() {
    // Supaya memilih BERKAS YANG SAMA lagi tetap memicu `change`.
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    const masalahBerkas = validateVideoFile(file);
    if (masalahBerkas) {
      setError(V.errors[masalahBerkas]);
      bersihkanInput();
      return;
    }
    try {
      setBusy("reading");
      const baca = await bacaVideo(file);
      const masalahMeta = baca ? validateVideoMeta(baca.meta) : "unreadable";
      if (!baca || masalahMeta) {
        setError(V.errors[masalahMeta ?? "unreadable"]);
        return;
      }

      setBusy("working");
      const fd = new FormData();
      fd.append("video", file);
      if (baca.poster) {
        fd.append(
          "poster",
          baca.poster.blob,
          `poster.${ENCODE_EXT[baca.poster.format]}`,
        );
      }
      const res = await fetch(`/api/invitations/${invitationId}/video`, {
        method: "POST",
        body: fd,
      });
      const hasil = (await res
        .json()
        .catch(() => null)) as VideoUploadResult | null;
      if (!hasil || hasil.status !== "success") {
        setError(V.errors[hasil?.reason ?? "server"]);
        return;
      }

      const lama = value;
      onChange({
        ...hasil.video,
        width: baca.meta.width,
        height: baca.meta.height,
        durationSec: Math.round(baca.meta.durationSec * 100) / 100,
      });
      setUrl(hasil.url);
      setPosterUrl(hasil.posterUrl);
      buangObjek(lama);
    } catch {
      setError(V.errors.server);
    } finally {
      setBusy(null);
      bersihkanInput();
    }
  }

  function onRemove() {
    const lama = value;
    setError(null);
    onChange(undefined);
    setUrl(null);
    setPosterUrl(null);
    buangObjek(lama);
  }

  const punyaVideo = Boolean(value && url);

  return (
    <fieldset className="space-y-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">{V.legend}</legend>
      <p className="text-muted-foreground text-xs">{V.priority}</p>
      {!allowed ? (
        <p className="text-muted-foreground text-xs font-medium">{V.locked}</p>
      ) : null}

      <div className="space-y-2">
        <span className="text-sm font-medium">{V.fileLabel}</span>
        {punyaVideo ? (
          <video
            src={url as string}
            poster={posterUrl ?? undefined}
            controls
            playsInline
            preload="metadata"
            aria-label={V.preview}
            className="bg-muted w-full max-w-xs rounded-lg border"
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!allowed || busy !== null}
            onClick={() => inputRef.current?.click()}
          >
            {busy === "reading"
              ? V.reading
              : busy === "working"
                ? V.working
                : punyaVideo
                  ? V.replace
                  : V.add}
          </Button>
          {punyaVideo ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy !== null}
              onClick={onRemove}
            >
              {V.remove}
            </Button>
          ) : null}
        </div>

        <p className="text-muted-foreground text-xs">{V.limits}</p>

        <input
          ref={inputRef}
          type="file"
          accept={VIDEO_ACCEPT_ATTR}
          hidden
          aria-label={V.fileLabel}
          onChange={(e) => onFile(e.target.files)}
        />

        {error ? (
          <p role="alert" className="text-destructive text-xs">
            {error}
          </p>
        ) : null}
      </div>

      {children}
    </fieldset>
  );
}

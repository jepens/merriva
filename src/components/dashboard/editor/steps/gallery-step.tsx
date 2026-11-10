"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import type { Photo } from "@/lib/validation/content";
import { compressToWebpVariants, isSupportedImage } from "@/lib/image/compress";
import { MEDIA_MAX_BYTES } from "@/lib/media";
import { cn } from "@/lib/utils";
import {
  deleteGalleryPhotoAction,
  uploadGalleryPhotoAction,
} from "@/server/actions/media";
import type { InvitationMediaView } from "@/types/invitation";

import { PhotoField } from "../photo-field";
import type { EditorValues, PhotoSlotView } from "../types";

/**
 * Langkah Galeri (SPEC §4.4 step 4). Kompresi 2 varian WebP di klien lalu unggah
 * satu foto per aksi (sekuensial → progres jelas di 4G & menghindari balapan
 * limit). State foto dikendalikan `WeddingEditor` agar centang langkah hidup &
 * bertahan saat pindah langkah. Limit paket tetap ditegakkan di server.
 */
export function GalleryStep({
  form,
  invitationId,
  coverSlot,
  maxPhotos,
  media,
  setMedia,
  showGallery = true,
}: {
  form: UseFormReturn<EditorValues>;
  invitationId: string;
  /** Slot foto pratinjau tautan (dirender `/api/og`, bukan tema); `undefined` = bidangnya tak ditampilkan. */
  coverSlot: PhotoSlotView | undefined;
  maxPhotos: number;
  media: InvitationMediaView[];
  setMedia: Dispatch<SetStateAction<InvitationMediaView[]>>;
  /**
   * `false` = tema aktif tak punya section galeri: pengunggah & daftar galeri
   * tak ditawarkan, karena fotonya memakan kuota paket tanpa pernah tampil.
   */
  showGallery?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cover = form.watch("content.coverPhoto") as Photo | undefined;
  const [pending, setPending] = useState(0);
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const busy = pending > 0;
  const full = media.length + pending >= maxPhotos;

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    let slots = maxPhotos - media.length - pending;
    for (const file of Array.from(files)) {
      if (slots <= 0) {
        setError(copy.editor.gallery.limitReached);
        break;
      }
      if (!isSupportedImage(file)) {
        setError(copy.editor.gallery.invalidFile);
        continue;
      }
      slots -= 1;
      setPending((n) => n + 1);
      try {
        const c = await compressToWebpVariants(file);
        if (c.display.size > MEDIA_MAX_BYTES.display) {
          setError(copy.editor.gallery.tooLarge);
          slots += 1;
          continue;
        }
        const fd = new FormData();
        fd.append("display", c.display, "1600.webp");
        fd.append("thumb", c.thumb, "400.webp");
        fd.append("width", String(c.width));
        fd.append("height", String(c.height));
        const res = await uploadGalleryPhotoAction(invitationId, fd);
        if (res.status === "success") {
          setMedia((m) => [...m, res.item]);
        } else {
          setError(res.message ?? copy.editor.gallery.error);
          slots += 1;
          if (res.reason === "limit") break;
        }
      } catch {
        setError(copy.editor.gallery.error);
        slots += 1;
      } finally {
        setPending((n) => n - 1);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onRemove(id: string) {
    setError(null);
    setRemoving((s) => new Set(s).add(id));
    const idx = media.findIndex((x) => x.id === id);
    const removed = idx >= 0 ? media[idx] : null;
    setMedia((m) => m.filter((x) => x.id !== id));
    const res = await deleteGalleryPhotoAction(invitationId, id);
    if (res.status !== "success") {
      // Rollback FUNGSIONAL: sisipkan kembali di posisi semula tanpa menimpa
      // perubahan lain (mis. foto yang baru diunggah saat delete berlangsung).
      if (removed) {
        setMedia((m) =>
          m.some((x) => x.id === id)
            ? m
            : [...m.slice(0, idx), removed, ...m.slice(idx)],
        );
      }
      setError(res.message ?? copy.editor.gallery.error);
    }
    setRemoving((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }

  // Foto sampul: satu foto bernama, DI LUAR batas foto paket (batas itu
  // tentang galeri). Ia selalu dirender `/api/og` sebagai pratinjau tautan
  // WhatsApp — jadi tetap ada walau tema tak punya galeri — dan tema yang
  // mendeklarasikan slot `cover` (`inTheme`) juga memajangnya di halamannya.
  const sampul = coverSlot ? (
    <>
      <PhotoField
        invitationId={invitationId}
        label={
          coverSlot.inTheme
            ? copy.editor.photo.coverLabelInTheme
            : copy.editor.photo.coverLabel
        }
        hint={
          coverSlot.inTheme
            ? copy.editor.photo.coverHintInTheme
            : copy.editor.photo.coverHint
        }
        aspect={coverSlot.aspect}
        value={cover}
        initialUrl={coverSlot.url}
        withOg
        // Tanpa `shouldDirty` — lihat couple-step.tsx (TypeError RHF 7.90).
        onChange={(next) => form.setValue("content.coverPhoto", next)}
      />
      <hr className="border-border" />
    </>
  ) : null;

  if (!showGallery) {
    return (
      <div className="space-y-4">
        {sampul}
        <p className="text-muted-foreground text-sm">
          {copy.editor.gallery.notInTheme}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sampul}

      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          {copy.editor.gallery.addHint}
        </p>
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {media.length} / {maxPhotos} {copy.editor.gallery.photosLabel}
        </span>
      </div>

      {media.length > maxPhotos ? (
        <p
          role="status"
          className="text-xs font-medium text-amber-700 dark:text-amber-400"
        >
          {copy.editor.gallery.overLimit(maxPhotos)}
        </p>
      ) : null}

      {media.length === 0 && pending === 0 ? (
        <p className="text-muted-foreground text-sm">
          {copy.editor.gallery.empty}
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {media.map((photo) => (
            <li
              key={photo.id}
              className="group bg-muted relative aspect-square overflow-hidden rounded-lg border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.thumbUrl}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => onRemove(photo.id)}
                disabled={removing.has(photo.id)}
                aria-label={copy.editor.gallery.remove}
                // Selalu terlihat (owner mengedit di HP → tak ada hover).
                className="bg-background/80 hover:bg-background absolute top-1 right-1 rounded-full border px-2 py-0.5 text-xs opacity-90 transition-opacity focus-visible:opacity-100 disabled:opacity-50"
              >
                {removing.has(photo.id) ? "…" : "✕"}
              </button>
            </li>
          ))}
          {Array.from({ length: pending }).map((_, i) => (
            <li
              key={`pending-${i}`}
              className="bg-muted text-muted-foreground flex aspect-square animate-pulse items-center justify-center rounded-lg border text-[10px]"
            >
              {copy.editor.gallery.working}
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => onFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy || full}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? copy.editor.gallery.working : copy.editor.gallery.add}
      </Button>

      {error ? (
        <p role="alert" className={cn("text-destructive text-xs")}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

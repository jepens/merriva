"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import {
  compressToWebpVariants,
  isSupportedImage,
  type CompressedPhoto,
} from "@/lib/image/compress";
import { MEDIA_MAX_BYTES } from "@/lib/media";
import {
  deleteNamedPhotoAction,
  uploadNamedPhotoAction,
} from "@/server/actions/named-photo";

import { PhotoCropper } from "./photo-cropper";

/**
 * Satu foto BERNAMA di editor — sampul, mempelai, atau logo (SPEC §4.4
 * langkah 2). Kompresi 2 varian WebP di klien, sama seperti galeri.
 *
 * Yang disimpan ke form hanyalah PATH-nya; autosave editor yang menuliskannya
 * ke `content`. Aksi unggah sengaja tak menyentuh database — lihat alasannya di
 * `server/actions/named-photo.ts` (singkatnya: autosave mengirim seluruh
 * `content`, jadi tulisan dari dua arah akan saling menimpa).
 *
 * Mengganti foto selalu menghasilkan path BARU lalu menghapus objek lama:
 * media disajikan `immutable` setahun, jadi menimpa path yang sama akan
 * membuat tamu tetap melihat foto lama sampai undangannya kedaluwarsa.
 *
 * Dengan `aspect`, berkas yang dipilih melewati pemangkas (geser + perbesar)
 * dan HASIL PANGKASANNYA yang diunggah — tema tak menerima parameter apa pun
 * (DECISIONS #84). Tanpa `aspect`, seluruh gambar diunggah apa adanya.
 */
export function PhotoField({
  invitationId,
  label,
  hint,
  aspect,
  value,
  initialUrl,
  onChange,
}: {
  invitationId: string;
  label: string;
  hint?: string;
  /** lebar / tinggi bingkai pangkas; tanpa ini, tak ada pemangkasan. */
  aspect?: number;
  /** Path tersimpan di form (`content.groom.photo`, `content.coverPhoto`, …). */
  value: string | undefined;
  /** URL foto tersimpan, dirakit di server saat halaman dimuat. */
  initialUrl: string | null;
  onChange: (path: string | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Berkas yang sedang dipangkas; `null` = tak ada pemangkasan berjalan. */
  const [dipangkas, setDipangkas] = useState<File | null>(null);

  /** Buang objek lama tanpa menahan UI — rujukannya sudah dilepas form. */
  function buangObjek(path: string | undefined) {
    if (!path) return;
    void deleteNamedPhotoAction(invitationId, path);
  }

  function bersihkanInput() {
    // Supaya memilih BERKAS YANG SAMA lagi tetap memicu `change`.
    if (inputRef.current) inputRef.current.value = "";
  }

  async function unggah(c: CompressedPhoto) {
    setBusy(true);
    try {
      if (c.display.size > MEDIA_MAX_BYTES.display) {
        setError(copy.editor.gallery.tooLarge);
        return;
      }
      const fd = new FormData();
      fd.append("display", c.display, "1600.webp");
      fd.append("thumb", c.thumb, "400.webp");
      const res = await uploadNamedPhotoAction(invitationId, fd);
      if (res.status !== "success") {
        setError(res.message ?? copy.editor.gallery.error);
        return;
      }
      const lama = value;
      onChange(res.path);
      setUrl(res.url);
      buangObjek(lama);
    } catch {
      setError(copy.editor.gallery.error);
    } finally {
      setBusy(false);
      setDipangkas(null);
      bersihkanInput();
    }
  }

  async function onFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    if (!isSupportedImage(file)) {
      setError(copy.editor.gallery.invalidFile);
      bersihkanInput();
      return;
    }
    if (aspect) {
      // Pemangkas yang memegang berkasnya sampai pemilik menekan "Simpan".
      setDipangkas(file);
      return;
    }
    try {
      await unggah(await compressToWebpVariants(file));
    } catch {
      setError(copy.editor.gallery.error);
      setBusy(false);
      bersihkanInput();
    }
  }

  function onRemove() {
    const lama = value;
    setError(null);
    onChange(undefined);
    setUrl(null);
    buangObjek(lama);
  }

  const punyaFoto = Boolean(value && url);

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>

      {dipangkas ? (
        <PhotoCropper
          file={dipangkas}
          aspect={aspect as number}
          onCancel={() => {
            setDipangkas(null);
            bersihkanInput();
          }}
          onDone={unggah}
        />
      ) : (
        <div className="flex items-start gap-3">
          <div className="bg-muted text-muted-foreground flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border text-[10px]">
            {busy ? (
              <span className="animate-pulse">{copy.editor.photo.working}</span>
            ) : punyaFoto ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={url as string}
                alt={copy.editor.photo.preview}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <span aria-hidden>—</span>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                {punyaFoto ? copy.editor.photo.replace : copy.editor.photo.add}
              </Button>
              {punyaFoto ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={onRemove}
                >
                  {copy.editor.photo.remove}
                </Button>
              ) : null}
            </div>
            <p className="text-muted-foreground text-xs">
              {hint ?? copy.editor.photo.hint}
            </p>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        aria-label={label}
        onChange={(e) => onFile(e.target.files)}
      />

      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}

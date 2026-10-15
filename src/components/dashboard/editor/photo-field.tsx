"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import {
  compressCoverVariants,
  type CompressedPhoto,
  compressToWebpVariants,
  isSupportedImage,
} from "@/lib/image/compress";
import { geserFokus } from "@/lib/image/focus";
import { MEDIA_MAX_BYTES, OG_VARIANT } from "@/lib/media";
import { PHOTO_MAX_ZOOM, type Photo } from "@/lib/validation/content";
import {
  deleteNamedPhotoAction,
  uploadNamedPhotoAction,
} from "@/server/actions/named-photo";
import { fotoStyle } from "@/themes/_shared/foto";

/**
 * Satu foto BERNAMA di editor — sampul, mempelai, atau logo (SPEC §4.4
 * langkah 2). Kompresi 2 varian WebP di klien, sama seperti galeri.
 *
 * Berkasnya diunggah UTUH; yang bisa disesuaikan pemilik hanyalah ANGKA —
 * titik fokus dan perbesaran (THEME-CONTRACT §3). Karena itu penyesuaian bisa
 * diubah kapan saja tanpa unggah ulang, tak pernah menurunkan mutu, dan rasio
 * pangkasnya milik TEMA: bingkai di bawah memakai `fotoStyle` yang sama persis
 * dengan yang dipakai tema, jadi yang dilihat pemilik = yang dilihat tamu.
 *
 * Yang masuk ke form hanyalah `{ path, x, y, zoom }`; autosave editor yang
 * menuliskannya ke `content`. Aksi unggah sengaja tak menyentuh database —
 * lihat `server/actions/named-photo.ts`.
 */
export function PhotoField({
  invitationId,
  label,
  hint,
  aspect,
  value,
  initialUrl,
  onChange,
  withOg = false,
}: {
  invitationId: string;
  label: string;
  hint?: string;
  /** lebar / tinggi wadah foto ini DI TEMA yang sedang dipakai. */
  aspect: number;
  value: Photo | undefined;
  /** URL varian display foto tersimpan, dirakit di server saat halaman dimuat. */
  initialUrl: string | null;
  onChange: (photo: Photo | undefined) => void;
  /**
   * Ikut menghasilkan varian JPEG untuk pratinjau tautan. HANYA foto sampul:
   * `/api/og` satu-satunya pembacanya, dan satori tak bisa meraster WebP.
   */
  withOg?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const seretRef = useRef<{ x: number; y: number } | null>(null);

  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buangObjek(path: string | undefined) {
    if (!path) return;
    void deleteNamedPhotoAction(invitationId, path);
  }

  function bersihkanInput() {
    // Supaya memilih BERKAS YANG SAMA lagi tetap memicu `change`.
    if (inputRef.current) inputRef.current.value = "";
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
    setBusy(true);
    try {
      // Anotasi eksplisit: penyempitan `in` pada union ini menghasilkan `{}`,
      // bukan `Blob`, sehingga `c.og` tak bisa dipakai tanpa cast.
      const c: CompressedPhoto & { og?: Blob | null } = withOg
        ? await compressCoverVariants(file)
        : await compressToWebpVariants(file);
      if (c.display.size > MEDIA_MAX_BYTES.display) {
        setError(copy.editor.gallery.tooLarge);
        return;
      }
      const fd = new FormData();
      fd.append("display", c.display, "1600.webp");
      fd.append("thumb", c.thumb, "400.webp");
      // Tak dikirim bila peramban tak menyerahkan JPEG — pratinjau tautan lalu
      // jatuh ke tipografi, dan unggahannya tetap berhasil.
      if (c.og) fd.append("og", c.og, OG_VARIANT.file);
      const res = await uploadNamedPhotoAction(invitationId, fd);
      if (res.status !== "success") {
        setError(res.message ?? copy.editor.gallery.error);
        return;
      }
      const lama = value?.path;
      // Foto baru selalu mulai dari titik tengah tanpa perbesaran — penyesuaian
      // foto LAMA tak boleh ikut menempel ke foto yang baru saja dipilih.
      onChange({ path: res.path, x: 0.5, y: 0.5, zoom: 1 });
      setUrl(res.url);
      buangObjek(lama);
    } catch {
      setError(copy.editor.gallery.error);
    } finally {
      setBusy(false);
      bersihkanInput();
    }
  }

  function onRemove() {
    const lama = value?.path;
    setError(null);
    onChange(undefined);
    setUrl(null);
    buangObjek(lama);
  }

  function geser(dx: number, dy: number) {
    const box = boxRef.current;
    const img = imgRef.current;
    if (!box || !img || !value) return;
    const next = geserFokus(
      value,
      dx,
      dy,
      { w: box.clientWidth, h: box.clientHeight },
      { w: img.naturalWidth, h: img.naturalHeight },
    );
    onChange({ ...value, ...next });
  }

  function mulaiSeret(e: React.PointerEvent<HTMLDivElement>) {
    if (!value) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    seretRef.current = { x: e.clientX, y: e.clientY };
  }

  function saatSeret(e: React.PointerEvent<HTMLDivElement>) {
    const awal = seretRef.current;
    if (!awal) return;
    geser(e.clientX - awal.x, e.clientY - awal.y);
    seretRef.current = { x: e.clientX, y: e.clientY };
  }

  function selesaiSeret(e: React.PointerEvent<HTMLDivElement>) {
    seretRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  const punyaFoto = Boolean(value && url);

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>

      {punyaFoto ? (
        <div className="space-y-2">
          <div
            ref={boxRef}
            onPointerDown={mulaiSeret}
            onPointerMove={saatSeret}
            onPointerUp={selesaiSeret}
            onPointerCancel={selesaiSeret}
            style={{ width: 160, aspectRatio: String(aspect) }}
            // `touch-none`: tanpa ini, menyeret di HP menggulung halaman alih-alih
            // menggeser foto.
            className="bg-muted touch-none overflow-hidden rounded-lg border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={url as string}
              alt={copy.editor.photo.preview}
              draggable={false}
              className="h-full w-full"
              style={fotoStyle(value as Photo)}
            />
          </div>

          <label className="block space-y-1" style={{ maxWidth: 160 }}>
            <span className="text-xs font-medium">
              {copy.editor.photo.zoom}
            </span>
            <input
              type="range"
              min={1}
              max={PHOTO_MAX_ZOOM}
              step={0.01}
              value={value?.zoom ?? 1}
              disabled={busy}
              onChange={(e) =>
                value && onChange({ ...value, zoom: Number(e.target.value) })
              }
              className="w-full"
            />
          </label>

          <p className="text-muted-foreground text-xs">
            {copy.editor.photo.adjustHint}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy
            ? copy.editor.photo.working
            : punyaFoto
              ? copy.editor.photo.replace
              : copy.editor.photo.add}
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

      {!punyaFoto ? (
        <p className="text-muted-foreground text-xs">
          {hint ?? copy.editor.photo.hint}
        </p>
      ) : null}

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

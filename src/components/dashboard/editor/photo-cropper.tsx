"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import {
  cropToVariants,
  loadBitmap,
  type CompressedPhoto,
} from "@/lib/image/compress";
import { cropFrom, geser, MAX_ZOOM } from "@/lib/image/crop";

/**
 * Pemangkas foto mempelai — geser & perbesar sebelum unggah (DECISIONS #84).
 *
 * Yang dipangkas di sini DIPANGGANG ke berkas yang diunggah; tema tidak
 * menerima parameter penyesuaian apa pun, jadi tak ada kontrak props yang
 * berubah dan kesepuluh tema tak tersentuh.
 *
 * Inline, bukan modal: belum ada primitif Dialog di proyek ini, dan pemilik
 * sering mengedit dari HP — panel yang mengembang di tempat tak perlu
 * perangkap fokus dan tak pernah tertutup papan ketik layar.
 *
 * Perbesaran lewat SLIDER, bukan cubit dua jari: slider bekerja sama di tetikus
 * dan sentuh, dan tak berebut gestur dengan penggeseran halaman.
 */
export function PhotoCropper({
  file,
  aspect,
  onCancel,
  onDone,
}: {
  file: File;
  /** lebar / tinggi bingkai; 0,8 = 4:5 potret. */
  aspect: number;
  onCancel: () => void;
  onDone: (hasil: CompressedPhoto) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const seretRef = useRef<{ x: number; y: number } | null>(null);

  const [siap, setSiap] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pusat, setPusat] = useState({ cx: 0.5, cy: 0.5 });
  const [lebar, setLebar] = useState(240);

  const tinggi = Math.round(lebar / aspect);

  useEffect(() => {
    let dibuang = false;
    loadBitmap(file)
      .then((b) => {
        if (dibuang) {
          b.close();
          return;
        }
        bitmapRef.current = b;
        setSiap(true);
      })
      .catch(() => setGalat(copy.editor.gallery.invalidFile));
    return () => {
      dibuang = true;
      bitmapRef.current?.close();
      bitmapRef.current = null;
    };
  }, [file]);

  // Bingkai mengikuti lebar kolom (editor dipakai dari HP).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ukur = () => setLebar(Math.max(140, Math.min(260, el.clientWidth)));
    ukur();
    const ro = new ResizeObserver(ukur);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const gambar = useCallback(() => {
    const bm = bitmapRef.current;
    const cv = canvasRef.current;
    if (!bm || !cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(lebar * dpr);
    cv.height = Math.round(tinggi * dpr);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const c = cropFrom(bm.width, bm.height, aspect, zoom, pusat.cx, pusat.cy);
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(bm, c.sx, c.sy, c.sw, c.sh, 0, 0, cv.width, cv.height);
  }, [aspect, lebar, tinggi, zoom, pusat]);

  useEffect(() => {
    if (siap) gambar();
  }, [siap, gambar]);

  function mulaiSeret(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!siap) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    seretRef.current = { x: e.clientX, y: e.clientY };
  }

  function seret(e: React.PointerEvent<HTMLCanvasElement>) {
    const awal = seretRef.current;
    const bm = bitmapRef.current;
    if (!awal || !bm) return;
    const c = cropFrom(bm.width, bm.height, aspect, zoom, pusat.cx, pusat.cy);
    const next = geser(
      pusat.cx,
      pusat.cy,
      e.clientX - awal.x,
      e.clientY - awal.y,
      c,
      bm.width,
      bm.height,
      lebar,
      tinggi,
    );
    seretRef.current = { x: e.clientX, y: e.clientY };
    setPusat(next);
  }

  function selesaiSeret(e: React.PointerEvent<HTMLCanvasElement>) {
    seretRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  async function simpan() {
    const bm = bitmapRef.current;
    if (!bm) return;
    setSibuk(true);
    setGalat(null);
    try {
      const c = cropFrom(bm.width, bm.height, aspect, zoom, pusat.cx, pusat.cy);
      onDone(await cropToVariants(bm, c));
    } catch {
      setGalat(copy.editor.gallery.error);
      setSibuk(false);
    }
  }

  return (
    <div ref={wrapRef} className="space-y-3">
      <p className="text-muted-foreground text-xs">
        {copy.editor.photo.cropHint}
      </p>

      <canvas
        ref={canvasRef}
        onPointerDown={mulaiSeret}
        onPointerMove={seret}
        onPointerUp={selesaiSeret}
        onPointerCancel={selesaiSeret}
        style={{ width: lebar, height: tinggi }}
        aria-label={copy.editor.photo.cropFrame}
        role="img"
        // `touch-none`: tanpa ini, menyeret di HP menggulung halaman alih-alih
        // menggeser foto.
        className="bg-muted touch-none rounded-lg border"
      />

      <label className="block space-y-1">
        <span className="text-xs font-medium">{copy.editor.photo.zoom}</span>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          disabled={!siap || sibuk}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full"
          style={{ maxWidth: lebar }}
        />
      </label>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!siap || sibuk}
          onClick={simpan}
        >
          {sibuk ? copy.editor.photo.working : copy.editor.photo.cropSave}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={sibuk}
          onClick={onCancel}
        >
          {copy.editor.photo.cropCancel}
        </Button>
      </div>

      {galat ? (
        <p role="alert" className="text-destructive text-xs">
          {galat}
        </p>
      ) : null}
    </div>
  );
}

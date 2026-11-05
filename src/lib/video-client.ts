import { encodeCanvas, type EncodedFormat } from "@/lib/image/encode";
import { MEDIA_VARIANTS } from "@/lib/media";

/**
 * Pembacaan video DI PERAMBAN untuk editor (FASE J): metadata + satu bingkai
 * poster. Server tak mentranskode dan tak bisa membaca durasi maupun dimensi,
 * jadi aturan ≤60 dtk & landscape (`validateVideoMeta`) hanya bisa ditegakkan
 * dari angka yang dibaca di sini.
 *
 * Poster di-encode lewat util foto yang sudah ada (`encodeCanvas`): WebP, atau
 * JPEG di Safari/iOS yang diam-diam mengembalikan PNG untuk `toBlob('image/webp')`.
 * Poster OPSIONAL — peramban yang bisa membaca metadata tetapi gagal menggambar
 * bingkainya tetap boleh mengunggah; videonya tampil tanpa poster.
 */

export interface VideoMeta {
  durationSec: number;
  width: number;
  height: number;
}

export interface VideoReadResult {
  meta: VideoMeta;
  poster: { blob: Blob; format: EncodedFormat } | null;
}

/** Detik bingkai poster — lewat bingkai hitam pembuka yang lazim. */
const POSTER_AT_SEC = 0.5;

function tunggu(el: HTMLVideoElement, event: string, ms: number) {
  return new Promise<void>((resolve, reject) => {
    const selesai = (ok: boolean) => {
      clearTimeout(timer);
      el.removeEventListener(event, onOk);
      el.removeEventListener("error", onErr);
      if (ok) resolve();
      else reject(new Error(`video: ${event} gagal`));
    };
    const onOk = () => selesai(true);
    const onErr = () => selesai(false);
    const timer = setTimeout(() => selesai(false), ms);
    el.addEventListener(event, onOk);
    el.addEventListener("error", onErr);
  });
}

async function posterDari(
  el: HTMLVideoElement,
): Promise<VideoReadResult["poster"]> {
  try {
    el.currentTime = Math.min(POSTER_AT_SEC, el.duration / 2);
    await tunggu(el, "seeked", 8000);
    const skala = Math.min(1, MEDIA_VARIANTS.display.maxWidth / el.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(el.videoWidth * skala);
    canvas.height = Math.round(el.videoHeight * skala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
    return await encodeCanvas(canvas, MEDIA_VARIANTS.display.quality);
  } catch {
    return null;
  }
}

/** `null` = peramban tak bisa membaca videonya (codec/berkas rusak). */
export async function bacaVideo(file: File): Promise<VideoReadResult | null> {
  const url = URL.createObjectURL(file);
  const el = document.createElement("video");
  el.muted = true;
  el.playsInline = true;
  // `auto`, bukan `metadata`: iOS tak memuat data bingkai dengan `metadata`,
  // sehingga `seeked` tak pernah datang dan poster selalu kosong.
  el.preload = "auto";
  el.src = url;
  try {
    await tunggu(el, "loadedmetadata", 15000);
    const meta = {
      durationSec: el.duration,
      width: el.videoWidth,
      height: el.videoHeight,
    };
    return { meta, poster: await posterDari(el) };
  } catch {
    return null;
  } finally {
    el.removeAttribute("src");
    el.load();
    URL.revokeObjectURL(url);
  }
}

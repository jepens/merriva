"use client";

import { Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { youtubeEmbedUrl, youtubePosterUrl, youtubeVideoId } from "./youtube";

/**
 * Pemutar video BERSAMA untuk section "video" semua tema (FASE J). Logika di
 * sini, TAMPILAN di CSS tema lewat kelas generik (`video-frame`, `video-el`,
 * `video-mute`, `video-lite`, `video-play`) yang di-scope kelas akar tema —
 * pola yang sama dengan `Countdown` di `_shared/motion.tsx`.
 *
 * Dua sumber, prioritas file unggahan (bila keduanya diisi):
 * - FILE (`video`): autoplay senyap + loop saat terlihat (IntersectionObserver
 *   play/pause — hemat baterai & data), tombol toggle suara. Saat
 *   `prefers-reduced-motion`: TANPA autoplay — poster + kontrol native.
 * - YOUTUBE (`youtubeUrl`): facade ringan (poster i.ytimg.com + tombol putar);
 *   iframe youtube-nocookie baru dibuat SETELAH klik → tanpa beban pihak
 *   ketiga saat halaman dimuat (LCP aman, SPEC §10).
 *
 * Semua API dijaga keberadaannya (jsdom/WebView lama): `play()` di-catch,
 * IntersectionObserver & matchMedia opsional.
 */

export interface VideoView {
  url: string;
  posterUrl: string | null;
  width: number | null;
  height: number | null;
}

export interface VideoLabels {
  /** aria-label tombol putar facade YouTube. */
  play: string;
  /** aria-label tombol saat video senyap (aksi: nyalakan suara). */
  unmute: string;
  /** aria-label tombol saat suara menyala (aksi: senyapkan). */
  mute: string;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function FileVideo({
  video,
  labels,
}: {
  video: VideoView;
  labels: VideoLabels;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  // `null` sampai efek klien berjalan (render server = hidrasi identik);
  // setelahnya menentukan autoplay vs kontrol native (reduced-motion).
  const [autoplay, setAutoplay] = useState<boolean | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // React tidak selalu menulis atribut `muted` ke DOM — pastikan lewat
    // properti agar kebijakan autoplay browser terpenuhi.
    el.muted = true;
    el.defaultMuted = true;

    // setState di dalam rAF (bukan sinkron di badan efek) → hindari cascading
    // render & aman hidrasi — pola yang sama dengan `Reveal` (_shared/motion).
    const reduced = prefersReducedMotion();
    const raf = requestAnimationFrame(() => setAutoplay(!reduced));
    if (reduced) return () => cancelAnimationFrame(raf);

    const play = () => {
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    };
    if (typeof IntersectionObserver === "undefined") {
      play();
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) play();
        else el.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  const toggleMute = () => {
    const el = ref.current;
    if (!el) return;
    const next = !muted;
    el.muted = next ? true : false;
    if (!next) {
      el.volume = 1;
      // Gestur pengguna — boleh (re)mulai pemutaran bersuara.
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
    setMuted(next);
  };

  const ratio =
    video.width && video.height ? `${video.width} / ${video.height}` : "16 / 9";

  return (
    <div
      className="video-frame video-frame--file"
      style={{ aspectRatio: ratio }}
    >
      <video
        ref={ref}
        className="video-el"
        src={video.url}
        poster={video.posterUrl ?? undefined}
        playsInline
        muted
        loop
        preload="metadata"
        controls={autoplay === false}
      />
      {autoplay !== false ? (
        <button
          type="button"
          className="video-mute"
          aria-label={muted ? labels.unmute : labels.mute}
          aria-pressed={!muted}
          onClick={toggleMute}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      ) : null}
    </div>
  );
}

function LiteYouTube({ id, labels }: { id: string; labels: VideoLabels }) {
  const [active, setActive] = useState(false);

  if (active) {
    return (
      <div className="video-frame video-frame--yt">
        <iframe
          className="video-el"
          src={youtubeEmbedUrl(id)}
          title="YouTube"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }
  return (
    <div className="video-frame video-frame--yt">
      <button
        type="button"
        className="video-lite"
        aria-label={labels.play}
        onClick={() => setActive(true)}
        style={{ backgroundImage: `url(${youtubePosterUrl(id)})` }}
      >
        <span className="video-play" aria-hidden>
          <Play size={22} fill="currentColor" />
        </span>
      </button>
    </div>
  );
}

/**
 * Pintu masuk tema. Mengembalikan `null` bila tak ada sumber valid — tema
 * memeriksa `hasThemeVideo(...)` lebih dulu untuk section gating, tapi
 * komponen tetap aman dipanggil langsung.
 */
export function ThemeVideo({
  video,
  youtubeUrl,
  labels,
}: {
  video?: VideoView | null;
  youtubeUrl?: string | null;
  labels: VideoLabels;
}) {
  if (video) return <FileVideo video={video} labels={labels} />;
  const id = youtubeVideoId(youtubeUrl);
  if (id) return <LiteYouTube id={id} labels={labels} />;
  return null;
}

/** Gating section: ada video unggahan ATAU tautan YouTube yang bisa di-embed. */
export function hasThemeVideo(
  video: VideoView | null | undefined,
  youtubeUrl: string | null | undefined,
): boolean {
  return Boolean(video) || youtubeVideoId(youtubeUrl) !== null;
}

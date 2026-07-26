"use client";

import { Mail, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { copy } from "@/lib/copy";

import "./invitation-shell.css";

export interface CoverInfo {
  /** Nama penerima (fallback generik di M2.1; personalisasi `?g=` menyusul). */
  recipient: string;
  kicker: string;
  title: string;
  dateLabel: string | null;
  bgUrl?: string;
}

/**
 * Cangkang undangan publik (M2.1): cover fullscreen "Kepada Yth." + tombol Buka
 * dan tombol musik mengambang. Membungkus keluaran tema (`children`) TANPA
 * mengubah kontrak props tema. Konten tema selalu ada di DOM (baik untuk ISR/
 * SEO/LCP & WebView WA); cover hanya lapisan visual yang muncul setelah JS jalan
 * (`.inv-js`) → tanpa JS konten langsung terlihat (degradasi anggun).
 */
export function InvitationShell({
  cover,
  music,
  children,
}: {
  cover: CoverInfo;
  music: { url: string; title: string } | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Tandai JS aktif lewat kelas (bukan setState → hindari set-state-in-effect).
  // Tanpa JS kelas tak pernah ditambah → cover tak tampil, konten langsung terlihat.
  useEffect(() => {
    shellRef.current?.classList.add("inv-js");
  }, []);

  // Kunci scroll body selama cover masih menutup (hanya berlaku saat JS jalan).
  useEffect(() => {
    if (open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Isolasi konten di balik cover: selama cover menutup, konten dibuat `inert`
  // (keluar dari urutan tab & pohon aksesibilitas) agar keyboard/pembaca layar
  // tak "menembus" cover — cerminan status visual. Diterapkan HANYA via efek
  // klien → tanpa JS tak ada cover MAUPUN inert (konten tetap dapat diakses).
  // Saat dibuka: lepas inert lalu pindahkan fokus ke konten (fokus tak
  // tertinggal di tombol Buka yang jadi aria-hidden).
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (open) {
      el.removeAttribute("inert");
      el.focus({ preventScroll: true });
    } else {
      el.setAttribute("inert", "");
    }
  }, [open]);

  const handleOpen = () => {
    setOpen(true);
    const audio = audioRef.current;
    if (audio) {
      // Klik Buka = gesture pengguna → autoplay diizinkan browser.
      audio.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    }
  };

  const toggleMusic = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(
        () => setPlaying(true),
        () => {},
      );
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  const t = copy.public;
  const shellClass = `inv-shell${open ? " inv-open" : ""}`;

  return (
    <div ref={shellRef} className={shellClass}>
      <div ref={contentRef} className="inv-content" tabIndex={-1}>
        {children}
      </div>

      <div
        className="inv-cover"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inv-cover-title"
        aria-hidden={open}
      >
        {cover.bgUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="inv-cover__bg"
              src={cover.bgUrl}
              alt=""
              aria-hidden
              fetchPriority="high"
              decoding="async"
            />
            <div className="inv-cover__scrim" aria-hidden />
          </>
        ) : null}
        <p className="inv-cover__label">{t.cover.recipient}</p>
        <p className="inv-cover__recipient">{cover.recipient}</p>
        <p className="inv-cover__invited">{t.cover.invited}</p>
        <p className="inv-cover__kicker">{cover.kicker}</p>
        <h1 id="inv-cover-title" className="inv-cover__title">
          {cover.title}
        </h1>
        {cover.dateLabel ? (
          <p className="inv-cover__date">{cover.dateLabel}</p>
        ) : null}
        <button
          type="button"
          className="inv-cover__open"
          onClick={handleOpen}
          tabIndex={open ? -1 : 0}
        >
          <Mail size={18} aria-hidden />
          {t.cover.open}
        </button>
      </div>

      {music ? (
        <>
          <audio ref={audioRef} src={music.url} loop preload="none" />
          <button
            type="button"
            className="inv-music"
            onClick={toggleMusic}
            aria-label={playing ? t.music.pause : t.music.play}
            aria-pressed={playing}
          >
            {playing ? (
              <Pause size={18} aria-hidden />
            ) : (
              <Play size={18} aria-hidden />
            )}
          </button>
        </>
      ) : null}
    </div>
  );
}

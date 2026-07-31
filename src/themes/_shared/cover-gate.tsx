"use client";

import { Pause, Play } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { useGuestContext } from "@/components/public/guest-context";
import { copy } from "@/lib/copy";

import { useMotionTier } from "./use-motion-tier";

/**
 * Gerbang "Buka Undangan" BERSAMA (THEME-PORTING §2c). MEKANIKA TUNGGAL untuk
 * SEMUA tema `coverMode:'theme'` — tak disalin per-tema:
 *  - state `opened`, kunci scroll body selama tertutup, `inert` + fokus konten
 *  - elemen `<audio>` + mulai-saat-gesture (klik Buka), tombol putar/jeda
 *  - kelas `is-js` (konten terbaca tanpa JS), `is-motion` (reduced-motion aware),
 *    `is-open` (menyetir wipe cover via CSS tema — TANPA gsap → aman tier Craft)
 *  - membuang cover dari DOM setelah wipe (transitionend/fallback)
 *
 * Tema hanya menyuplai VISUAL + koreografi lewat slot `cover`/`fx` (elemen klien
 * yang membaca `useCoverGate()`), dan `children` = SECTION SERVER (di-pass apa
 * adanya → tetap SSR/ISR untuk SEO & LCP; §0.1).
 */
interface CoverGateValue {
  opened: boolean;
  open: () => void;
  recipientName: string | null;
  motionOn: boolean;
  richOn: boolean;
  /** Akar tema — scope untuk `useThemeMotion`/`gsap.context`. */
  rootRef: RefObject<HTMLDivElement | null>;
}

const CoverGateContext = createContext<CoverGateValue | null>(null);

export function useCoverGate(): CoverGateValue {
  const v = useContext(CoverGateContext);
  if (!v)
    throw new Error("useCoverGate hanya boleh dipakai di dalam <CoverGate>");
  return v;
}

export function CoverGate({
  rootClassName,
  coverClassName,
  musicClassName,
  contentClassName,
  music,
  cover,
  fx,
  wipeMs = 1100,
  children,
}: {
  /** Kelas akar tema (prefix + font variables). */
  rootClassName: string;
  /** Kelas kontainer cover (fixed) — tema menyetir wipe via `.is-open`. */
  coverClassName: string;
  /** Kelas tombol musik mengambang (styled tema). */
  musicClassName: string;
  contentClassName?: string;
  music: { url: string; title: string } | null;
  /** Visual cover (elemen klien; membaca `useCoverGate`). */
  cover: ReactNode;
  /** Overlay klien (petals + pengendali motion; membaca `useCoverGate`). */
  fx?: ReactNode;
  /** Durasi wipe cover (ms) untuk fallback pembuangan cover. */
  wipeMs?: number;
  /** SECTION SERVER — dirender di server, di-pass apa adanya. */
  children: ReactNode;
}) {
  const { recipientName } = useGuestContext();
  const { motionOn, richOn } = useMotionTier();
  const [opened, setOpened] = useState(false);
  const [coverGone, setCoverGone] = useState(false);
  const [playing, setPlaying] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // is-js + is-motion — ditambah SETELAH mount (tanpa JS/motion konten terbaca).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    el.classList.add("is-js");
    el.classList.toggle("is-motion", motionOn);
  }, [motionOn]);

  // Cermin state terbuka ke kelas (menyetir CSS wipe & visibilitas musik).
  useEffect(() => {
    rootRef.current?.classList.toggle("is-open", opened);
  }, [opened]);

  // Kunci scroll body selama cover menutup (hanya saat JS jalan).
  useEffect(() => {
    if (opened) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [opened]);

  // Isolasi konten di balik cover (inert), lalu pindah fokus saat dibuka.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (opened) {
      el.removeAttribute("inert");
      el.focus({ preventScroll: true });
    } else {
      el.setAttribute("inert", "");
    }
  }, [opened]);

  const open = () => {
    if (opened) return;
    setOpened(true);
    const audio = audioRef.current;
    if (audio) {
      // Klik Buka = gesture pengguna → autoplay diizinkan.
      audio.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    }
    // Buang cover setelah wipe (transitionend + fallback). Reduced-motion =
    // langsung buang (tanpa transisi).
    if (!motionOn) {
      setCoverGone(true);
      return;
    }
    const el = coverRef.current;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setCoverGone(true);
    };
    // Hanya transisi pada ELEMEN cover sendiri yang menandai wipe selesai. Tema
    // dengan animasi cover berlapis (mis. bar letterbox noir) memicu transitionend
    // anak yang ikut menggelembung → jangan membuang cover terlalu dini.
    const onEnd = (e: TransitionEvent) => {
      if (e.target === el) finish();
    };
    el?.addEventListener("transitionend", onEnd);
    window.setTimeout(finish, wipeMs + 300);
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

  return (
    <CoverGateContext.Provider
      value={{ opened, open, recipientName, motionOn, richOn, rootRef }}
    >
      <div ref={rootRef} className={rootClassName}>
        <div ref={contentRef} className={contentClassName} tabIndex={-1}>
          {children}
        </div>

        {fx}

        {!coverGone ? (
          <div
            ref={coverRef}
            className={coverClassName}
            role="dialog"
            aria-modal="true"
            aria-hidden={opened}
          >
            {cover}
          </div>
        ) : null}

        {music ? (
          <>
            <audio ref={audioRef} src={music.url} loop preload="none" />
            <button
              type="button"
              className={musicClassName}
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
    </CoverGateContext.Provider>
  );
}

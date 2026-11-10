"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { copy } from "@/lib/copy";
import type { InvitationMediaView } from "@/types/invitation";

import "./lightbox.css";

/**
 * Lightbox galeri BERSAMA (dipakai 10 tema). `Lightbox` menyediakan context +
 * overlay fullscreen; `LightboxThumb` mengganti `<img>` galeri polos (tetap anak
 * langsung `<figure>`/`<div>` → CSS tema utuh) menjadi pemicu yang membuka foto
 * ukuran penuh (`m.url`). Overlay: klik latar/Esc menutup, ←/→ & swipe berpindah,
 * scroll dikunci, fokus dijebak, hormati `prefers-reduced-motion` (via CSS).
 *
 * Track galeri horizontal yang diberi `data-lb-scroll` juga bisa digeser dengan
 * MOUSE (drag) — sentuh/pena sudah native. Overlay di-portal ke `document.body`:
 * di preview mengisi iframe bingkai ponsel, di halaman publik mengisi viewport.
 */
const LightboxCtx = createContext<(index: number) => void>(() => {});

export function Lightbox({
  media,
  children,
}: {
  media: InvitationMediaView[];
  children: ReactNode;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const open = useCallback((i: number) => setIndex(i), []);

  // Track galeri horizontal (`data-lb-scroll`): auto-scroll kanan→kiri ala
  // marquee (loop mulus via klon) + bisa di-drag mouse (sentuh/pena native).
  // Jeda saat hover/drag; nonaktif saat reduced-motion; track grid (multi-baris)
  // dilewati otomatis.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const cleanups: Array<() => void> = [];
    root.querySelectorAll<HTMLElement>("[data-lb-scroll]").forEach((el) => {
      let down = false;
      let startX = 0;
      let startLeft = 0;
      let moved = false;
      const onDown = (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        if (el.scrollWidth <= el.clientWidth) return;
        down = true;
        moved = false;
        startX = e.clientX;
        startLeft = el.scrollLeft;
      };
      const onMove = (e: PointerEvent) => {
        if (!down) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 3) moved = true;
        el.scrollLeft = startLeft - dx;
      };
      const onUp = () => {
        down = false;
      };
      // Cegah klik membuka lightbox tepat setelah men-drag.
      const onClickCapture = (e: MouseEvent) => {
        if (moved) {
          e.stopPropagation();
          e.preventDefault();
          moved = false;
        }
      };
      el.addEventListener("pointerdown", onDown);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      el.addEventListener("click", onClickCapture, true);
      cleanups.push(() => {
        el.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        el.removeEventListener("click", onClickCapture, true);
      });

      // Marquee auto-scroll — hanya track satu-baris yang meluber horizontal.
      // Lewati bila reduced-motion, grid (multi-baris), tak meluber, atau tema
      // di-set motion "calm" (kustomisasi Fase G).
      const singleRow = el.scrollHeight <= el.clientHeight + 8;
      if (
        reduce ||
        !singleRow ||
        el.scrollWidth <= el.clientWidth ||
        el.closest('[data-motion="calm"]')
      )
        return;
      const half = el.scrollWidth; // lebar item asli (sebelum klon)
      const originalCount = el.children.length;
      Array.from(el.children).forEach((node) => {
        const clone = node.cloneNode(true) as HTMLElement;
        clone.setAttribute("aria-hidden", "true");
        clone.querySelectorAll<HTMLElement>(".lb-thumb").forEach((img) => {
          img.setAttribute("data-lb-clone", "1");
          img.setAttribute("tabindex", "-1");
          img.removeAttribute("role");
        });
        el.appendChild(clone);
      });
      const prevSnap = el.style.scrollSnapType;
      el.style.scrollSnapType = "none";
      // Klik pada klon (tanpa handler React) → buka lightbox indeks terkait.
      const onCloneClick = (e: MouseEvent) => {
        const img = (e.target as HTMLElement).closest("[data-lb-clone]");
        if (!img) return;
        const idx = Number(img.getAttribute("data-lb-index"));
        if (Number.isInteger(idx)) open(idx);
      };
      el.addEventListener("click", onCloneClick);
      let paused = false;
      const pause = () => {
        paused = true;
      };
      const resume = () => {
        paused = false;
      };
      el.addEventListener("pointerenter", pause);
      el.addEventListener("pointerleave", resume);
      el.addEventListener("focusin", pause);
      el.addEventListener("focusout", resume);
      let raf = 0;
      // Akumulasi posisi di JS (bukan `scrollLeft += 0.4` yang dibulatkan
      // browser ke 0 tiap frame → tak pernah bergerak).
      let pos = el.scrollLeft;
      const step = () => {
        if (paused || down) {
          pos = el.scrollLeft; // ikuti posisi manual saat jeda/drag
        } else {
          pos += 0.4;
          if (pos >= half) pos -= half;
          el.scrollLeft = pos;
        }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      cleanups.push(() => {
        cancelAnimationFrame(raf);
        el.removeEventListener("click", onCloneClick);
        el.removeEventListener("pointerenter", pause);
        el.removeEventListener("pointerleave", resume);
        el.removeEventListener("focusin", pause);
        el.removeEventListener("focusout", resume);
        el.style.scrollSnapType = prevSnap;
        while (el.children.length > originalCount) {
          el.removeChild(el.lastChild as ChildNode);
        }
      });
    });
    return () => cleanups.forEach((c) => c());
  }, [open]);

  return (
    <div ref={rootRef} style={{ display: "contents" }}>
      <LightboxCtx.Provider value={open}>{children}</LightboxCtx.Provider>
      {index !== null ? (
        <LightboxOverlay
          media={media}
          index={index}
          onIndex={setIndex}
          onClose={() => setIndex(null)}
        />
      ) : null}
    </div>
  );
}

/** Thumbnail galeri yang membuka lightbox. Menggantikan `<img>` polos per tema. */
export function LightboxThumb({
  m,
  index,
  eager = false,
  sizes,
}: {
  m: InvitationMediaView;
  index: number;
  eager?: boolean;
  /**
   * Opsional: untuk ubin selebar kolom. Bila diisi, kedua varian (400 & 1600
   * px) ditawarkan lewat `srcSet` dan browser memilih sesuai layar — thumb
   * 400 px saja pecah di ubin ±360 CSS px pada DPR 2–3. Tanpa `sizes` (ubin
   * kecil, bawaan semua tema): hanya thumb, seperti sebelumnya.
   */
  sizes?: string;
}) {
  const open = useContext(LightboxCtx);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="lb-thumb"
      src={m.thumbUrl}
      srcSet={sizes ? `${m.thumbUrl} 400w, ${m.url} 1600w` : undefined}
      sizes={sizes}
      alt=""
      loading={eager ? "eager" : "lazy"}
      width={m.width ?? undefined}
      height={m.height ?? undefined}
      role="button"
      tabIndex={0}
      aria-label={copy.public.gallery.enlarge}
      data-lb-index={index}
      onClick={() => open(index)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open(index);
        }
      }}
    />
  );
}

function LightboxOverlay({
  media,
  index,
  onIndex,
  onClose,
}: {
  media: InvitationMediaView[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const count = media.length;
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const go = useCallback(
    (d: number) => onIndex((index + d + count) % count),
    [index, count, onIndex],
  );

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        go(-1);
      } else if (e.key === "ArrowRight") {
        go(1);
      } else if (e.key === "Tab") {
        // Jebak fokus di dalam overlay.
        const nodes = overlayRef.current?.querySelectorAll<HTMLElement>(
          "button:not([tabindex='-1'])",
        );
        if (!nodes || nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [go, onClose]);

  const m = media[index];
  if (!m || typeof document === "undefined") return null;
  const t = copy.public.gallery;

  return createPortal(
    <div
      ref={overlayRef}
      className="lb-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t.dialog}
    >
      <button
        type="button"
        className="lb-backdrop"
        tabIndex={-1}
        aria-label={t.close}
        onClick={onClose}
      />
      {count > 1 ? (
        <button
          type="button"
          className="lb-btn lb-prev"
          aria-label={t.prev}
          onClick={() => go(-1)}
        >
          <ChevronLeft size={26} aria-hidden />
        </button>
      ) : null}
      <figure
        className="lb-figure"
        onTouchStart={(e) => {
          touchX.current = e.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX.current;
          if (Math.abs(dx) > 40 && count > 1) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="lb-full"
          src={m.url}
          alt=""
          width={m.width ?? undefined}
          height={m.height ?? undefined}
        />
        {count > 1 ? (
          <figcaption className="lb-count">
            {index + 1} / {count}
          </figcaption>
        ) : null}
      </figure>
      {count > 1 ? (
        <button
          type="button"
          className="lb-btn lb-next"
          aria-label={t.next}
          onClick={() => go(1)}
        >
          <ChevronRight size={26} aria-hidden />
        </button>
      ) : null}
      <button
        ref={closeRef}
        type="button"
        className="lb-btn lb-close"
        aria-label={t.close}
        onClick={onClose}
      >
        <X size={22} aria-hidden />
      </button>
    </div>,
    document.body,
  );
}

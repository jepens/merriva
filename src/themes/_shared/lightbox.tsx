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

  // Drag-to-scroll (mouse) pada track galeri horizontal ber-`data-lb-scroll`.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
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
    });
    return () => cleanups.forEach((c) => c());
  }, []);

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
}: {
  m: InvitationMediaView;
  index: number;
  eager?: boolean;
}) {
  const open = useContext(LightboxCtx);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="lb-thumb"
      src={m.thumbUrl}
      alt=""
      loading={eager ? "eager" : "lazy"}
      width={m.width ?? undefined}
      height={m.height ?? undefined}
      role="button"
      tabIndex={0}
      aria-label={copy.public.gallery.enlarge}
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

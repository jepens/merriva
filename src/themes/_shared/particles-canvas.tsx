"use client";

import { useEffect, useRef } from "react";

/**
 * Partikel canvas 2D ringan (THEME-PORTING §2e) — parameter PERSIS dari
 * prototipe. Dua preset:
 *  - `petals`   : 24 kelopak mawar jatuh perlahan (eternal-rose), alpha .14–.34,
 *    sway sinus — jalan terus selagi `active`, pause saat tab tersembunyi.
 *  - `confetti` : burst 90 keping saat dibuka (festa), auto-stop ±3,5 dtk.
 * Mulai saat `active` menjadi true (dipicu `onOpen` cover-gate).
 */
export function ParticlesCanvas({
  preset,
  active,
  className,
}: {
  preset: "petals" | "confetti";
  active: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  const resumeRef = useRef<() => void>(() => {});

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    let W = 0;
    let H = 0;
    let raf = 0;
    let disposed = false;
    let startedAt = 0;

    const size = () => {
      W = cv.width = Math.max(1, Math.floor(window.innerWidth * DPR));
      H = cv.height = Math.max(1, Math.floor(window.innerHeight * DPR));
    };
    size();

    // --- Preset: petals (eternal-rose) ---------------------------------------
    type Petal = {
      x: number;
      y: number;
      s: number;
      vy: number;
      ph: number;
      vr: number;
      a: number;
      hue: string;
    };
    let petals: Petal[] = [];
    const makePetal = (): Petal => ({
      x: Math.random() * W,
      y: -30 * DPR - Math.random() * H * 0.3,
      s: (3.5 + Math.random() * 5.5) * DPR,
      vy: (0.28 + Math.random() * 0.55) * DPR,
      ph: Math.random() * Math.PI * 2,
      vr: 0.004 + Math.random() * 0.009,
      a: 0.14 + Math.random() * 0.2,
      hue: Math.random() < 0.7 ? "183,110,121" : "217,165,173",
    });
    const stepPetals = (now: number) => {
      void now;
      if (disposed) return;
      if (!activeRef.current || document.hidden) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(stepPetals);
      ctx.clearRect(0, 0, W, H);
      for (const p of petals) {
        p.y += p.vy;
        p.ph += p.vr;
        p.x += Math.sin(p.ph) * 0.6 * DPR;
        if (p.y > H + 40 * DPR) {
          p.y = -30 * DPR;
          p.x = Math.random() * W;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.sin(p.ph) * 0.9);
        ctx.fillStyle = `rgba(${p.hue},${p.a})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.s, p.s * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    // --- Preset: confetti (festa) --------------------------------------------
    type Piece = {
      x: number;
      y: number;
      w: number;
      h: number;
      vy: number;
      vx: number;
      r: number;
      vr: number;
      c: string;
    };
    const COLORS = ["#F5B93F", "#E56A4E", "#2E7D6B", "#FFD98A", "#fff"];
    let pieces: Piece[] = [];
    const makePieces = (): Piece[] =>
      Array.from({ length: 90 }, () => ({
        x: W / 2 + (Math.random() - 0.5) * W * 0.5,
        y: -20 * DPR - Math.random() * H * 0.2,
        w: (5 + Math.random() * 6) * DPR,
        h: (8 + Math.random() * 8) * DPR,
        vy: (2.2 + Math.random() * 2.6) * DPR,
        vx: (Math.random() - 0.5) * 1.6 * DPR,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.22,
        c: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      }));
    const stepConfetti = (now: number) => {
      if (disposed) return;
      ctx.clearRect(0, 0, W, H);
      if (now - startedAt > 3500) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(stepConfetti);
      for (const p of pieces) {
        p.y += p.vy;
        p.x += p.vx;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
    };

    const start = () => {
      if (disposed || raf || !activeRef.current || document.hidden) return;
      if (preset === "petals") {
        if (petals.length === 0) petals = Array.from({ length: 24 }, makePetal);
        raf = requestAnimationFrame(stepPetals);
      } else {
        pieces = makePieces(); // burst segar tiap kali dinyalakan
        startedAt = performance.now();
        raf = requestAnimationFrame(stepConfetti);
      }
    };
    resumeRef.current = start;

    const onResize = () => size();
    window.addEventListener("resize", onResize, { passive: true });
    // Petals lanjut saat tab kembali; confetti = burst sekali (tak diulang).
    const onVis = () => {
      if (preset === "petals") start();
    };
    document.addEventListener("visibilitychange", onVis);
    if (activeRef.current) start();

    return () => {
      disposed = true;
      resumeRef.current = () => {};
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [preset]);

  // Sinkronkan flag & nyalakan saat `active` true (efek utama tak jalan ulang).
  useEffect(() => {
    activeRef.current = active;
    if (active) resumeRef.current();
  }, [active]);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}

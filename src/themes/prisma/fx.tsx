"use client";

import { useEffect } from "react";

import { useCoverGate } from "@/themes/_shared/cover-gate";
import {
  type ThemeMotionCtx,
  useThemeMotion,
} from "@/themes/_shared/gsap-motion";

/**
 * Koreografi Prisma (klien). Dua mesin terpisah:
 *  1. `useThemeMotion` (gsap+lenis, tier Signature — dimuat dinamis SETELAH cover
 *     dibuka): mask-reveal per baris, blok reveal, progress bab.
 *  2. Count-up angka stats (IntersectionObserver + rAF MURNI — TANPA gsap) agar
 *     tetap jalan di perangkat `motionOn` non-`richOn`. Reset ke 0 saat dibuka lalu
 *     menghitung naik saat terlihat; reduced-motion → angka server dibiarkan utuh.
 * Tak merender overlay apa pun (Prisma tanpa partikel).
 */
export function PrismaFx() {
  const { opened, motionOn, rootRef } = useCoverGate();

  // 1. Koreografi scroll (gsap.context di-revert saat unmount).
  useThemeMotion(rootRef, opened && motionOn, (ctx: ThemeMotionCtx) => {
    const { gsap, scope } = ctx;
    const q = <T extends Element>(sel: string) =>
      Array.from(scope.querySelectorAll<T>(sel));

    // Mask reveal per baris (state dimiliki JS §0.4) — konten saja (.pr-stage).
    q<HTMLElement>(".pr-stage .pr-line > span").forEach((el) => {
      gsap.set(el, { visibility: "visible", yPercent: 115 });
      gsap.to(el, {
        yPercent: 0,
        duration: 1,
        ease: "power4.out",
        scrollTrigger: {
          trigger: el.closest("section") ?? el,
          start: "top 82%",
        },
      });
    });

    // Blok reveal: fade + naik.
    q<HTMLElement>(".pr-stage .pr-reveal").forEach((el) => {
      gsap.fromTo(
        el,
        { y: 22, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.85,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        },
      );
    });

    // Progress bab.
    const bar = scope.querySelector(".pr-progress");
    if (bar) {
      gsap.to(bar, {
        scaleX: 1,
        ease: "none",
        scrollTrigger: {
          trigger: ".pr-stage",
          start: "top top",
          end: "bottom bottom",
          scrub: 0.3,
        },
      });
    }
  });

  // 2. Count-up angka stats (independen gsap).
  useEffect(() => {
    if (!opened || !motionOn) return;
    const root = rootRef.current;
    if (!root) return;
    const counters = root.querySelectorAll<HTMLElement>("[data-count]");
    if (counters.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          io.unobserve(e.target);
          const el = e.target as HTMLElement;
          const target = Number(el.dataset.count) || 0;
          const t0 = performance.now();
          const dur = 1400;
          const step = (now: number) => {
            const p = Math.min(1, (now - t0) / dur);
            el.textContent = String(
              Math.round(target * (1 - Math.pow(1 - p, 3))),
            );
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
      },
      { threshold: 0.6 },
    );

    // Mulai dari 0 (mencegah kedip angka server → 0 saat count-up mulai).
    counters.forEach((c) => {
      c.textContent = "0";
      io.observe(c);
    });
    return () => io.disconnect();
  }, [opened, motionOn, rootRef]);

  return null;
}

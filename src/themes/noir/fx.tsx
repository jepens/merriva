"use client";

import { useCoverGate } from "@/themes/_shared/cover-gate";
import {
  type ThemeMotionCtx,
  useThemeMotion,
} from "@/themes/_shared/gsap-motion";

/**
 * Koreografi scroll Noir (klien, tier Story — TANPA WebGL/partikel). Membaca
 * `useCoverGate()`: gsap dijalankan SETELAH cover dibuka via `useThemeMotion`
 * (gsap.context di-revert saat unmount). Efek sinematik: mask reveal per baris,
 * pan foto dalam frame, wipe horizontal clip-path, progress bab.
 */
export function NoirFx() {
  const { opened, motionOn, rootRef } = useCoverGate();

  useThemeMotion(rootRef, opened && motionOn, (ctx: ThemeMotionCtx) => {
    const { gsap, scope } = ctx;
    const q = <T extends Element>(sel: string) =>
      Array.from(scope.querySelectorAll<T>(sel));

    // Mask reveal per baris (state dimiliki JS §0.4) — konten saja (.nr-stage).
    q<HTMLElement>(".nr-stage .nr-line > span").forEach((el) => {
      gsap.set(el, { visibility: "visible", yPercent: 115 });
      gsap.to(el, {
        yPercent: 0,
        duration: 1.1,
        ease: "power4.out",
        scrollTrigger: {
          trigger: el.closest("section") ?? el,
          start: "top 80%",
        },
      });
    });

    // Blok reveal: fade + naik.
    q<HTMLElement>(".nr-stage .nr-reveal").forEach((el) => {
      gsap.fromTo(
        el,
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 86%" },
        },
      );
    });

    // Pan sinematik: foto bergerak lambat di dalam frame.
    q<HTMLElement>("[data-pan] .nr-frame__media").forEach((el) => {
      gsap.fromTo(
        el,
        { yPercent: -7 },
        {
          yPercent: 7,
          ease: "none",
          scrollTrigger: {
            trigger: el.parentElement,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.5,
          },
        },
      );
    });

    // Wipe horizontal untuk frame sinematik, potret, & item galeri.
    q<HTMLElement>(".nr-cine, .nr-portrait, .nr-gallery__item").forEach(
      (el) => {
        gsap.fromTo(
          el,
          { clipPath: "inset(0 100% 0 0)" },
          {
            clipPath: "inset(0 0% 0 0)",
            duration: 1.2,
            ease: "power4.inOut",
            scrollTrigger: { trigger: el, start: "top 82%" },
          },
        );
      },
    );

    // Progress bab.
    const bar = scope.querySelector(".nr-progress");
    if (bar) {
      gsap.to(bar, {
        scaleX: 1,
        ease: "none",
        scrollTrigger: {
          trigger: ".nr-stage",
          start: "top top",
          end: "bottom bottom",
          scrub: 0.3,
        },
      });
    }
  });

  return null;
}

"use client";

import { useCoverGate } from "@/themes/_shared/cover-gate";
import {
  type ThemeMotionCtx,
  useThemeMotion,
} from "@/themes/_shared/gsap-motion";

/**
 * Koreografi scroll Meridian (klien, tier Story — TANPA WebGL/partikel). Membaca
 * `useCoverGate()`: gsap dijalankan SETELAH cover dibuka via `useThemeMotion`
 * (gsap.context di-revert saat unmount). Nuansa Art Deco gala: mask reveal per
 * baris, blok reveal, chevrons SVG menggambar diri (scrub), bingkai/galeri
 * disingkap tirai dari bawah (clip-path), progress bab emas.
 */
export function MeridianFx() {
  const { opened, motionOn, rootRef } = useCoverGate();

  useThemeMotion(rootRef, opened && motionOn, (ctx: ThemeMotionCtx) => {
    const { gsap, scope } = ctx;
    const q = <T extends Element>(sel: string) =>
      Array.from(scope.querySelectorAll<T>(sel));

    // Mask reveal per baris (state dimiliki JS §0.4) — konten saja (.mrd-stage).
    q<HTMLElement>(".mrd-stage .mrd-line > span").forEach((el) => {
      gsap.set(el, { visibility: "visible", yPercent: 115 });
      gsap.to(el, {
        yPercent: 0,
        duration: 1.05,
        ease: "power4.out",
        scrollTrigger: {
          trigger: el.closest("section") ?? el,
          start: "top 80%",
        },
      });
    });

    // Blok reveal: fade + naik.
    q<HTMLElement>(".mrd-stage .mrd-reveal").forEach((el) => {
      gsap.fromTo(
        el,
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.95,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 86%" },
        },
      );
    });

    // Chevrons SVG menggambar diri saat masuk viewport (scrub).
    q<SVGPathElement>(".mrd-stage .mrd-draw path").forEach((p) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
      gsap.to(p, {
        strokeDashoffset: 0,
        ease: "none",
        scrollTrigger: {
          trigger: p.closest("svg"),
          start: "top 92%",
          end: "top 55%",
          scrub: 0.6,
        },
      });
    });

    // Bingkai bertingkat & item galeri disingkap tirai dari bawah.
    q<HTMLElement>(".mrd-stage .mrd-stepped, .mrd-stage .mrd-gitem").forEach(
      (el) => {
        gsap.fromTo(
          el,
          { clipPath: "inset(100% 0 0 0)" },
          {
            clipPath: "inset(0% 0 0 0)",
            duration: 1.15,
            ease: "power4.inOut",
            scrollTrigger: { trigger: el, start: "top 84%" },
          },
        );
      },
    );

    // Progress bab.
    const bar = scope.querySelector(".mrd-progress");
    if (bar) {
      gsap.to(bar, {
        scaleX: 1,
        ease: "none",
        scrollTrigger: {
          trigger: ".mrd-stage",
          start: "top top",
          end: "bottom bottom",
          scrub: 0.3,
        },
      });
    }
  });

  return null;
}

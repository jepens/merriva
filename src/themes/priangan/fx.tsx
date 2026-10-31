"use client";

import { useCoverGate } from "@/themes/_shared/cover-gate";
import {
  type ThemeMotionCtx,
  useThemeMotion,
} from "@/themes/_shared/gsap-motion";

/**
 * Koreografi scroll Priangan (klien, tier Story — TANPA WebGL/partikel).
 * gsap dijalankan SETELAH cover dibuka via `useThemeMotion` (gsap.context
 * di-revert saat unmount). Nuansa Sunda: mask reveal per baris, blok reveal,
 * ornamen line-art (julang ngapak, payung geulis) menggambar diri saat scroll,
 * awan melayang pelan, galeri clip-reveal lengkung.
 */
export function PrianganFx() {
  const { opened, motionOn, rootRef } = useCoverGate();

  useThemeMotion(rootRef, opened && motionOn, (ctx: ThemeMotionCtx) => {
    const { gsap, scope } = ctx;
    const q = <T extends Element>(sel: string) =>
      Array.from(scope.querySelectorAll<T>(sel));

    // Mask reveal per baris (state dimiliki JS §0.4) — konten saja (.pg-stage).
    q<HTMLElement>(".pg-stage .pg-line > span").forEach((el) => {
      gsap.set(el, { visibility: "visible", yPercent: 115 });
      gsap.to(el, {
        yPercent: 0,
        duration: 1,
        ease: "power4.out",
        scrollTrigger: {
          trigger: el.closest("section") ?? el,
          start: "top 80%",
        },
      });
    });

    // Blok reveal: fade + naik.
    q<HTMLElement>(".pg-stage .pg-reveal").forEach((el) => {
      gsap.fromTo(
        el,
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        },
      );
    });

    // Ornamen line-art `.pg-draw` menggambar diri saat masuk viewport (scrub).
    // `clamp()`: payung geulis ada di footer — elemen terakhir halaman — dan
    // di layar tinggi `top 55%` tak pernah tercapai, payung berhenti setengah.
    q<SVGPathElement>(".pg-stage .pg-draw path").forEach((p) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
      gsap.to(p, {
        strokeDashoffset: 0,
        ease: "none",
        scrollTrigger: {
          trigger: p.closest("svg"),
          start: "top 92%",
          end: "clamp(top 55%)",
          scrub: 0.6,
        },
      });
    });

    // Awan konten melayang pelan (yoyo tak berujung — murah, transform saja).
    q<HTMLElement>(".pg-stage .pg-cloud").forEach((c, i) => {
      gsap.to(c, {
        x: i % 2 ? -24 : 24,
        y: 8,
        duration: 7 + i * 2,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });
    });

    // Galeri: clip-reveal dari tengah (kesan bingkai terbuka).
    q<HTMLElement>(".pg-stage .pg-g-item").forEach((el, i) => {
      gsap.fromTo(
        el,
        { clipPath: "inset(10% 10% 10% 10%)", opacity: 0 },
        {
          clipPath: "inset(0% 0% 0% 0%)",
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          delay: (i % 2) * 0.08,
          scrollTrigger: { trigger: el, start: "top 94%" },
        },
      );
    });
  });

  return null;
}

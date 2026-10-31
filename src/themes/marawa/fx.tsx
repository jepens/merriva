"use client";

import { useCoverGate } from "@/themes/_shared/cover-gate";
import {
  type ThemeMotionCtx,
  useThemeMotion,
} from "@/themes/_shared/gsap-motion";

/**
 * Koreografi scroll Marawa (klien, tier Story — TANPA WebGL/partikel).
 * gsap dijalankan SETELAH cover dibuka via `useThemeMotion`. Nuansa Minang:
 * mask reveal per baris, blok reveal, kaluak paku `.mw-draw` menggambar diri
 * (scrub) lalu berdenyut halus, galeri wipe-bawah (kesan kain songket
 * dibentang).
 */
export function MarawaFx() {
  const { opened, motionOn, rootRef } = useCoverGate();

  useThemeMotion(rootRef, opened && motionOn, (ctx: ThemeMotionCtx) => {
    const { gsap, scope } = ctx;
    const q = <T extends Element>(sel: string) =>
      Array.from(scope.querySelectorAll<T>(sel));

    // Mask reveal per baris (state dimiliki JS §0.4) — konten saja (.mw-stage).
    q<HTMLElement>(".mw-stage .mw-line > span").forEach((el) => {
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

    // Blok reveal.
    q<HTMLElement>(".mw-stage .mw-reveal").forEach((el) => {
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

    // Kaluak paku menggambar diri (scrub) lalu denyut opacity halus.
    q<SVGPathElement>(".mw-stage .mw-draw path").forEach((p) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
      gsap.to(p, {
        strokeDashoffset: 0,
        ease: "none",
        scrollTrigger: {
          trigger: p.closest("svg"),
          start: "top 95%",
          end: "top 60%",
          scrub: 0.6,
        },
      });
    });
    q<SVGSVGElement>(".mw-stage .mw-paku").forEach((el, i) => {
      gsap.to(el, {
        opacity: 0.65,
        duration: 2.4,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
        delay: i * 0.7,
      });
    });

    // Galeri: wipe dari bawah — kain songket dibentang. Tile gonjong cukup
    // di-fade: tween clip-path meninggalkan `inset(0%)` inline yang menimpa
    // siluet gonjong (`clip-path: polygon`) dari CSS.
    q<HTMLElement>(".mw-stage .mw-g-item").forEach((el, i) => {
      const wipe = !el.classList.contains("mw-g-item--gonjong");
      gsap.fromTo(
        el,
        wipe
          ? { clipPath: "inset(100% 0% 0% 0%)", opacity: 0.4 }
          : { opacity: 0 },
        {
          ...(wipe ? { clipPath: "inset(0% 0% 0% 0%)" } : {}),
          opacity: 1,
          duration: 1,
          ease: "power3.inOut",
          delay: (i % 2) * 0.1,
          scrollTrigger: { trigger: el, start: "top 94%" },
        },
      );
    });
  });

  return null;
}

"use client";

import { useEffect } from "react";

import { useCoverGate } from "@/themes/_shared/cover-gate";
import { pasangPengepasIsi } from "@/themes/_shared/fit-names";
import {
  type ThemeMotionCtx,
  useThemeMotion,
} from "@/themes/_shared/gsap-motion";

/**
 * Koreografi scroll Kirana (klien, tier Story — TANPA WebGL/partikel). Membaca
 * `useCoverGate()`: gsap dijalankan SETELAH cover dibuka via `useThemeMotion`
 * (gsap.context di-revert saat unmount). Nuansa Jawa: mask reveal per baris,
 * blok reveal, ornamen line-art (ukel/tr-corner) MENGGAMBAR DIRI saat scroll
 * (strokeDashoffset scrub), progress bab.
 */
export function KiranaFx() {
  const { opened, motionOn, rootRef } = useCoverGate();

  // Nama lengkap di kartu keraton bisa memuat kata yang lebih lebar dari
  // kartunya ("Kusumawardhani" Playfair di 320 px) — pengepas yang sama dengan
  // sampul, terlepas dari motion (_shared/fit-names.ts).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ambil = () =>
      Array.from(root.querySelectorAll<HTMLElement>(".kr-keraton__name"))
        .map((el) => [el, el.querySelector<HTMLElement>(".kr-line")] as const)
        .filter((p): p is readonly [HTMLElement, HTMLElement] => p[1] !== null);
    const teks = ambil()
      .map(([el]) => el.textContent ?? "")
      .join("");
    return pasangPengepasIsi(root, ambil, teks);
  }, [rootRef]);

  useThemeMotion(rootRef, opened && motionOn, (ctx: ThemeMotionCtx) => {
    const { gsap, scope } = ctx;
    const q = <T extends Element>(sel: string) =>
      Array.from(scope.querySelectorAll<T>(sel));

    // Mask reveal per baris (state dimiliki JS §0.4) — konten saja (.kr-stage).
    q<HTMLElement>(".kr-stage .kr-line > span").forEach((el) => {
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
    q<HTMLElement>(".kr-stage .kr-reveal").forEach((el) => {
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

    // Ornamen line-art `.kr-draw` menggambar diri saat masuk viewport (scrub).
    q<SVGPathElement>(".kr-stage .kr-draw path").forEach((p) => {
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

    // Progress bab.
    const bar = scope.querySelector(".kr-progress");
    if (bar) {
      gsap.to(bar, {
        scaleX: 1,
        ease: "none",
        scrollTrigger: {
          trigger: ".kr-stage",
          start: "top top",
          end: "bottom bottom",
          scrub: 0.3,
        },
      });
    }
  });

  return null;
}

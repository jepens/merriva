"use client";

import { useCoverGate } from "@/themes/_shared/cover-gate";
import {
  type ThemeMotionCtx,
  useThemeMotion,
} from "@/themes/_shared/gsap-motion";

/**
 * Koreografi scroll Meihua (klien, tier Story — TANPA WebGL/partikel).
 * gsap dijalankan SETELAH cover dibuka via `useThemeMotion`. Nuansa Tionghoa:
 * dahan mei hua tergambar (scrub) + kuntum mekar berurutan (back.out),
 * mask-reveal per baris, blok reveal, galeri terbuka dari tengah
 * ("pintu bulan").
 */
export function MeihuaFx() {
  const { opened, motionOn, rootRef } = useCoverGate();

  useThemeMotion(rootRef, opened && motionOn, (ctx: ThemeMotionCtx) => {
    const { gsap, scope } = ctx;
    const q = <T extends Element>(sel: string) =>
      Array.from(scope.querySelectorAll<T>(sel));

    // Mask reveal per baris (state dimiliki JS §0.4) — konten saja (.mh-stage).
    q<HTMLElement>(".mh-stage .mh-line > span").forEach((el) => {
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
    q<HTMLElement>(".mh-stage .mh-reveal").forEach((el) => {
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

    // Dahan mei hua tergambar (scrub) + kuntum mekar stagger.
    const hero = scope.querySelector(".mh-hero");
    q<SVGPathElement>(".mh-stage .mh-bough").forEach((p) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
      gsap.to(p, {
        strokeDashoffset: 0,
        ease: "none",
        scrollTrigger: {
          trigger: hero ?? p,
          start: "top 70%",
          end: "bottom 55%",
          scrub: 0.6,
        },
      });
    });
    q<SVGGElement>(".mh-stage .mh-bloom-group").forEach((g, i) => {
      const petals = g.querySelectorAll("circle");
      gsap.set(petals, { scale: 0, transformOrigin: "50% 50%", opacity: 0 });
      gsap.to(petals, {
        scale: 1,
        opacity: 1,
        duration: 0.7,
        stagger: 0.08,
        ease: "back.out(2.2)",
        scrollTrigger: {
          trigger: hero ?? g,
          start: `top ${62 - i * 8}%`,
        },
      });
    });

    // 囍 konten SENGAJA tidak digambar: scrub membuatnya setengah jadi selama
    // gulir dan terhapus lagi saat gulir balik (§3.4 "囍 selalu utuh"). Cukup
    // ikut fade blok, seperti prototipe; hanya medali cover yang menggores.

    // Galeri: terbuka dari tengah (pintu bulan). Tile oktagon cukup di-fade:
    // tween clip-path meninggalkan `inset(0%)` inline yang menimpa bingkai
    // oktagon (`clip-path: polygon`) dari CSS.
    q<HTMLElement>(".mh-stage .mh-g-item").forEach((el, i) => {
      const buka = !el.classList.contains("mh-g-item--okta");
      gsap.fromTo(
        el,
        buka
          ? { clipPath: "inset(50% 50% 50% 50%)", opacity: 0 }
          : { opacity: 0 },
        {
          ...(buka ? { clipPath: "inset(0% 0% 0% 0%)" } : {}),
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

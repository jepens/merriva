"use client";

import { useEffect } from "react";

import { useCoverGate } from "@/themes/_shared/cover-gate";
import {
  type ThemeMotionCtx,
  useThemeMotion,
} from "@/themes/_shared/gsap-motion";
import { ParticlesCanvas } from "@/themes/_shared/particles-canvas";

import { fitToLine, muatFont } from "./fit-names";

/**
 * Overlay & koreografi eternal-rose (klien). Membaca `useCoverGate()`:
 * kelopak mulai saat dibuka (hanya `richOn`); koreografi scroll (mask reveal,
 * scrub ornamen, parallax, galeri clip, progress) dijalankan gsap SETELAH cover
 * dibuka via `useThemeMotion` (gsap.context di-revert saat unmount).
 */
export function EternalRoseFx() {
  const { opened, motionOn, richOn, rootRef } = useCoverGate();

  // Baris nama hero ("of X & Y") meluap seperti nama sampul bila namanya satu
  // kata yang lebar — pengepas yang sama, terlepas dari motion. Jalan saat
  // mount (hero sudah tertata di balik sampul, jadi tak ada lompatan yang
  // terlihat), saat face italic nama termuat, saat layar berubah ukuran, dan
  // saat var akar berganti: editor tampilan mengganti pasangan font langsung
  // di iframe tanpa memuat ulang.
  useEffect(() => {
    const root = rootRef.current;
    const h1 = root?.querySelector<HTMLElement>(".er-hero__names");
    const line = h1?.querySelector<HTMLElement>(".er-line:last-child");
    if (!root || !h1 || !line) return;
    let live = true;
    const fit = () => {
      if (live) fitToLine(h1, line);
    };
    // Face pasangan yang baru dipilih di editor belum tentu termuat: muat face
    // yang KINI dipakai nama, lalu ukur lagi begitu tiba.
    const ukur = () => {
      fit();
      muatFont(line.querySelector("em") ?? h1, line.textContent ?? "").then(
        fit,
        () => {},
      );
    };
    ukur();
    window.addEventListener("resize", fit);
    const mo = new MutationObserver(ukur);
    mo.observe(root, { attributes: true, attributeFilter: ["style"] });
    return () => {
      live = false;
      window.removeEventListener("resize", fit);
      mo.disconnect();
    };
  }, [rootRef]);

  useThemeMotion(rootRef, opened && motionOn, (ctx: ThemeMotionCtx) => {
    const { gsap, scope } = ctx;
    const q = <T extends Element>(sel: string) =>
      Array.from(scope.querySelectorAll<T>(sel));

    // Mask reveal per baris (state dimiliki JS §0.4) — konten saja (.er-stage).
    q<HTMLElement>(".er-stage .er-line > span").forEach((el) => {
      gsap.set(el, { visibility: "visible", yPercent: 115 });
      gsap.to(el, {
        yPercent: 0,
        duration: 1.1,
        ease: "power4.out",
        scrollTrigger: {
          trigger: el.closest("section") ?? el,
          start: "top 82%",
        },
      });
    });

    // Blok reveal: fade + naik.
    q<HTMLElement>(".er-stage .er-reveal").forEach((el) => {
      gsap.fromTo(
        el,
        { y: 26, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 85%" },
        },
      );
    });

    // Ornamen mawar menggambar diri (scrub).
    q<SVGPathElement>(".er-flourish path").forEach((p) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
      gsap.to(p, {
        strokeDashoffset: 0,
        ease: "none",
        scrollTrigger: {
          trigger: ".er-hero",
          start: "top 70%",
          end: "bottom 40%",
          scrub: 0.6,
        },
      });
    });

    // Parallax arch mempelai (berlawanan arah).
    q<HTMLElement>("[data-parallax]").forEach((el) => {
      gsap.to(el, {
        yPercent: parseFloat(el.dataset.parallax ?? "0"),
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.5,
        },
      });
    });

    // Nomor ghost jadwal bergeser.
    q<HTMLElement>(".er-event__num").forEach((el) => {
      gsap.fromTo(
        el,
        { y: 36 },
        {
          y: -14,
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

    // Item galeri: clip reveal + skala.
    q<HTMLElement>(".er-gallery__item").forEach((el, i) => {
      gsap.fromTo(
        el,
        { clipPath: "inset(12% 12% 12% 12% round 22px)", scale: 0.96 },
        {
          clipPath: "inset(0% 0% 0% 0% round 22px)",
          scale: 1,
          duration: 1.1,
          ease: "power3.out",
          delay: i * 0.06,
          scrollTrigger: { trigger: ".er-gallery", start: "top 75%" },
        },
      );
    });

    // Progress bar bab.
    const bar = scope.querySelector(".er-progress");
    if (bar) {
      gsap.to(bar, {
        scaleX: 1,
        ease: "none",
        scrollTrigger: {
          trigger: ".er-stage",
          start: "top top",
          end: "bottom bottom",
          scrub: 0.3,
        },
      });
    }
  });

  return (
    <ParticlesCanvas
      preset="petals"
      active={opened && richOn}
      className="er-petals"
    />
  );
}

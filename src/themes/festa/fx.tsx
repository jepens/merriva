"use client";

import { useCoverGate } from "@/themes/_shared/cover-gate";
import { ParticlesCanvas } from "@/themes/_shared/particles-canvas";

/**
 * Efek Festa (klien, tier Craft) — confetti burst saat cover dibuka. Memakai
 * `ParticlesCanvas` preset confetti (canvas 2D ringan, auto-stop ±3,5 dtk, TANPA
 * library). TIDAK menyentuh gsap/lenis (bukti tier Craft). Reveal konten memakai
 * `<Reveal>` (IntersectionObserver) di dalam section, bukan di sini.
 */
export function FestaFx() {
  const { opened, motionOn } = useCoverGate();
  return (
    <ParticlesCanvas
      preset="confetti"
      active={opened && motionOn}
      className="ft-confetti"
    />
  );
}

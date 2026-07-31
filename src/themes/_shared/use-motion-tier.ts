"use client";

import { useEffect, useState } from "react";

/**
 * Tingkat motion efektif untuk perangkat & preferensi tamu (THEME-DESIGN §2).
 * - `motionOn`  : koreografi dasar (mask reveal, scrub) — mati bila
 *   `prefers-reduced-motion`.
 * - `richOn`    : efek berat (shader WebGL, partikel) — hanya perangkat mampu,
 *   ATAU dipaksa lewat `?rich=1` untuk pengujian di perangkat lemah.
 */
export interface MotionTier {
  motionOn: boolean;
  richOn: boolean;
  /** true setelah deteksi klien selesai (hindari flash sebelum keputusan). */
  ready: boolean;
}

const INITIAL: MotionTier = { motionOn: false, richOn: false, ready: false };

/**
 * Deteksi dilakukan SETELAH mount (client-only) agar tak ada mismatch hidrasi:
 * render server & first paint = tanpa motion (konten terbaca), lalu di-upgrade.
 */
export function useMotionTier(): MotionTier {
  const [tier, setTier] = useState<MotionTier>(INITIAL);

  useEffect(() => {
    // Deteksi via fungsi (bukan setState langsung di badan efek) — konsisten
    // dengan pola `useCountdown`; sinkron sekali saat mount, tak berulang.
    const detect = () => {
      const params = new URLSearchParams(window.location.search);
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const nav = navigator as Navigator & { deviceMemory?: number };
      const lowEnd =
        (typeof nav.deviceMemory === "number" && nav.deviceMemory < 4) ||
        (typeof nav.hardwareConcurrency === "number" &&
          nav.hardwareConcurrency < 4);
      const motionOn = !reduced;
      const richOn = motionOn && (!lowEnd || params.get("rich") === "1");
      setTier({ motionOn, richOn, ready: true });
    };
    detect();
  }, []);

  return tier;
}

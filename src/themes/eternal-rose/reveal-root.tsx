"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Akar tema: menandai `er-js` HANYA setelah JS klien benar-benar berjalan.
 * CSS reveal (`.er-js .er-reveal { opacity:0 }`) baru aktif setelah kelas ini
 * ada → tanpa JS / hidrasi gagal, konten tetap terlihat (tak pernah blank).
 * Children di-render di server & diteruskan apa adanya (bundle klien tetap kecil).
 */
export function RevealRoot({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.classList.add("er-js");
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

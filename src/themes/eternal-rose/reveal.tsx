"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Reveal-on-scroll ringan (tanpa library animasi) — IntersectionObserver +
 * kelas CSS `.er-reveal.is-visible`. `prefers-reduced-motion` dihormati di CSS.
 * Sekali tampil lalu berhenti mengamati (hemat).
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const cls = ["er-reveal"];
  if (visible) cls.push("is-visible");
  if (className) cls.push(className);

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cls.join(" ")}
    >
      {children}
    </div>
  );
}

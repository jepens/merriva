"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Primitif interaksi BERSAMA untuk tema M4.2+ (eternal-rose punya versi sendiri).
 * Kelas CSS generik (`reveal`/`is-visible`/`countdown`…) di-scope oleh CSS tiap
 * tema di bawah kelas akarnya sendiri → tak bertabrakan lintas tema. Logika di
 * sini, TAMPILAN di CSS tema. Semua ringan (tanpa library animasi) → ramah LCP
 * & WebView (SPEC §10). `prefers-reduced-motion` dihormati di CSS tema.
 */

/**
 * Akar tema: menandai kelas `is-js` HANYA setelah JS klien berjalan. CSS reveal
 * (`.<tema>.is-js .reveal { opacity:0 }`) baru aktif setelahnya → tanpa JS /
 * hidrasi gagal, konten tetap terlihat (tak pernah blank). Children dirender di
 * server (bundle klien tetap kecil).
 */
export function ThemeRoot({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.classList.add("is-js");
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/**
 * Reveal-on-scroll (IntersectionObserver). Menambah `.is-visible` sekali tampil
 * lalu berhenti mengamati. Kelas dasar `reveal` + `className` opsional.
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
    // Reduced-motion: tampilkan seluruh konten SEGERA (tanpa gating scroll) →
    // "konten lengkap tanpa animasi" (DoD §5), setara tema Story/Signature yang
    // memang tak menyembunyikan reveal saat `is-motion` absen. setState di dalam
    // rAF (bukan sinkron di badan efek) → hindari cascading render & aman hidrasi.
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
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

  const cls = ["reveal"];
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

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

function diffFrom(targetMs: number): CountdownParts {
  const delta = targetMs - Date.now();
  if (delta <= 0)
    return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  let d = delta;
  const days = Math.floor(d / 86_400_000);
  d -= days * 86_400_000;
  const hours = Math.floor(d / 3_600_000);
  d -= hours * 3_600_000;
  const minutes = Math.floor(d / 60_000);
  d -= minutes * 60_000;
  return { days, hours, minutes, seconds: Math.floor(d / 1000), done: false };
}

/** Hitung mundur. `null` sampai efek klien jalan (render server = hidrasi identik). */
export function useCountdown(targetIso: string): CountdownParts | null {
  const [p, setP] = useState<CountdownParts | null>(null);
  useEffect(() => {
    const target = Date.parse(targetIso);
    if (Number.isNaN(target)) return;
    const tick = () => setP(diffFrom(target));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  return p;
}

export interface CountdownLabels {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  done: string;
}

/**
 * Hitung mundur siap-pakai dgn kelas generik (`countdown`, `count-box`,
 * `count-num`, `count-label`, `countdown-done`) — tema mengatur tampilannya di CSS.
 */
export function Countdown({
  targetIso,
  labels,
}: {
  targetIso: string;
  labels: CountdownLabels;
}) {
  const p = useCountdown(targetIso);
  if (p?.done) return <p className="countdown-done">{labels.done}</p>;

  const cells: Array<[number | undefined, string]> = [
    [p?.days, labels.days],
    [p?.hours, labels.hours],
    [p?.minutes, labels.minutes],
    [p?.seconds, labels.seconds],
  ];
  return (
    <div className="countdown">
      {cells.map(([n, label]) => (
        <div key={label} className="count-box">
          <span className="count-num">
            {n === undefined ? "—" : String(n).padStart(2, "0")}
          </span>
          <span className="count-label">{label}</span>
        </div>
      ))}
    </div>
  );
}

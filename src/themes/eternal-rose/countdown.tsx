"use client";

import { useEffect, useState } from "react";

import { L } from "./labels";

interface Parts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

function diffFrom(targetMs: number): Parts {
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
  const seconds = Math.floor(d / 1000);
  return { days, hours, minutes, seconds, done: false };
}

/**
 * Hitung mundur. State awal null agar render server & hidrasi klien identik
 * (tanpa mismatch); klien mengisi via efek + `setInterval`.
 */
export function Countdown({ targetIso }: { targetIso: string }) {
  const [p, setP] = useState<Parts | null>(null);

  useEffect(() => {
    const target = Date.parse(targetIso);
    if (Number.isNaN(target)) return;
    const tick = () => setP(diffFrom(target));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  if (p?.done) return <p className="er-lead">{L.countdown.done}</p>;

  const cells: Array<[number | undefined, string]> = [
    [p?.days, L.countdown.days],
    [p?.hours, L.countdown.hours],
    [p?.minutes, L.countdown.minutes],
    [p?.seconds, L.countdown.seconds],
  ];
  return (
    <div className="er-countdown">
      {cells.map(([n, label]) => (
        <div key={label} className="er-count-box">
          <div className="er-count-num">
            {n === undefined ? "—" : String(n).padStart(2, "0")}
          </div>
          <div className="er-count-label">{label}</div>
        </div>
      ))}
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, type ReactNode } from "react";

import { useCoverGate } from "@/themes/_shared/cover-gate";

import { L } from "./labels";

// Shader aurora dimuat LAZY & hanya saat `richOn` (perangkat mampu).
const SilkCanvas = dynamic(
  () => import("@/themes/_shared/silk-canvas").then((m) => m.SilkCanvas),
  { ssr: false },
);

// Fragment shader aurora violet→cyan→lime (disalin dari prototipe). Uniform: r, t.
const AURORA_FRAGMENT = `precision mediump float;uniform vec2 r;uniform float t;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.545);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p*=2.1;a*=.5;}return v;}
void main(){vec2 uv=gl_FragCoord.xy/r;vec2 q=uv*vec2(r.x/r.y,1.);
  float f=fbm(q*1.8+vec2(t*.05,-t*.035)+fbm(q*3.4+t*.06)*.7);
  vec3 base=vec3(.04,.04,.09);
  vec3 vio=vec3(.49,.36,1.),cya=vec3(.25,.89,.85),lim=vec3(.85,1.,.37);
  vec3 c=base+vio*smoothstep(.3,.75,f)*.5;
  c=mix(c,cya,smoothstep(.55,.9,fbm(q*2.2-t*.04))*.35);
  c+=lim*pow(max(f-.78,0.)*4.,2.)*.5;
  c*=1.-.4*distance(uv,vec2(.5,.5));
  gl_FragColor=vec4(c,1.);}`;

function Line({ children }: { children: ReactNode }) {
  return (
    <span className="pr-line">
      <span>{children}</span>
    </span>
  );
}

/** Kelas kata mega: angka/tahun → aksen lime; kata ganjil (bukan pertama) →
 *  outline stroke; sisanya solid. Generalisasi flourish tipografi prototipe. */
function megaWordClass(word: string, i: number): string {
  if (/\d/.test(word)) return "pr-mega__word pr-mega__word--accent";
  if (i % 2 === 1) return "pr-mega__word pr-mega__word--outline";
  return "pr-mega__word";
}

/**
 * Visual cover Prisma (klien). Membaca `useCoverGate()` untuk nama tamu, tier, dan
 * aksi buka. Entrance mask-reveal DIMILIKI JS via WAAPI (sinkron saat mount → tak
 * menunggu gsap async, aman untuk LCP teks cover). Shader aurora hanya `richOn`.
 */
export function PrismaCover({
  eventName,
  organizer,
  dateLabel,
}: {
  eventName: string;
  organizer?: string;
  dateLabel: string | null;
}) {
  const { open, opened, recipientName, motionOn, richOn } = useCoverGate();
  const innerRef = useRef<HTMLDivElement>(null);

  // Mask-reveal entrance (WAAPI) — visibility + translateY dimiliki JS. 150%:
  // judul acara ber-line-height .92, pada 115% breve Ğ kapital (juga Å/Ñ)
  // mengintip dari dasar masker (THEME-PORTING §0.4).
  useEffect(() => {
    if (!motionOn) return;
    const root = innerRef.current;
    if (!root) return;
    const spans = root.querySelectorAll<HTMLElement>(".pr-line > span");
    const anims: Animation[] = [];
    spans.forEach((el, i) => {
      el.style.visibility = "visible";
      anims.push(
        el.animate(
          [{ transform: "translateY(150%)" }, { transform: "translateY(0)" }],
          {
            duration: 1050,
            easing: "cubic-bezier(0.22,1,0.36,1)",
            fill: "both",
            delay: 250 + i * 85,
          },
        ),
      );
    });
    return () => anims.forEach((a) => a.cancel());
  }, [motionOn]);

  const words = eventName.split(/\s+/).filter(Boolean);
  const presentsText = organizer
    ? `${organizer} ${L.cover.presents}`
    : "Undangan";

  return (
    <>
      {richOn ? (
        <SilkCanvas
          fragment={AURORA_FRAGMENT}
          fallbackClassName="pr-cover__fallback"
          className="pr-cover__bg"
          paused={opened}
        />
      ) : (
        <div className="pr-cover__fallback" aria-hidden />
      )}

      <div className="pr-cover__inner" ref={innerRef}>
        <p className="pr-mono">
          <Line>{presentsText}</Line>
        </p>

        <h1 className="pr-mega">
          {words.map((w, i) => (
            <span className="pr-line" key={`${w}-${i}`}>
              <span className={megaWordClass(w, i)}>{w}</span>
            </span>
          ))}
        </h1>

        {dateLabel ? (
          <p className="pr-cover__sub">
            <Line>{dateLabel}</Line>
          </p>
        ) : null}

        <Line>
          <span className="pr-chip">
            {L.cover.recipient}
            <b>{recipientName ?? L.cover.recipientFallback}</b>
          </span>
        </Line>

        <Line>
          <button
            type="button"
            className="pr-open"
            onClick={open}
            tabIndex={opened ? -1 : 0}
          >
            {L.cover.enter} →
          </button>
        </Line>

        <p className="pr-cover__hint">{L.cover.hint}</p>
      </div>
    </>
  );
}

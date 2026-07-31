"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, type ReactNode } from "react";

import { copy } from "@/lib/copy";
import { useCoverGate } from "@/themes/_shared/cover-gate";

import { L } from "./labels";

// Silk shader dimuat LAZY & hanya dirender saat `richOn` (perangkat mampu).
const SilkCanvas = dynamic(
  () => import("@/themes/_shared/silk-canvas").then((m) => m.SilkCanvas),
  { ssr: false },
);

// Fragment shader silk plum↔rose (disalin dari prototipe). Uniform: r, t.
const SILK_FRAGMENT = `precision mediump float;uniform vec2 r;uniform float t;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.545);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p*=2.03;a*=.5;}return v;}
void main(){vec2 uv=gl_FragCoord.xy/r; vec2 q=uv*vec2(r.x/r.y,1.);
  float f=fbm(q*1.6+vec2(t*.03,-t*.02)+fbm(q*3.+t*.04)*.6);
  vec3 plum=vec3(.18,.10,.13), plum2=vec3(.29,.15,.20), rose=vec3(.72,.43,.47), gold=vec3(.79,.64,.15);
  vec3 c=mix(plum,plum2,uv.y); c=mix(c,rose,smoothstep(.35,.85,f)*.5);
  c+=gold*pow(max(f-.72,0.)*3.2,2.)*.35; c*=1.-.45*distance(uv,vec2(.5,.55));
  gl_FragColor=vec4(c,1.);}`;

function Line({ children }: { children: ReactNode }) {
  return (
    <span className="er-line">
      <span>{children}</span>
    </span>
  );
}

/**
 * Visual cover eternal-rose (klien). Membaca `useCoverGate()` untuk nama tamu,
 * status, tier, dan aksi buka. Entrance mask-reveal DIMILIKI JS via WAAPI
 * (sinkron saat mount → tak menunggu gsap async, aman untuk LCP teks cover).
 */
export function EternalRoseCover({
  groomName,
  brideName,
  dateLabel,
}: {
  groomName: string;
  brideName: string;
  dateLabel: string | null;
}) {
  const { open, opened, recipientName, motionOn, richOn } = useCoverGate();
  const innerRef = useRef<HTMLDivElement>(null);

  // Mask-reveal entrance (WAAPI) — visibility + translateY dimiliki JS.
  useEffect(() => {
    if (!motionOn) return;
    const root = innerRef.current;
    if (!root) return;
    const spans = root.querySelectorAll<HTMLElement>(".er-line > span");
    const anims: Animation[] = [];
    spans.forEach((el, i) => {
      el.style.visibility = "visible";
      anims.push(
        el.animate(
          [{ transform: "translateY(115%)" }, { transform: "translateY(0)" }],
          {
            duration: 1150,
            easing: "cubic-bezier(0.22,1,0.36,1)",
            fill: "both",
            delay: 250 + i * 90,
          },
        ),
      );
    });
    return () => anims.forEach((a) => a.cancel());
  }, [motionOn]);

  const c = copy.public.cover;

  return (
    <>
      {richOn ? (
        <SilkCanvas
          fragment={SILK_FRAGMENT}
          fallbackClassName="er-cover__fallback"
          className="er-cover__bg"
          paused={opened}
        />
      ) : (
        <div className="er-cover__fallback" aria-hidden />
      )}
      <div className="er-cover__vignette" aria-hidden />

      <div className="er-cover__inner" ref={innerRef}>
        <p className="er-eyebrow">
          <Line>{L.hero.eyebrow}</Line>
        </p>
        <div className="er-cover__names">
          <span className="er-cover__name">
            <Line>{groomName}</Line>
          </span>
          <span className="er-cover__amp">
            <Line>&amp;</Line>
          </span>
          <span className="er-cover__name">
            <Line>{brideName}</Line>
          </span>
        </div>
        {dateLabel ? (
          <p className="er-cover__date">
            <Line>{dateLabel}</Line>
          </p>
        ) : null}
        <div className="er-cover__divider" aria-hidden />
        <div className="er-guest">
          <small>{c.recipient}</small>
          <strong>{recipientName ?? c.recipientFallback}</strong>
        </div>
        <Line>
          <button
            type="button"
            className="er-open"
            onClick={open}
            tabIndex={opened ? -1 : 0}
          >
            {c.open}
          </button>
        </Line>
        <p className="er-cover__hint">{L.hero.hint}</p>
      </div>
    </>
  );
}

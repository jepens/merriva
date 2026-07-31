"use client";

import { useEffect, useRef } from "react";

/**
 * Shader WebGL kecil untuk aksen Signature (THEME-PORTING §2d). Fragment shader
 * di-inject via prop (silk plum/rose untuk eternal-rose, aurora untuk prisma).
 * Selalu ada fallback gradient CSS di belakang (`fallbackClassName`) → bila WebGL
 * gagal/tak tersedia, tampilan tetap hidup. DPR di-cap 1.5, `powerPreference`
 * low-power, di-pause saat tab tersembunyi atau `paused`. Dipakai LAZY (hanya
 * saat `richOn`) via `next/dynamic ssr:false` di temanya.
 */

const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";

export function SilkCanvas({
  fragment,
  fallbackClassName,
  className,
  paused = false,
}: {
  /** Sumber fragment shader (uniform `vec2 r` resolusi, `float t` detik). */
  fragment: string;
  /** Kelas div fallback gradient CSS (dirender di belakang canvas). */
  fallbackClassName: string;
  className?: string;
  paused?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  // Diisi efek utama → dipanggil saat `paused` berubah / tab kembali terlihat.
  const resumeRef = useRef<() => void>(() => {});

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const gl = cv.getContext("webgl", {
      antialias: false,
      powerPreference: "low-power",
    });
    if (!gl) return; // fallback CSS tetap tampil

    let disposed = false;
    let raf = 0;
    let t0 = 0;
    let uT: WebGLUniformLocation | null = null;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) throw new Error("shader");
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(s) ?? "compile");
      }
      return s;
    };

    const loop = (now: number) => {
      if (disposed) return;
      if (pausedRef.current || document.hidden) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(loop);
      gl.uniform1f(uT, (now - t0) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const ensureRunning = () => {
      if (disposed || raf || pausedRef.current || document.hidden) return;
      t0 = performance.now();
      raf = requestAnimationFrame(loop);
    };
    resumeRef.current = ensureRunning;

    let onResize: (() => void) | null = null;
    try {
      const prog = gl.createProgram();
      if (!prog) throw new Error("program");
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragment));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error("link");
      }
      gl.useProgram(prog);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW,
      );
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const uR = gl.getUniformLocation(prog, "r");
      uT = gl.getUniformLocation(prog, "t");

      const size = () => {
        const d = Math.min(window.devicePixelRatio || 1, 1.5);
        cv.width = Math.max(1, Math.floor(window.innerWidth * d));
        cv.height = Math.max(1, Math.floor(window.innerHeight * d));
        gl.viewport(0, 0, cv.width, cv.height);
        gl.uniform2f(uR, cv.width, cv.height);
      };
      size();
      onResize = size;
      window.addEventListener("resize", size, { passive: true });
      ensureRunning();
    } catch {
      disposed = true; // fallback CSS mengambil alih
      return;
    }

    const onVis = () => ensureRunning();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      disposed = true;
      resumeRef.current = () => {};
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      if (onResize) window.removeEventListener("resize", onResize);
    };
  }, [fragment]);

  // Sinkronkan flag; saat `paused` dilepas, mulai lagi loop.
  useEffect(() => {
    pausedRef.current = paused;
    if (!paused) resumeRef.current();
  }, [paused]);

  return (
    <>
      <div className={fallbackClassName} aria-hidden />
      <canvas ref={canvasRef} className={className} aria-hidden />
    </>
  );
}

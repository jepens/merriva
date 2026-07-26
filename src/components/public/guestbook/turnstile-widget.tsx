"use client";

import { useEffect, useRef } from "react";

interface TurnstileAPI {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset?: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileAPI;
  }
}

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Widget Cloudflare Turnstile (SPEC §4.6). Dirender HANYA bila site key ada
 * (dev tanpa key → tak dirender, server melewati verifikasi). Skrip dimuat
 * lazy (hanya saat komponen ini terpasang, mis. saat form RSVP terlihat).
 */
export function TurnstileWidget({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let cancelled = false;

    function render() {
      if (cancelled || !window.turnstile || !ref.current || widgetId.current)
        return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        callback: (token: string) => onTokenRef.current(token),
        "error-callback": () => onTokenRef.current(""),
        "expired-callback": () => onTokenRef.current(""),
      });
    }

    if (window.turnstile) {
      render();
      return () => {
        cancelled = true;
      };
    }

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", render);
    // Fallback: skrip mungkin sudah dimuat sebelum listener terpasang.
    const interval = setInterval(() => {
      if (window.turnstile) {
        clearInterval(interval);
        render();
      }
    }, 200);

    return () => {
      cancelled = true;
      clearInterval(interval);
      script?.removeEventListener("load", render);
    };
  }, [siteKey]);

  return <div ref={ref} className="gb-turnstile" />;
}

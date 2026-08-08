"use client";

import { useState } from "react";

import { TurnstileWidget } from "@/components/public/guestbook/turnstile-widget";

/**
 * Field Turnstile untuk form auth (signup/reset) — hardening security review.
 * Merender widget HANYA bila site key ada (dev tanpa key → tak dirender, server
 * melewati verifikasi). Token disimpan di hidden input `name="turnstile"` yang
 * dibaca Server Action. Site key `NEXT_PUBLIC_*` di-inline ke bundel klien.
 */
export function TurnstileField() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [token, setToken] = useState("");
  if (!siteKey) return null;
  return (
    <div>
      <input type="hidden" name="turnstile" value={token} />
      <TurnstileWidget siteKey={siteKey} onToken={setToken} />
    </div>
  );
}

"use client";

import Link from "next/link";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";
import { signUpAction } from "@/server/actions/auth";
import { idleState } from "@/server/actions/types";

import { FieldError, FormAlert } from "./form-parts";
import { PasswordInput } from "./password-input";
import { TurnstileField } from "./turnstile-field";

/**
 * Minta tantangan Turnstile BARU setiap kali kiriman ditolak dengan token yang
 * sudah terpakai. Urutan aksi auth: Zod → rate limit → Turnstile → DB, jadi
 * penolakan validasi (`fieldErrors`) terjadi sebelum verifikasi dan tokennya
 * masih sah — di situ widget dibiarkan (DECISIONS #46 — koreksi review).
 */
function useTurnstileReset(state: { status: string; fieldErrors?: unknown }) {
  const [resetKey, setResetKey] = useState(0);
  useEffect(() => {
    if (!(state.status === "error" && !state.fieldErrors)) return;
    // setState di callback timer, bukan sinkron di badan efek → tak memicu
    // `set-state-in-effect` (pola yang sama dipakai di seluruh repo ini).
    const id = setTimeout(() => setResetKey((n) => n + 1), 0);
    return () => clearTimeout(id);
  }, [state]);
  return resetKey;
}

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(signUpAction, idleState);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const tsReset = useTurnstileReset(state);
  const done = state.status === "success";

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert state={state} />

      <div className="space-y-1.5">
        <Label htmlFor="full_name">{copy.auth.fullName}</Label>
        <Input
          id="full_name"
          name="full_name"
          autoComplete="name"
          required
          aria-invalid={Boolean(fieldErrors?.full_name)}
        />
        <FieldError errors={fieldErrors?.full_name} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">{copy.auth.email}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(fieldErrors?.email)}
        />
        <FieldError errors={fieldErrors?.email} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">{copy.auth.phone}</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          aria-invalid={Boolean(fieldErrors?.phone)}
        />
        <p className="text-muted-foreground text-xs">{copy.auth.phoneHint}</p>
        <FieldError errors={fieldErrors?.phone} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">{copy.auth.password}</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          hint={copy.auth.passwordHint}
          aria-invalid={Boolean(fieldErrors?.password)}
        />
        <FieldError errors={fieldErrors?.password} />
      </div>

      <TurnstileField resetKey={tsReset} />

      <Button type="submit" className="w-full" disabled={pending || done}>
        {copy.auth.registerCta}
      </Button>

      {/* Notis, bukan checkbox: dasar pemrosesannya PERJANJIAN, bukan
          persetujuan (DECISIONS #58), jadi centang tak diwajibkan hukum dan
          hanya menambah satu langkah di funnel akuisisi. Yang wajib adalah
          pemberitahuannya — dan tautannya harus hidup di sini, bukan hanya di
          footer. */}
      <p className="text-muted-foreground text-center text-xs">
        {copy.auth.termsNoticeBefore}{" "}
        <Link href="/syarat" className="underline underline-offset-4">
          {copy.marketing.legal.terms.title}
        </Link>{" "}
        {copy.auth.termsNoticeAnd}{" "}
        <Link href="/privasi" className="underline underline-offset-4">
          {copy.marketing.legal.privacy.title}
        </Link>
        .
      </p>
    </form>
  );
}

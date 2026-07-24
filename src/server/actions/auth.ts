"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { copy } from "@/lib/copy";
import { appUrl } from "@/lib/env";
import { normalizeIndonesianPhone } from "@/lib/phone";
import { safeNextPath } from "@/lib/safe-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  loginSchema,
  registerSchema,
  resetRequestSchema,
  updatePasswordSchema,
} from "@/lib/validation/auth";

import { errorState, fieldErrorState, type ActionState } from "./types";

/**
 * Server Actions autentikasi (SPEC §4.2). Pola wajib: validasi Zod ulang di
 * server → operasi Supabase Auth → redirect/hasil. Alur mengikuti @supabase/ssr:
 *  - verifikasi email  → tautan menuju /auth/confirm (verifyOtp)
 *  - Google OAuth      → /auth/callback (exchangeCodeForSession)
 *  - reset kata sandi  → /auth/confirm (type=recovery) → /reset-password/ubah
 *
 * TODO(M2): rate limit + Turnstile pada signup/login/reset (anti brute-force &
 * email bombing). Interim: rate-limit bawaan Supabase Auth ([auth.rate_limit]).
 */

// --- Register ----------------------------------------------------------------
export async function signUpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone") ?? undefined,
  });
  if (!parsed.success) {
    return fieldErrorState(parsed.error.flatten().fieldErrors);
  }

  const { full_name, email, password, phone } = parsed.data;
  const normalizedPhone = phone ? normalizeIndonesianPhone(phone) : null;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appUrl}/auth/confirm`,
      data: {
        full_name,
        ...(normalizedPhone ? { phone: normalizedPhone } : {}),
      },
    },
  });

  if (error) {
    // "Email sudah terdaftar" diperlakukan sama seperti sukses agar tidak
    // membocorkan keberadaan akun (enumerasi) — independen dari toggle
    // "Confirm email" Supabase. Error lain → pesan generik. (Temuan review M1.1.)
    const alreadyRegistered =
      error.code === "user_already_exists" ||
      /already.*regist/i.test(error.message);
    if (!alreadyRegistered) {
      return errorState(copy.auth.genericAuthError);
    }
  }

  // Respons identik untuk email baru & yang sudah terdaftar → hindari enumerasi.
  return { status: "success", message: copy.auth.signupSuccess };
}

// --- Login -------------------------------------------------------------------
export async function signInAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return fieldErrorState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return errorState(copy.auth.invalidCredentials);
  }

  const next = safeNextPath(formData.get("next")?.toString());
  revalidatePath("/dashboard", "layout");
  redirect(next);
}

// --- Google OAuth ------------------------------------------------------------
export async function signInWithGoogleAction(
  formData: FormData,
): Promise<void> {
  const next = safeNextPath(formData.get("next")?.toString());
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    redirect("/masuk?error=oauth");
  }
  redirect(data.url);
}

// --- Minta reset kata sandi --------------------------------------------------
export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetRequestSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return fieldErrorState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl}/auth/confirm?next=/reset-password/ubah`,
  });

  // Selalu sukses generik → hindari enumerasi email terdaftar.
  return { status: "success", message: copy.auth.resetSent };
}

// --- Simpan kata sandi baru (butuh sesi recovery aktif) ----------------------
export async function updatePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return fieldErrorState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return errorState(copy.auth.genericAuthError);
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return errorState(copy.auth.genericAuthError);
  }

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}

// --- Keluar ------------------------------------------------------------------
export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/dashboard", "layout");
  redirect("/masuk");
}

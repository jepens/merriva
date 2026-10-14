"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { stashNextForConfirm } from "@/lib/auth/after-confirm";
import { isFreshEmailGrant } from "@/lib/auth/email-grant";
import { copy } from "@/lib/copy";
import { appUrl, appUrlMasihDefault } from "@/lib/env";
import { reportHandledError } from "@/lib/observability";
import { normalizeIndonesianPhone } from "@/lib/phone";
import {
  checkClientRateLimit,
  getClientIp,
  staticRateKey,
} from "@/lib/request-ip";
import { safeNextPath } from "@/lib/safe-redirect";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";
import {
  changePasswordSchema,
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
 * Hardening (security review pra-launch): rate-limit per-jaringan pada login/
 * signup/reset + Turnstile pada signup/reset (anti brute-force & email bombing).
 * Lapis tambahan di atas rate-limit bawaan Supabase Auth ([auth.rate_limit]).
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

  // Rate-limit per-jaringan + Turnstile (anti pembuatan akun massal / bot).
  if (
    !(
      await checkClientRateLimit("auth-signup", {
        max: 5,
        windowMs: 60_000,
      })
    ).ok
  ) {
    return errorState(copy.auth.rateLimited);
  }
  const clientIp = await getClientIp();
  if (
    !(await verifyTurnstile(formData.get("turnstile")?.toString(), clientIp))
  ) {
    return errorState(copy.auth.turnstileFailed);
  }

  const { full_name, email, password, phone } = parsed.data;
  const normalizedPhone = phone ? normalizeIndonesianPhone(phone) : null;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // TIDAK membentuk tautan di email. Templat Supabase (AUTH-SETUP §2)
      // membangunnya sendiri dari `{{ .SiteURL }}`; nilai ini hanya divalidasi
      // GoTrue terhadap daftar izin Redirect URL. Karena itu tujuan lanjutan
      // dititipkan lewat cookie, bukan lewat sini (DECISIONS #80).
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
      // Anti-enumerasi mengatur JAWABAN ke pengguna, bukan jejak diagnostik di
      // server. Tanpa baris ini kegagalan kirim email verifikasi tak terlihat
      // di mana pun: pendaftar hanya melihat pesan generik dan tim tak pernah
      // tahu funnel akuisisi mati (AUDIT-2026-10-01 A1 — jalur daftar belum
      // pernah sekali pun berhasil di proyek produksi).
      // `extra` ikut terkirim ke Sentry → JANGAN memuat email atau nama.
      reportHandledError(error, "auth.signup", {
        code: error.code ?? null,
        status: error.status ?? null,
      });
      return errorState(copy.auth.genericAuthError);
    }
  }

  // Dititipkan SETELAH gerbang galat, dan sengaja juga untuk kasus "sudah
  // terdaftar": keduanya menjawab hal yang sama ke pengguna (anti-enumerasi),
  // jadi keduanya harus BERPERILAKU sama juga — cookie yang hanya muncul pada
  // email baru adalah pembeda yang bisa diamati dari luar.
  await stashNextForConfirm(formData.get("next"));

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

  // Dua lapis, dan lapis AKUN yang menentukan (AUDIT-2026-10-01 B4).
  //
  // Sebelumnya hanya ada plafon per-jaringan. Credential stuffing datang
  // terdistribusi dari ribuan IP — botnet atau VPN murah membuat plafon itu
  // praktis tak terbatas terhadap SATU akun. Yang dipertaruhkan bukan sekadar
  // gangguan: sekali masuk, penyerang melihat seluruh daftar tamu berikut nomor
  // HP-nya, dan bisa MENGGANTI nomor rekening amplop digital pada undangan yang
  // sudah aktif — hadiah uang tamu mengalir ke rekening lain.
  //
  // Polanya identik dengan `requestPasswordResetAction`. Kuncinya di-hash
  // (`staticRateKey`) sehingga alamat email tak pernah jadi kunci mentah di
  // memori proses.
  if (
    !(
      await checkClientRateLimit(
        "auth-signin",
        { max: 10, windowMs: 60_000 },
        undefined,
        [
          {
            key: staticRateKey(
              "auth-signin-email",
              parsed.data.email.toLowerCase(),
            ),
            opts: { max: 8, windowMs: 900_000 },
          },
        ],
      )
    ).ok
  ) {
    return errorState(copy.auth.rateLimited);
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

  // Berhenti SEBELUM memulai tarian OAuth bila `redirect_to` yang akan dikirim
  // menunjuk localhost. Tanpa ini kegagalannya sunyi dan menyesatkan: Supabase
  // menolak `redirect_to` yang tak ada di daftar izin lalu jatuh ke Site URL,
  // sehingga `?code=` mendarat di HALAMAN DEPAN — bukan di `/auth/callback` —
  // tak ada yang menukarnya menjadi sesi, dan pengguna hanya melihat beranda
  // lagi seolah tak terjadi apa-apa. Tak ada galat di mana pun.
  if (appUrlMasihDefault() && process.env.NODE_ENV === "production") {
    reportHandledError(
      new Error(
        "NEXT_PUBLIC_APP_URL kosong di produksi — redirect_to OAuth menunjuk localhost",
      ),
      "auth.oauth.config",
      { redirectTo: `${appUrl}/auth/callback` },
    );
    redirect("/masuk?error=config");
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    // Provider Google salah konfigurasi (redirect URI, client secret kedaluwarsa)
    // tampak identik dengan "pengguna membatalkan" bagi tim: keduanya berakhir
    // di `?error=oauth`. Laporkan agar salah-konfigurasi punya jejak.
    reportHandledError(error ?? new Error("oauth: url kosong"), "auth.oauth", {
      code: error?.code ?? null,
      status: error?.status ?? null,
    });
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

  // Turnstile DULU, baru rate-limit per-jaringan + per-email (anti email-bombing
  // korban) dalam SATU keputusan semua-atau-tidak. SEMUA kegagalan → sukses
  // generik yang DIAM-DIAM tak mengirim, agar tak membocorkan keberadaan email
  // maupun status rate-limit (anti-enumerasi). Turnstile didahulukan supaya
  // request tanpa token sah tak membuat kunci limiter apa pun: email acak tak
  // bisa dipakai mengisi memori limiter lalu mendesak penghitung lain — termasuk
  // plafon email korban — keluar (DECISIONS #39).
  const clientIp = await getClientIp();
  const human = await verifyTurnstile(
    formData.get("turnstile")?.toString(),
    clientIp,
  );
  const limitOk =
    human &&
    (
      await checkClientRateLimit(
        "auth-reset-ip",
        { max: 5, windowMs: 60_000 },
        undefined,
        [
          {
            key: staticRateKey(
              "auth-reset-email",
              parsed.data.email.toLowerCase(),
            ),
            opts: { max: 3, windowMs: 900_000 },
          },
        ],
      )
    ).ok;

  if (limitOk) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
      { redirectTo: `${appUrl}/auth/confirm?next=/reset-password/ubah` },
    );
    // Jawaban ke pengguna TETAP sukses generik (anti-enumerasi), tetapi
    // kegagalannya wajib meninggalkan jejak. Bila Custom SMTP proyek belum
    // disetel, Supabase MENOLAK mengirim ke alamat di luar anggota tim — dan
    // tanpa baris ini pengguna melihat "tautan sudah dikirim" selamanya sementara
    // tak ada satu pun sinyal ke tim (AUDIT-2026-10-01 A1).
    if (error) {
      reportHandledError(error, "auth.reset", {
        code: error.code ?? null,
        status: error.status ?? null,
      });
    }
  }

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

  // Sebelumnya `getUser()` tak-null adalah SATU-SATUNYA syarat, sehingga sesi
  // dashboard biasa pun lolos: siapa pun yang memegang perangkat yang masih
  // login bisa mengganti kata sandi tanpa tahu yang lama, permanen dan tanpa
  // notifikasi (AUDIT-2026-10-01 B1). Jalur TANPA kata sandi lama kini hanya
  // untuk sesi yang baru lahir dari klik tautan email; sisanya diarahkan ke
  // form ganti kata sandi di profil yang menuntut kata sandi saat ini.
  const { data: klaim } = await supabase.auth.getClaims();
  if (!isFreshEmailGrant(klaim?.claims?.amr, Math.floor(Date.now() / 1000))) {
    return errorState(copy.auth.recoveryGrantMissing);
  }

  // Berbeda dari `signInAction` & `requestPasswordResetAction`, aksi ini dulu
  // tak punya rate limit sama sekali.
  if (
    !(
      await checkClientRateLimit("auth-update-pw", {
        max: 10,
        windowMs: 60_000,
      })
    ).ok
  ) {
    return errorState(copy.auth.rateLimited);
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    // Kata sandi baru ditolak GoTrue (mis. kebijakan panjang/kebocoran di sisi
    // server, sesi recovery kedaluwarsa) hanya tampak sebagai "coba lagi" bagi
    // pengguna — jejaknya dibutuhkan untuk membedakan kebijakan dari kerusakan.
    reportHandledError(error, "auth.update-password", {
      code: error.code ?? null,
      status: error.status ?? null,
    });
    return errorState(copy.auth.genericAuthError);
  }

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}

// --- Ganti kata sandi dari dalam akun ---------------------------------------
/**
 * Ganti kata sandi tanpa melewati jalur "lupa kata sandi" (AUDIT-2026-10-01 B1).
 *
 * Sebelum ini produk sama sekali tak punya jalurnya: pelanggan yang hanya ingin
 * mengganti sandi harus berpura-pura lupa dan menunggu email. Lebih buruk,
 * `/reset-password/ubah` bisa dibuka oleh sesi dashboard biasa, sehingga siapa
 * pun yang memegang perangkat yang masih login bisa mengganti kata sandi tanpa
 * tahu yang lama.
 *
 * Kata sandi lama diverifikasi SENDIRI, bukan diserahkan ke `current_password`
 * milik GoTrue: parameter itu hanya divalidasi bila setelan proyek
 * `REQUIRE_CURRENT_PASSWORD` aktif, dan bila mati ia DIABAIKAN DIAM-DIAM —
 * kodenya akan tampak aman sambil tidak memeriksa apa pun. Verifikasi memakai
 * klien anon TANPA cookie (`createSupabasePublicClient`) agar sesi pengguna di
 * cookie tidak ikut ditulis ulang oleh percobaan login ini.
 */
export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return errorState(copy.auth.genericAuthError);
  }

  const parsed = changePasswordSchema.safeParse({
    current: formData.get("current"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return fieldErrorState(parsed.error.flatten().fieldErrors);
  }

  // Dibatasi per AKUN, bukan hanya per jaringan: tanpa ini form ini menjadi
  // oracle untuk menebak kata sandi pemilik sesi yang dicuri.
  if (
    !(
      await checkClientRateLimit(
        "auth-change-pw",
        { max: 10, windowMs: 60_000 },
        undefined,
        [
          {
            key: staticRateKey("auth-change-pw-user", user.id),
            opts: { max: 5, windowMs: 900_000 },
          },
        ],
      )
    ).ok
  ) {
    return errorState(copy.auth.rateLimited);
  }

  const verifier = createSupabasePublicClient();
  const { error: wrongCurrent } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.current,
  });
  if (wrongCurrent) {
    return fieldErrorState({ current: [copy.auth.currentPasswordWrong] });
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    reportHandledError(error, "auth.change-password", {
      code: error.code ?? null,
      status: error.status ?? null,
    });
    return errorState(copy.auth.genericAuthError);
  }

  revalidatePath("/dashboard", "layout");
  return { status: "success", message: copy.auth.passwordChanged };
}

// --- Keluar ------------------------------------------------------------------
export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/dashboard", "layout");
  redirect("/masuk");
}

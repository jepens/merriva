/**
 * Penyaring PII untuk Sentry (DECISIONS #46 — koreksi temuan review).
 *
 * `guests.token` adalah IDENTITAS tamu (SPEC §11; kelak QR check-in Fase 2) dan
 * hidup di URL undangan: `/{slug}?g={token}`. Menjauhkannya dari `extra` saja
 * TIDAK cukup — Sentry melampirkan data request ke setiap event yang ditangkap
 * di dalam request itu, dan Server Action Next 16 di-POST ke `canonicalUrl`
 * (URL halaman, lengkap dengan `?g=`). Akibatnya satu kedipan DB di resepsi
 * 300 tamu bisa menumpahkan ratusan token tamu yang masih berlaku ke pelacak
 * isu pihak ketiga — siapa pun yang bisa membacanya dapat menimpa RSVP tamu
 * atau memakai identitasnya.
 *
 * Token itu muncul di LEBIH BANYAK tempat daripada yang terlihat:
 *  - `request.url` & `request.query_string`;
 *  - **`request.headers.referer`** — POST Server Action bersifat same-origin,
 *    dan `Referrer-Policy: strict-origin-when-cross-origin` mengirim URL penuh;
 *  - **`request.cookies` & header `cookie`** — bukan token tamu, tetapi memuat
 *    sesi unggah Album Momen ber-tanda-tangan dan token auth Supabase pemilik;
 *  - `contexts.*` (mis. `contexts.nextjs.request_path` dari `onRequestError`),
 *    atribut span, breadcrumb, dan pesan exception;
 *  - badan request Server Action (RSVP/amplop membawa `guestToken`).
 * Dengan `sendDefaultPii: false` Sentry TETAP melampirkan header & cookie:
 * defaultnya objek `{deny: …}`, dan gerbangnya hanya `!== false`.
 *
 * FAIL-CLOSED: bila penyaringan sendiri gagal, event DIBUANG (`null`) alih-alih
 * dikirim setengah bersih.
 *
 * Tanpa `server-only`: dipakai juga oleh konfigurasi Sentry sisi klien.
 */

/** `?g=`, `token=`, `guest_token=` — di URL penuh maupun query string telanjang. */
const SENSITIVE_PARAM =
  /(^|[?&])(g|token|guest_?token|guestToken)=([^&#\s"']*)/gi;

const REDACTED = "[redacted]";

/** Ganti NILAI parameter identitas tamu; sisa URL dibiarkan agar tetap berguna. */
export function redactGuestToken(value: string): string {
  return value.replace(
    SENSITIVE_PARAM,
    (_m, sep, key) => `${sep}${key}=${REDACTED}`,
  );
}

const SENSITIVE_KEYS = new Set([
  "g",
  "token",
  "guest_token",
  "guesttoken",
  "turnstiletoken",
]);

/** Header yang dibuang utuh: isinya kredensial, bukan diagnostik. */
const DROPPED_HEADERS = new Set([
  "cookie",
  "authorization",
  "proxy-authorization",
]);

/** Bentuk event Sentry seadanya — sengaja struktural, agar lib ini bebas dependensi. */
export interface ScrubbableEvent {
  request?: {
    url?: string;
    query_string?: string | Record<string, unknown> | [string, string][];
    data?: unknown;
    headers?: Record<string, unknown>;
    cookies?: unknown;
  };
  contexts?: Record<string, Record<string, unknown> | undefined>;
  spans?: { data?: Record<string, unknown> }[];
  breadcrumbs?: { data?: Record<string, unknown> }[];
  exception?: { values?: { value?: string }[] };
}

/** Bersihkan setiap nilai string di kantong atribut (span/breadcrumb/context). */
function scrubBag(bag: Record<string, unknown> | undefined): void {
  if (!bag) return;
  for (const [k, v] of Object.entries(bag)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      bag[k] = REDACTED;
    } else if (typeof v === "string") {
      bag[k] = redactGuestToken(v);
    }
  }
}

/** `contexts.trace.data`, `contexts.nextjs.request_path`, dan sejenisnya. */
function scrubContexts(contexts: ScrubbableEvent["contexts"]): void {
  if (!contexts) return;
  for (const ctx of Object.values(contexts)) {
    if (!ctx || typeof ctx !== "object") continue;
    scrubBag(ctx);
    const data = (ctx as { data?: unknown }).data;
    if (data && typeof data === "object") {
      scrubBag(data as Record<string, unknown>);
    }
  }
}

function scrubRequest(req: NonNullable<ScrubbableEvent["request"]>): void {
  if (typeof req.url === "string") req.url = redactGuestToken(req.url);
  if (typeof req.query_string === "string") {
    req.query_string = redactGuestToken(req.query_string);
  } else if (Array.isArray(req.query_string)) {
    req.query_string = req.query_string.map(([k, v]) =>
      SENSITIVE_KEYS.has(k.toLowerCase()) ? [k, REDACTED] : [k, v],
    ) as [string, string][];
  } else if (req.query_string && typeof req.query_string === "object") {
    scrubBag(req.query_string as Record<string, unknown>);
  }

  // `referer` membawa URL halaman UTUH pada POST Server Action same-origin.
  if (req.headers && typeof req.headers === "object") {
    for (const key of Object.keys(req.headers)) {
      if (DROPPED_HEADERS.has(key.toLowerCase())) delete req.headers[key];
    }
    scrubBag(req.headers);
  }

  // Cookie = kredensial (sesi unggah Momen, auth Supabase pemilik).
  delete req.cookies;
  // Badan Server Action RSVP/amplop memuat `guestToken`; tak pernah dikirim.
  delete req.data;
}

/**
 * Buang identitas tamu dari sebuah event sebelum dikirim. Dipasang sebagai
 * `beforeSend` DAN `beforeSendTransaction` (transaksi membawa data request yang
 * sama). Mengembalikan `null` = event dibuang.
 */
export function scrubSentryEvent<T extends ScrubbableEvent>(
  event: T,
): T | null {
  try {
    if (event.request) scrubRequest(event.request);
    scrubContexts(event.contexts);
    for (const span of event.spans ?? []) scrubBag(span.data);
    for (const crumb of event.breadcrumbs ?? []) scrubBag(crumb.data);
    for (const ex of event.exception?.values ?? []) {
      if (typeof ex.value === "string") ex.value = redactGuestToken(ex.value);
    }
    return event;
  } catch {
    // Lebih baik kehilangan satu event daripada mengirim yang belum bersih.
    return null;
  }
}

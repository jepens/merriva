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
 * Yang dibersihkan: URL & query string request, atribut span ber-URL, breadcrumb,
 * dan **badan request dibuang seluruhnya** (payload Server Action RSVP/amplop
 * membawa `guestToken` di dalamnya).
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

/** Bentuk event Sentry seadanya — sengaja struktural, agar lib ini bebas dependensi. */
export interface ScrubbableEvent {
  request?: {
    url?: string;
    query_string?: string | Record<string, unknown> | [string, string][];
    data?: unknown;
    headers?: Record<string, string>;
  };
  contexts?: { trace?: { data?: Record<string, unknown> } };
  spans?: { data?: Record<string, unknown> }[];
  breadcrumbs?: { data?: Record<string, unknown> }[];
  exception?: { values?: { value?: string }[] };
}

/** Bersihkan setiap nilai string di kantong atribut (span/breadcrumb/trace). */
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

/**
 * Buang identitas tamu dari sebuah event sebelum dikirim. Dipasang sebagai
 * `beforeSend` DAN `beforeSendTransaction` (transaksi membawa atribut URL yang
 * sama lewat span).
 */
export function scrubSentryEvent<T extends ScrubbableEvent>(event: T): T {
  const req = event.request;
  if (req) {
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
    // Badan Server Action RSVP/amplop memuat `guestToken`; tak pernah dikirim.
    delete req.data;
  }

  scrubBag(event.contexts?.trace?.data);
  for (const span of event.spans ?? []) scrubBag(span.data);
  for (const crumb of event.breadcrumbs ?? []) scrubBag(crumb.data);
  for (const ex of event.exception?.values ?? []) {
    if (typeof ex.value === "string") ex.value = redactGuestToken(ex.value);
  }
  return event;
}

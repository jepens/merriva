import * as Sentry from "@sentry/nextjs";

import { SENTRY_DATA_COLLECTION, scrubSentryEvent } from "@/lib/sentry-scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    enabled: process.env.NODE_ENV === "production",
    // v11 membuat default `dataCollection` LEBIH PERMISIF daripada v10:
    // dibiarkan kosong, ia mengumpulkan IP, cookie, header, dan badan
    // request/response. Baseline-nya karena itu wajib eksplisit.
    dataCollection: SENTRY_DATA_COLLECTION,
    // v11 menjadikan span streaming sebagai default, dan di mode itu
    // `beforeSendTransaction` NO-OP — penapis di bawah tak akan pernah
    // dipanggil untuk data request yang dibawa transaksi, sehingga token tamu
    // lolos ke atribut span. `'static'` adalah opt-out RESMI ("Opting out of
    // span streaming"), bukan jalan pintas, dan ia mempertahankan model yang
    // sudah dijaga DECISIONS #46 apa adanya. Port ke `beforeSendSpan` +
    // `ignoreSpans` ditunda SENGAJA: memindahkan logika keamanan ke bentuk
    // callback baru pada commit yang sama dengan bump mayor adalah dua
    // perubahan berisiko yang saling menutupi.
    traceLifecycle: "static",
    // `?g={token}` ikut di URL request setiap Server Action tamu; tanpa ini
    // identitas tamu tersimpan di Sentry (DECISIONS #46).
    beforeSend: scrubSentryEvent,
    beforeSendTransaction: scrubSentryEvent,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

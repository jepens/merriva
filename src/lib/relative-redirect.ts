import { NextResponse } from "next/server";

/**
 * Redirect dengan header `Location` RELATIF.
 *
 * KENAPA ADA. `NextResponse.redirect()` menuntut URL absolut, dan satu-satunya
 * origin yang tersedia di dalam Route Handler — `new URL(request.url).origin` —
 * SALAH di produksi. `next.config.ts` memakai `output: "standalone"` dan
 * Dockerfile stage `runner` menyetel `HOSTNAME=0.0.0.0` + `PORT=3000`; Next lalu
 * merakit `request.url` dari alamat yang DIIKAT server, bukan dari header `Host`
 * yang dikirim Traefik/Cloudflare:
 *
 *   // next/dist/server/next-server.js
 *   const initUrl = this.fetchHostname && this.port
 *     ? `${protocol}://${this.fetchHostname}:${this.port}${req.url}`
 *     : this.nextConfig.experimental.trustHostHeader
 *       ? `https://${req.headers.host || "localhost"}${req.url}` : req.url;
 *
 * Header `Host` hanya dibaca di cabang kedua, dan cabang itu mati karena
 * `trustHostHeader` tidak kita nyalakan. Hasilnya `https://0.0.0.0:3000` — dan
 * `https`-nya datang dari `x-forwarded-proto` Cloudflare, sehingga URL-nya
 * tampak meyakinkan sambil tetap mustahil dibuka (DECISIONS #77).
 *
 * `Location` relatif diselesaikan oleh PERAMBAN terhadap URL yang ia minta,
 * jadi ia selalu benar tanpa bergantung pada konfigurasi apa pun — termasuk
 * bila `NEXT_PUBLIC_APP_URL` kelak salah lagi, atau bila permintaan datang di
 * host lain yang memegang cookie yang baru saja ditulis.
 *
 * Cookie sesi tetap ikut. Next menempelkannya ke Response APA PUN yang handler
 * kembalikan, bukan hanya ke hasil `NextResponse.redirect()`:
 *
 *   // next/dist/server/route-modules/app-route/module.js
 *   const headers = new Headers(res.headers);
 *   if (appendMutableCookies(headers, requestStore.mutableCookies)) {
 *     return new Response(res.body, { status, statusText, headers });
 *   }
 */

/** Basis boneka: hanya dipakai untuk menormalkan, host-nya tak pernah terkirim. */
const BASIS = "http://n";

/**
 * @param path Path internal yang SUDAH disanitasi `safeNextPath()` — diawali
 *   `/`, bukan `//`, tanpa karakter kontrol maupun backslash.
 */
export function relativeRedirect(path: string): NextResponse {
  // Normalisasi, bukan validasi: `safeNextPath` mengizinkan spasi (0x20 lolos
  // ambang 0x1f) dan UTF-8, sedangkan nilai header HTTP di luar Latin-1 tidak
  // konforman dan bisa diperlakukan berbeda oleh Traefik maupun Cloudflare.
  // `new URL()` melakukan persen-encoding yang SAMA dengan yang selama ini
  // dilakukan `NextResponse.redirect()` diam-diam, jadi perbaikan ini tidak
  // menukar bug kasar dengan bug halus.
  const u = new URL(path, BASIS);
  return new NextResponse(null, {
    status: 303,
    headers: { Location: `${u.pathname}${u.search}${u.hash}` },
  });
}

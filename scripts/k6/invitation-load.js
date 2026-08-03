/**
 * Uji beban halaman undangan publik (ROADMAP M4 / SPEC §10). Mensimulasikan
 * "WA-blast": banyak tamu membuka `/{slug}` bersamaan. Target = jalur ISR/static
 * yang KRITIS bagi LCP (bukan dashboard). Jalankan pada build PRODUCTION di
 * staging/Docker — BUKAN `next dev` (dev tak teroptimasi → angka menyesatkan).
 *
 * Instal k6 (grafana/k6), lalu:
 *   k6 run -e BASE_URL=https://staging.merriva.id -e SLUG=<slug-aktif> scripts/k6/invitation-load.js
 *   # atau: pnpm loadtest  (baca BASE_URL/SLUG dari environment)
 *
 * Profil: naik ke 200 VU (~200 concurrent), tahan 1 menit, turun. Ambang lulus:
 * error < 1% dan p95 waktu respons < 800 ms (halaman ISR seharusnya jauh di
 * bawah ini bila cache hangat). Sesuaikan target VU/durasi via -e bila perlu.
 *
 * CATATAN: gunakan undangan yang SUDAH AKTIF (status `active`) dengan slug asli;
 * halaman `draft-…`/kedaluwarsa akan 404/expired dan bukan uji kapasitas valid.
 * Jalur personal `?g=token` sengaja TIDAK diuji di sini karena menulis
 * `first_viewed_at` (uji tulis = ranah terpisah).
 */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3000").replace(
  /\/+$/,
  "",
);
const SLUG = __ENV.SLUG || "";
const TARGET_VUS = Number(__ENV.VUS || 200);

export const options = {
  scenarios: {
    wa_blast: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: __ENV.RAMP || "30s", target: TARGET_VUS },
        { duration: __ENV.HOLD || "1m", target: TARGET_VUS },
        { duration: "20s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"], // < 1% error
    http_req_duration: ["p(95)<800", "p(99)<1500"],
  },
};

export function setup() {
  if (!SLUG) {
    throw new Error(
      "SLUG wajib: k6 run -e SLUG=<slug-undangan-aktif> -e BASE_URL=... scripts/k6/invitation-load.js",
    );
  }
  // Pra-cek: halaman harus 200 sebelum membebani (gagal cepat bila salah slug/url).
  const probe = http.get(`${BASE_URL}/${SLUG}`);
  if (probe.status !== 200) {
    throw new Error(
      `Pra-cek gagal: GET ${BASE_URL}/${SLUG} → ${probe.status} (butuh undangan AKTIF, slug asli).`,
    );
  }
  return { url: `${BASE_URL}/${SLUG}` };
}

export default function (data) {
  const res = http.get(data.url, {
    headers: { "User-Agent": "k6-loadtest-merriva" },
  });
  check(res, {
    "status 200": (r) => r.status === 200,
    "terkirim HTML": (r) => (r.body ? r.body.length > 500 : false),
  });
  sleep(1);
}

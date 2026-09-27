import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Invarian PER-3 (AUDIT-2026-09-04): rate limit tidak boleh lagi di-key pada
 * JARINGAN saja. Di WiFi venue seluruh tamu tampak sebagai satu alamat publik,
 * sehingga plafon lama (20 sesi/menit, 60 foto/menit per /24) membuat Album
 * Momen tak layak dipakai di resepsi — tamu ke-21 tidak bisa masuk dan acara
 * berhenti di 60 foto/menit.
 *
 * Berbeda dari `momen-guest-upload.test.ts`, berkas ini memakai limiter ASLI dan
 * keying IP ASLI (`next/headers` yang dipalsukan hanya menyuplai alamatnya),
 * sehingga yang diuji adalah perilaku pembentukan kunci sesungguhnya.
 */

const { ipRef, cookieRef } = vi.hoisted(() => ({
  ipRef: { current: "203.0.113.7" },
  cookieRef: { current: "" },
}));

vi.mock("next/headers", () => ({
  headers: () =>
    Promise.resolve(new Headers({ "cf-connecting-ip": ipRef.current })),
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        name === "momen_sess" && cookieRef.current
          ? { value: cookieRef.current }
          : undefined,
      set: vi.fn(),
    }),
}));

const { storage } = vi.hoisted(() => ({
  storage: {
    upload: vi.fn(() => Promise.resolve("p")),
    delete: vi.fn(() => Promise.resolve()),
    getPublicUrl: (p: string) => `https://cdn.test/${p}`,
  },
}));
vi.mock("@/lib/storage", () => ({ getStorage: () => storage }));

const { adminRef } = vi.hoisted(() => ({
  adminRef: { current: null as never },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => adminRef.current,
}));

import { __resetRateLimit } from "@/lib/rate-limit";
import { signMomenSession } from "@/lib/momen/session";
import { uploadMomenPhotoAction } from "@/server/actions/momen-guest";

const ALBUM = "11111111-1111-4111-8111-111111111111";
const DEVICE_A = "33333333-3333-4333-8333-333333333333";
const DEVICE_B = "44444444-4444-4444-8444-444444444444";
const SLUG = "andi-sinta";
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

function makeAdmin() {
  const rpc = vi.fn((fn: string) =>
    fn === "momen_claim_upload"
      ? Promise.resolve({
          data: [{ result: "ok", photo_id: ALBUM, remaining: 9 }],
          error: null,
        })
      : Promise.resolve({
          data: [{ result: "ok", remaining: 9 }],
          error: null,
        }),
  );
  const from = vi.fn((table: string) => {
    const data =
      table === "invitations"
        ? { id: "inv-1", status: "active" }
        : // Pra-cek kepemilikan jepretan: belum ada baris dengan id ini.
          table === "momen_photos"
          ? null
          : {
              id: ALBUM,
              status: "active",
              quota_per_guest: 5,
              allow_library_upload: true,
            };
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.maybeSingle = () => Promise.resolve({ data, error: null });
    return chain;
  });
  return { from, rpc };
}

function photoForm(): FormData {
  const bytes = new Uint8Array([...WEBP, ...new Array(200).fill(0)]);
  const fd = new FormData();
  fd.set("shotId", crypto.randomUUID());
  fd.set("filterId", "hangat");
  fd.set("format", "webp");
  fd.set("source", "camera");
  fd.set("width", "1200");
  fd.set("height", "1600");
  fd.set("displayBytes", "212");
  fd.set("thumbBytes", "212");
  fd.set("display", new File([bytes], "d.webp", { type: "image/webp" }));
  fd.set("thumb", new File([bytes], "t.webp", { type: "image/webp" }));
  return fd;
}

/** Unggah `n` kali sebagai `device`; kembalikan jumlah yang berhasil. */
async function uploadTimes(device: string, n: number, slug = SLUG) {
  cookieRef.current = signMomenSession({
    albumId: ALBUM,
    deviceId: device,
    guestName: "Sasa",
    iat: Date.now(),
  });
  let ok = 0;
  for (let i = 0; i < n; i += 1) {
    const res = await uploadMomenPhotoAction(slug, photoForm());
    if (res.status === "ok") ok += 1;
  }
  return ok;
}

beforeEach(() => {
  process.env.MOMEN_SESSION_SECRET = "test-secret";
  __resetRateLimit();
  storage.upload.mockClear();
  storage.delete.mockClear();
  ipRef.current = "203.0.113.7";
  adminRef.current = makeAdmin() as never;
});

describe("unggah Momen — plafon per PERANGKAT, bukan per jaringan", () => {
  it("satu perangkat berhenti di jatahnya sendiri (20/menit)", async () => {
    expect(await uploadTimes(DEVICE_A, 22)).toBe(20);
  });

  it("tamu LAIN di WiFi yang sama tetap bisa mengunggah setelah tamu pertama habis", async () => {
    // Inti PER-3: dulu kedua tamu berbagi satu bucket /24 sehingga tamu kedua
    // ikut terkunci. Sekarang bucket-nya per perangkat dari sesi ber-tanda-tangan.
    expect(await uploadTimes(DEVICE_A, 20)).toBe(20);
    expect(await uploadTimes(DEVICE_A, 1)).toBe(0); // A memang sudah habis
    expect(await uploadTimes(DEVICE_B, 5)).toBe(5); // B tak ikut terseret
  });

  it("satu venue sanggup melewati 60 foto/menit (plafon lama)", async () => {
    let total = 0;
    for (let i = 0; i < 6; i += 1) {
      total += await uploadTimes(`5555555${i}-5555-4555-8555-555555555555`, 15);
    }
    expect(total).toBe(90);
    expect(total).toBeGreaterThan(60);
  });

  it("rem tepi per-acara tetap ada: tanpa sesi sah, unggah ditolak", async () => {
    cookieRef.current = "";
    const res = await uploadMomenPhotoAction(SLUG, photoForm());
    expect(res.status).toBe("error");
    expect(storage.upload).not.toHaveBeenCalled();
  });
});

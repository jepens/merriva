import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regresi jalur UNGGAH TAMU Album Momen (FASE H #7a). Yang dijaga di sini adalah
 * invarian keamanan yang sebelumnya hanya diverifikasi smoke manual:
 *  - fail-closed tanpa sesi ber-tanda-tangan,
 *  - sesi tak boleh dipakai lintas album,
 *  - magic-byte harus cocok format (tolak PNG menyamar webp) SEBELUM claim/unggah,
 *  - penolakan kuota (claim) tidak boleh menyentuh storage,
 *  - confirm gagal → objek storage dibersihkan (tak meninggalkan sampah),
 *  - identitas yang disimpan diambil dari SESI, bukan dari field form (anti-impersonasi).
 */

const { checkRateLimit, checkClientRateLimit } = vi.hoisted(() => ({
  checkRateLimit: vi.fn(() => ({ ok: true, remaining: 9, retryAfterMs: 0 })),
  checkClientRateLimit: vi.fn(() =>
    Promise.resolve({ ok: true, remaining: 9, retryAfterMs: 0 }),
  ),
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit }));
// Rate limit dipalsukan di sini (perilaku aslinya diuji terpisah di
// `momen-rate-limit.test.ts` & `client-rate-limit.test.ts`); berkas ini fokus
// pada invarian keamanan unggah.
vi.mock("@/lib/request-ip", () => ({
  checkClientRateLimit,
  staticRateKey: (action: string, value: string) => `${action}:${value}`,
  getClientIp: () => Promise.resolve("1.2.3.4"),
}));

const { cookieValue } = vi.hoisted(() => ({ cookieValue: { current: "" } }));
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        name === "momen_sess" && cookieValue.current
          ? { value: cookieValue.current }
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
const { verifyTurnstile } = vi.hoisted(() => ({
  verifyTurnstile: vi.fn(() => Promise.resolve(true)),
}));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile }));
vi.mock("@/lib/storage", () => ({ getStorage: () => storage }));

const { adminRef } = vi.hoisted(() => ({
  adminRef: { current: null as unknown },
}));
/** Penyaring `.eq()` yang benar-benar dikirim ke `momen_photos`. */
let eqCalls: { table: string; col: string; val: unknown }[] = [];
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => adminRef.current,
}));

import { copy } from "@/lib/copy";
import { signMomenSession } from "@/lib/momen/session";
import {
  startMomenSessionAction,
  uploadMomenPhotoAction,
} from "@/server/actions/momen-guest";

const ALBUM = "11111111-1111-4111-8111-111111111111";
const OTHER_ALBUM = "99999999-9999-4999-8999-999999999999";
const PHOTO = "22222222-2222-4222-8222-222222222222";
const DEVICE = "33333333-3333-4333-8333-333333333333";
/** Id jepretan dari klien: stabil lintas percobaan (idempotensi #46). */
const SHOT = "44444444-4444-4444-8444-444444444444";
const SLUG = "andi-sinta";

/** Bentuk galat postgrest-js sungguhan (objek polos, bukan Error). */
const BOOM = {
  message: "canceling statement due to statement timeout",
  details: null,
  hint: null,
  code: "57014",
};

/** Byte header asli agar `matchesDeclaredFormat` diuji sungguhan. */
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function imageFile(magic: number[], type: string, name: string): File {
  const bytes = new Uint8Array([...magic, ...new Array(200).fill(0)]);
  return new File([bytes], name, { type });
}

interface AdminOpts {
  /** Baris `momen_photos` dengan id = shotId sudah ada (kiriman ulang). */
  shotSudahAda?: boolean;
  /** Pemilik baris itu; default = album & perangkat sesi ini. */
  shotRow?: { album_id: string; device_id: string } | null;
  invitationStatus?: string | null;
  albumId?: string | null;
  allowLibraryUpload?: boolean;
  claim?: { data: unknown; error: unknown };
  confirm?: { data: unknown; error: unknown };
  /** Bacaan tabel ini GAGAL (galat DB) — beda dari "barisnya tak ada". */
  readError?: "invitations" | "momen_albums";
}

function makeAdmin(opts: AdminOpts = {}) {
  const {
    invitationStatus = "active",
    albumId = ALBUM,
    allowLibraryUpload = true,
    claim = {
      data: [{ result: "ok", photo_id: PHOTO, remaining: 3 }],
      error: null,
    },
    confirm = { data: [{ result: "ok", remaining: 2 }], error: null },
    readError,
    shotSudahAda = false,
    shotRow = { album_id: ALBUM, device_id: DEVICE },
  } = opts;

  const rpc = vi.fn((fn: string, _args: unknown) => {
    if (fn === "momen_claim_upload") return Promise.resolve(claim);
    if (fn === "momen_confirm_photo") return Promise.resolve(confirm);
    return Promise.resolve({ data: null, error: null });
  });

  const from = vi.fn((table: string) => {
    const data =
      table === "invitations"
        ? invitationStatus
          ? { id: "inv-1", status: invitationStatus }
          : null
        : table === "momen_albums"
          ? albumId
            ? {
                id: albumId,
                status: "active",
                quota_per_guest: 5,
                allow_library_upload: allowLibraryUpload,
              }
            : null
          : null;
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    if (table === "momen_photos") {
      // Pra-cek kepemilikan + hitungan jatah perangkat. Argumen `.eq()` DICATAT:
      // tanpa itu penyaring id/album/device tak pernah teruji (temuan review).
      const filters: Record<string, unknown> = {};
      chain.eq = (col: string, val: unknown) => {
        filters[col] = val;
        eqCalls.push({ table, col, val });
        return chain;
      };
      chain.maybeSingle = () =>
        Promise.resolve({
          data:
            shotSudahAda && filters.id === SHOT && shotRow
              ? { id: SHOT, ...shotRow }
              : null,
          error: null,
        });
      chain.then = (ok: (v: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null, count: 1 }).then(ok);
      return chain;
    }
    chain.maybeSingle = () =>
      Promise.resolve(
        readError === table
          ? { data: null, error: BOOM }
          : { data, error: null },
      );
    return chain;
  });

  return { from, rpc };
}

function form(over: Record<string, string> = {}, magic = WEBP): FormData {
  const fd = new FormData();
  fd.set("shotId", SHOT);
  fd.set("filterId", "hangat");
  fd.set("format", "webp");
  fd.set("source", "camera");
  fd.set("width", "1200");
  fd.set("height", "1600");
  fd.set("displayBytes", "212");
  fd.set("thumbBytes", "212");
  for (const [k, v] of Object.entries(over)) fd.set(k, v);
  fd.set("display", imageFile(magic, "image/webp", "display.webp"));
  fd.set("thumb", imageFile(magic, "image/webp", "thumb.webp"));
  return fd;
}

function signFor(albumId: string, guestName = "Sasa"): string {
  return signMomenSession({
    albumId,
    deviceId: DEVICE,
    guestName,
    iat: Date.now(),
  });
}

beforeEach(() => {
  process.env.MOMEN_SESSION_SECRET = "test-secret";
  checkRateLimit.mockReturnValue({ ok: true, remaining: 9, retryAfterMs: 0 });
  checkClientRateLimit.mockResolvedValue({
    ok: true,
    remaining: 9,
    retryAfterMs: 0,
  });
  verifyTurnstile.mockResolvedValue(true);
  storage.upload.mockReset();
  storage.upload.mockResolvedValue("p");
  storage.delete.mockReset();
  storage.delete.mockResolvedValue(undefined);
  cookieValue.current = "";
  eqCalls = [];
  adminRef.current = makeAdmin();
});

describe("uploadMomenPhotoAction — fail-closed", () => {
  it("tanpa cookie sesi → ditolak; tak menyentuh RPC maupun storage", async () => {
    const admin = makeAdmin();
    adminRef.current = admin;

    const res = await uploadMomenPhotoAction(SLUG, form());

    expect(res.status).toBe("error");
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("cookie di-tamper → ditolak (tanda tangan tak sah)", async () => {
    cookieValue.current = `${signFor(ALBUM)}x`;
    const admin = makeAdmin();
    adminRef.current = admin;

    const res = await uploadMomenPhotoAction(SLUG, form());

    expect(res.status).toBe("error");
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("sesi milik album LAIN → ditolak (tak bisa dipakai lintas album)", async () => {
    cookieValue.current = signFor(OTHER_ALBUM);
    const admin = makeAdmin({ albumId: ALBUM });
    adminRef.current = admin;

    const res = await uploadMomenPhotoAction(SLUG, form());

    expect(res.status).toBe("error");
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("undangan tak aktif → ditolak", async () => {
    cookieValue.current = signFor(ALBUM);
    const admin = makeAdmin({ invitationStatus: "expired" });
    adminRef.current = admin;

    const res = await uploadMomenPhotoAction(SLUG, form());

    expect(res.status).toBe("error");
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("MAGIC-BYTE tak cocok (PNG mengaku webp) → ditolak sebelum claim & unggah", async () => {
    cookieValue.current = signFor(ALBUM);
    const admin = makeAdmin();
    adminRef.current = admin;

    const res = await uploadMomenPhotoAction(SLUG, form({}, PNG));

    expect(res.status).toBe("error");
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("host melarang unggah galeri → source 'library' ditolak SEBELUM claim", async () => {
    cookieValue.current = signFor(ALBUM);
    const admin = makeAdmin({ allowLibraryUpload: false });
    adminRef.current = admin;

    const res = await uploadMomenPhotoAction(SLUG, form({ source: "library" }));

    expect(res.status).toBe("error");
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("host melarang galeri tapi foto dari KAMERA tetap diterima", async () => {
    cookieValue.current = signFor(ALBUM);
    adminRef.current = makeAdmin({ allowLibraryUpload: false });

    const res = await uploadMomenPhotoAction(SLUG, form({ source: "camera" }));

    expect(res).toEqual({ status: "ok", remaining: 2 });
  });

  it("source tak dikenal ditolak skema Zod", async () => {
    cookieValue.current = signFor(ALBUM);
    const admin = makeAdmin();
    adminRef.current = admin;

    const res = await uploadMomenPhotoAction(SLUG, form({ source: "scanner" }));

    expect(res.status).toBe("error");
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("meta liar (dimensi melebihi batas) ditolak skema Zod", async () => {
    cookieValue.current = signFor(ALBUM);
    const admin = makeAdmin();
    adminRef.current = admin;

    const res = await uploadMomenPhotoAction(SLUG, form({ width: "99999" }));

    expect(res.status).toBe("error");
    expect(admin.rpc).not.toHaveBeenCalled();
  });
});

describe("uploadMomenPhotoAction — gerbang kuota & kebersihan storage", () => {
  it("claim menolak (guest-quota) → tak ada unggahan ke storage", async () => {
    cookieValue.current = signFor(ALBUM);
    const admin = makeAdmin({
      claim: {
        data: [{ result: "guest-quota", photo_id: null, remaining: 0 }],
        error: null,
      },
    });
    adminRef.current = admin;

    const res = await uploadMomenPhotoAction(SLUG, form());

    expect(res.status).toBe("error");
    expect(storage.upload).not.toHaveBeenCalled();
    // confirm TIDAK boleh dipanggil setelah claim ditolak.
    const called = admin.rpc.mock.calls.map((c) => c[0]);
    expect(called).toContain("momen_claim_upload");
    expect(called).not.toContain("momen_confirm_photo");
  });

  it("peserta penuh (cap tier) → ditolak sebelum unggah", async () => {
    cookieValue.current = signFor(ALBUM);
    adminRef.current = makeAdmin({
      claim: {
        data: [{ result: "peserta-penuh", photo_id: null, remaining: 0 }],
        error: null,
      },
    });

    const res = await uploadMomenPhotoAction(SLUG, form());

    expect(res.status).toBe("error");
    expect(storage.upload).not.toHaveBeenCalled();
  });

  /**
   * Pemetaan alasan penolakan RPC → copy tamu adalah SATU-SATUNYA representasi
   * aturan kuota di TypeScript (otoritas sesungguhnya ada di SQL, atomik).
   * Sebelumnya yang ber-test justru `shot-quota.ts` yang TAK PERNAH dipakai
   * produksi — dan modelnya sudah usang: ia mengenal "kuota foto se-album" dan
   * tak punya konsep `peserta-penuh` sama sekali (AUDIT KUA-6 / DECISIONS #34).
   * Tiga alasan di bawah WAJIB menghasilkan pesan yang BERBEDA: tamu harus tahu
   * apakah jatahnya sendiri yang habis, kuota peserta album, atau plafon foto.
   */
  it("setiap alasan penolakan RPC → pesan tamu yang BERBEDA", async () => {
    const pesan: Record<string, string | undefined> = {};
    for (const result of ["guest-quota", "peserta-penuh", "album-full"]) {
      cookieValue.current = signFor(ALBUM);
      adminRef.current = makeAdmin({
        claim: {
          data: [{ result, photo_id: null, remaining: 0 }],
          error: null,
        },
      });
      const res = await uploadMomenPhotoAction(SLUG, form());
      expect(res.status).toBe("error");
      pesan[result] = res.status === "error" ? res.message : undefined;
    }

    for (const r of ["guest-quota", "peserta-penuh", "album-full"]) {
      expect(pesan[r]).toBeTruthy();
    }
    // Tiga pesan berbeda — bukan satu pesan generik untuk tiga sebab berbeda.
    expect(new Set(Object.values(pesan)).size).toBe(3);
  });

  it("alasan RPC tak dikenal → pesan generik, TIDAK bocor string mentah", async () => {
    cookieValue.current = signFor(ALBUM);
    adminRef.current = makeAdmin({
      claim: {
        data: [{ result: "sesuatu-yang-baru", photo_id: null, remaining: 0 }],
        error: null,
      },
    });

    const res = await uploadMomenPhotoAction(SLUG, form());

    expect(res.status).toBe("error");
    if (res.status !== "error") return;
    expect(res.message).not.toContain("sesuatu-yang-baru");
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("album non-aktif menurut RPC → pesan 'album tidak aktif', bukan generik", async () => {
    cookieValue.current = signFor(ALBUM);
    adminRef.current = makeAdmin({
      claim: {
        data: [{ result: "not_active", photo_id: null, remaining: 0 }],
        error: null,
      },
    });
    const notActive = await uploadMomenPhotoAction(SLUG, form());

    cookieValue.current = signFor(ALBUM);
    adminRef.current = makeAdmin({
      claim: {
        data: [{ result: "guest-quota", photo_id: null, remaining: 0 }],
        error: null,
      },
    });
    const quota = await uploadMomenPhotoAction(SLUG, form());

    expect(notActive.status).toBe("error");
    expect(quota.status).toBe("error");
    if (notActive.status !== "error" || quota.status !== "error") return;
    expect(notActive.message).not.toBe(quota.message);
  });

  it("confirm menolak setelah unggah → kedua objek storage dibersihkan", async () => {
    cookieValue.current = signFor(ALBUM);
    adminRef.current = makeAdmin({
      confirm: { data: [{ result: "guest-quota", remaining: 0 }], error: null },
    });

    const res = await uploadMomenPhotoAction(SLUG, form());

    expect(res.status).toBe("error");
    expect(storage.upload).toHaveBeenCalledTimes(2);
    expect(storage.delete).toHaveBeenCalledTimes(2);
  });
});

describe("uploadMomenPhotoAction — jalur sukses", () => {
  it("menyimpan dgn identitas dari SESI (bukan form) + path sesuai constraint DB", async () => {
    cookieValue.current = signFor(ALBUM, "Sasa");
    const admin = makeAdmin();
    adminRef.current = admin;

    // Form mencoba menyelundupkan nama & device lain → harus DIABAIKAN.
    const fd = form({ guestName: "Peretas", deviceId: "deadbeef" });
    const res = await uploadMomenPhotoAction(SLUG, fd);

    expect(res).toEqual({ status: "ok", remaining: 2 });

    const confirmCall = admin.rpc.mock.calls.find(
      (c) => c[0] === "momen_confirm_photo",
    );
    const args = confirmCall?.[1] as Record<string, unknown>;
    expect(args.p_guest_name).toBe("Sasa");
    expect(args.p_device_id).toBe(DEVICE);
    expect(args.p_album_id).toBe(ALBUM);
    // Path harus cocok constraint kolom momen_photos (migrasi 20260826120000).
    expect(args.p_storage_path).toMatch(
      /^momen\/[0-9a-fA-F-]{36}\/[0-9a-fA-F-]{36}\/display\.(webp|jpg)$/,
    );
    expect(args.p_thumb_path).toMatch(
      /^momen\/[0-9a-fA-F-]{36}\/[0-9a-fA-F-]{36}\/thumb\.(webp|jpg)$/,
    );
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("rate-limit JARINGAN terlampaui → ditolak sebelum apa pun", async () => {
    cookieValue.current = signFor(ALBUM);
    const admin = makeAdmin();
    adminRef.current = admin;
    checkClientRateLimit.mockResolvedValue({
      ok: false,
      remaining: 0,
      retryAfterMs: 1,
    });

    const res = await uploadMomenPhotoAction(SLUG, form());

    expect(res.status).toBe("error");
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  // PER-3: rem jaringan WAJIB di-scope per acara. Tanpa scope, semua acara di
  // WiFi venue yang sama berbagi satu bucket — dan suite lain tetap hijau.
  it("rem jaringan UNGGAH di-scope per acara (slug ter-normalisasi)", async () => {
    cookieValue.current = signFor(ALBUM);
    adminRef.current = makeAdmin();
    checkClientRateLimit.mockClear();

    await uploadMomenPhotoAction(" Andi-Sinta ", form());

    expect(checkClientRateLimit).toHaveBeenCalledWith(
      "momen-upload",
      expect.objectContaining({ max: 900 }),
      SLUG,
    );
  });

  it("rem jaringan MULAI SESI di-scope per acara (slug ter-normalisasi)", async () => {
    adminRef.current = makeAdmin();
    checkClientRateLimit.mockClear();
    const fd = new FormData();
    fd.set("guestName", "Sasa");
    fd.set("deviceId", DEVICE);

    await startMomenSessionAction(" Andi-Sinta ", fd);

    expect(checkClientRateLimit).toHaveBeenCalledWith(
      "momen-session",
      expect.objectContaining({ max: 150 }),
      SLUG,
    );
  });

  // DECISIONS #39: `deviceId` mulai sesi masih dari form. Bila lapis perangkat
  // dihitung sebelum Turnstile, deviceId acak membuat kunci limiter tanpa batas.
  it("lapis perangkat MULAI SESI tak disentuh bila Turnstile gagal", async () => {
    adminRef.current = makeAdmin();
    checkRateLimit.mockClear();
    verifyTurnstile.mockResolvedValueOnce(false);
    const fd = new FormData();
    fd.set("guestName", "Sasa");
    fd.set("deviceId", DEVICE);

    const res = await startMomenSessionAction(SLUG, fd);

    expect(res.status).toBe("error");
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("lapis perangkat MULAI SESI tetap menolak sesudah Turnstile, sebelum DB", async () => {
    const admin = makeAdmin();
    adminRef.current = admin;
    checkRateLimit.mockReturnValue({
      ok: false,
      remaining: 0,
      retryAfterMs: 1,
    });
    const fd = new FormData();
    fd.set("guestName", "Sasa");
    fd.set("deviceId", DEVICE);

    const res = await startMomenSessionAction(SLUG, fd);

    expect(res.status).toBe("error");
    expect(verifyTurnstile).toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("rate-limit PERANGKAT terlampaui → ditolak sebelum apa pun", async () => {
    cookieValue.current = signFor(ALBUM);
    const admin = makeAdmin();
    adminRef.current = admin;
    checkRateLimit.mockReturnValue({
      ok: false,
      remaining: 0,
      retryAfterMs: 1,
    });

    const res = await uploadMomenPhotoAction(SLUG, form());

    expect(res.status).toBe("error");
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });
});

/**
 * `retryable` memisahkan penolakan SESAAT dari yang PERMANEN (DECISIONS #46).
 * Klien menyimpan blob jepretan HANYA bila penanda ini benar — momen di acara
 * tak bisa diulang, tetapi tombol "Kirim ulang" pada penolakan permanen (jatah
 * habis, album nonaktif, format ditolak) hanya memberi harapan palsu.
 */
/**
 * Idempotensi kirim ulang (DECISIONS #46 — koreksi review). Unggah yang MELEMPAR
 * setelah server sempat menyimpan dulu digandakan oleh tombol "Kirim ulang":
 * `momen_claim_upload` membuat id baru tiap panggilan, jadi fotonya masuk dua
 * kali dan jatah tamu terpakai dua slot.
 */
describe("uploadMomenPhotoAction — kiriman ulang tak menggandakan", () => {
  it("jepretan dengan id ini sudah ada → 'ok' tanpa claim, unggah, atau baris baru", async () => {
    cookieValue.current = signFor(ALBUM);
    const admin = makeAdmin({ shotSudahAda: true });
    adminRef.current = admin;

    const res = await uploadMomenPhotoAction(SLUG, form());

    expect(res).toMatchObject({ status: "ok" });
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("id jepretan dari KLIEN dipakai sebagai identitas foto & path", async () => {
    cookieValue.current = signFor(ALBUM);
    const admin = makeAdmin({
      // Claim memberi id lain; yang dipakai harus tetap milik klien.
      claim: {
        data: [{ result: "ok", photo_id: PHOTO, remaining: 3 }],
        error: null,
      },
    });
    adminRef.current = admin;

    await uploadMomenPhotoAction(SLUG, form());

    const confirmCall = admin.rpc.mock.calls.find(
      (c) => c[0] === "momen_confirm_photo",
    );
    const args = confirmCall?.[1] as Record<string, unknown>;
    expect(args.p_photo_id).toBe(SHOT);
    expect(args.p_storage_path).toContain(SHOT);
  });

  it("pra-cek menyaring tepat pada id jepretan ini", async () => {
    cookieValue.current = signFor(ALBUM);
    adminRef.current = makeAdmin({ shotSudahAda: true });

    await uploadMomenPhotoAction(SLUG, form());

    // Tanpa penyaring `id`, baris milik siapa pun bisa dikira milik kita.
    expect(eqCalls).toContainEqual({
      table: "momen_photos",
      col: "id",
      val: SHOT,
    });
  });

  it("id jepretan MILIK ALBUM LAIN → ditolak SEBELUM satu byte pun ditulis", async () => {
    // `momen_photos.id` primary key GLOBAL, dan id album lain bisa dipungut
    // dari HTML publik album yang sudah reveal. Tanpa cek pemilik, objeknya
    // terlanjur ditulis lalu confirm gagal 23505 → yatim yang lolos SEMUA
    // gerbang kuota dan tak pernah ikut terhapus purge.
    cookieValue.current = signFor(ALBUM);
    const admin = makeAdmin({
      shotSudahAda: true,
      shotRow: { album_id: OTHER_ALBUM, device_id: DEVICE },
    });
    adminRef.current = admin;

    const res = await uploadMomenPhotoAction(SLUG, form());

    expect(res).toMatchObject({ status: "error" });
    expect(res.status === "error" && res.retryable).toBeFalsy();
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("id jepretan milik PERANGKAT LAIN di album ini → ditolak juga", async () => {
    cookieValue.current = signFor(ALBUM);
    const admin = makeAdmin({
      shotSudahAda: true,
      shotRow: {
        album_id: ALBUM,
        device_id: "55555555-5555-4555-8555-555555555555",
      },
    });
    adminRef.current = admin;

    const res = await uploadMomenPhotoAction(SLUG, form());

    expect(res).toMatchObject({ status: "error" });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("23505 atas id PINJAMAN → ditolak DAN objeknya dibersihkan", async () => {
    cookieValue.current = signFor(ALBUM);
    // Pra-cek meleset (barisnya lahir sesudahnya), lalu confirm menabrak PK.
    let panggilan = 0;
    const admin = makeAdmin({
      confirm: { data: null, error: { ...BOOM, code: "23505" } },
    });
    const asli = admin.from;
    admin.from = vi.fn((table: string) => {
      if (table === "momen_photos") {
        panggilan += 1;
        // Panggilan pertama = pra-cek (kosong); kedua = sesudah 23505 (asing).
        return makeAdmin({
          shotSudahAda: panggilan > 1,
          shotRow: { album_id: OTHER_ALBUM, device_id: DEVICE },
        }).from(table);
      }
      return asli(table);
    }) as typeof admin.from;
    adminRef.current = admin;

    const res = await uploadMomenPhotoAction(SLUG, form());

    expect(res).toMatchObject({ status: "error" });
    expect(storage.delete).toHaveBeenCalledTimes(2);
  });

  it("confirm MENOLAK padahal baris kita sudah commit → sukses, objek TIDAK dihapus", async () => {
    // Kirim ulang berbagi path: menghapus objeknya berarti merusak foto yang
    // sudah tersimpan dan mewariskan gambar rusak ke album host.
    cookieValue.current = signFor(ALBUM);
    let panggilan = 0;
    const admin = makeAdmin({
      confirm: { data: [{ result: "guest-quota", remaining: 0 }], error: null },
    });
    const asli = admin.from;
    admin.from = vi.fn((table: string) => {
      if (table === "momen_photos") {
        panggilan += 1;
        return makeAdmin({ shotSudahAda: panggilan > 1 }).from(table);
      }
      return asli(table);
    }) as typeof admin.from;
    adminRef.current = admin;

    const res = await uploadMomenPhotoAction(SLUG, form());

    expect(res).toMatchObject({ status: "ok" });
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("balapan: confirm menabrak PK dan barisnya MILIK KITA → SUKSES, bukan galat", async () => {
    cookieValue.current = signFor(ALBUM);
    // Pra-cek meleset (barisnya lahir sesudahnya), lalu confirm menabrak PK —
    // barisnya milik perangkat & album ini, jadi fotonya memang tersimpan.
    let panggilan = 0;
    const admin = makeAdmin({
      confirm: { data: null, error: { ...BOOM, code: "23505" } },
    });
    const asli = admin.from;
    admin.from = vi.fn((table: string) => {
      if (table === "momen_photos") {
        panggilan += 1;
        return makeAdmin({ shotSudahAda: panggilan > 1 }).from(table);
      }
      return asli(table);
    }) as typeof admin.from;
    adminRef.current = admin;

    const res = await uploadMomenPhotoAction(SLUG, form());

    // Fotonya tersimpan oleh percobaan lain; objek storage TIDAK dihapus.
    expect(res).toMatchObject({ status: "ok" });
    expect(storage.delete).not.toHaveBeenCalled();
  });
});

describe("uploadMomenPhotoAction — penanda `retryable`", () => {
  const retryable = (r: Awaited<ReturnType<typeof uploadMomenPhotoAction>>) =>
    r.status === "error" ? r.retryable === true : null;

  it("album gagal DIBACA → sesaat: pesan gangguan + retryable", async () => {
    cookieValue.current = signFor(ALBUM);
    const admin = makeAdmin({ readError: "momen_albums" });
    adminRef.current = admin;

    const res = await uploadMomenPhotoAction(SLUG, form());

    expect(res).toEqual({
      status: "error",
      message: copy.momen.error.temporary,
      retryable: true,
    });
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("undangan gagal DIBACA → sesaat", async () => {
    cookieValue.current = signFor(ALBUM);
    adminRef.current = makeAdmin({ readError: "invitations" });

    expect(await uploadMomenPhotoAction(SLUG, form())).toEqual({
      status: "error",
      message: copy.momen.error.temporary,
      retryable: true,
    });
  });

  it("album memang NONAKTIF → permanen (blob dibuang klien)", async () => {
    cookieValue.current = signFor(ALBUM);
    adminRef.current = makeAdmin({ albumId: null });

    const res = await uploadMomenPhotoAction(SLUG, form());

    expect(res).toMatchObject({ message: copy.momen.error.notActive });
    expect(retryable(res)).toBe(false);
  });

  it("storage bermasalah → sesaat, objek dibersihkan", async () => {
    cookieValue.current = signFor(ALBUM);
    adminRef.current = makeAdmin();
    storage.upload.mockRejectedValueOnce(new Error("503 dari vendor"));

    const res = await uploadMomenPhotoAction(SLUG, form());

    expect(retryable(res)).toBe(true);
    expect(storage.delete).toHaveBeenCalledTimes(2);
  });

  it("RPC claim galat → sesaat", async () => {
    cookieValue.current = signFor(ALBUM);
    adminRef.current = makeAdmin({ claim: { data: null, error: BOOM } });

    expect(retryable(await uploadMomenPhotoAction(SLUG, form()))).toBe(true);
  });

  it("RPC confirm galat → sesaat, objek dibersihkan", async () => {
    cookieValue.current = signFor(ALBUM);
    adminRef.current = makeAdmin({ confirm: { data: null, error: BOOM } });

    const res = await uploadMomenPhotoAction(SLUG, form());

    expect(retryable(res)).toBe(true);
    expect(storage.delete).toHaveBeenCalledTimes(2);
  });

  it("rate limit (jaringan & perangkat) → sesaat", async () => {
    cookieValue.current = signFor(ALBUM);
    adminRef.current = makeAdmin();
    checkClientRateLimit.mockResolvedValue({
      ok: false,
      remaining: 0,
      retryAfterMs: 1,
    });
    expect(retryable(await uploadMomenPhotoAction(SLUG, form()))).toBe(true);

    cookieValue.current = signFor(ALBUM);
    checkClientRateLimit.mockResolvedValue({
      ok: true,
      remaining: 9,
      retryAfterMs: 0,
    });
    checkRateLimit.mockReturnValue({
      ok: false,
      remaining: 0,
      retryAfterMs: 1,
    });
    expect(retryable(await uploadMomenPhotoAction(SLUG, form()))).toBe(true);
  });

  it("penolakan kuota/peserta/album-penuh & format → TIDAK retryable", async () => {
    for (const result of ["guest-quota", "peserta-penuh", "album-full"]) {
      cookieValue.current = signFor(ALBUM);
      adminRef.current = makeAdmin({
        claim: {
          data: [{ result, photo_id: null, remaining: 0 }],
          error: null,
        },
      });
      expect(retryable(await uploadMomenPhotoAction(SLUG, form()))).toBe(false);
    }

    // Magic-byte / meta ditolak: mengirim ulang byte yang sama tak akan lolos.
    cookieValue.current = signFor(ALBUM);
    adminRef.current = makeAdmin();
    expect(retryable(await uploadMomenPhotoAction(SLUG, form({}, PNG)))).toBe(
      false,
    );

    // Host melarang unggah galeri: keputusan host, bukan gangguan.
    cookieValue.current = signFor(ALBUM);
    adminRef.current = makeAdmin({ allowLibraryUpload: false });
    expect(
      retryable(
        await uploadMomenPhotoAction(SLUG, form({ source: "library" })),
      ),
    ).toBe(false);
  });

  it("penolakan gerbang ATOMIK (confirm) → TIDAK retryable", async () => {
    // Di sinilah kehabisan jatah sesungguhnya muncul saat dua ponsel mengunggah
    // bersamaan: claim lolos pra-cek, `momen_confirm_photo` yang menolak.
    for (const result of ["guest-quota", "album-full", "peserta-penuh"]) {
      cookieValue.current = signFor(ALBUM);
      adminRef.current = makeAdmin({
        confirm: { data: [{ result, remaining: 0 }], error: null },
      });
      const res = await uploadMomenPhotoAction(SLUG, form());
      expect(retryable(res)).toBe(false);
      // Objek yang terlanjur terunggah tetap dibersihkan.
      expect(storage.delete).toHaveBeenCalledTimes(2);
      storage.delete.mockClear();
    }
  });

  it("sesi milik album LAIN → TIDAK retryable", async () => {
    cookieValue.current = signFor(OTHER_ALBUM);
    adminRef.current = makeAdmin({ albumId: ALBUM });
    expect(retryable(await uploadMomenPhotoAction(SLUG, form()))).toBe(false);
  });

  it("sesi tak sah / kedaluwarsa → TIDAK retryable (tamu harus masuk lagi)", async () => {
    cookieValue.current = "";
    adminRef.current = makeAdmin();
    expect(retryable(await uploadMomenPhotoAction(SLUG, form()))).toBe(false);
  });
});

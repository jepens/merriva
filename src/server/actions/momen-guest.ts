"use server";

import { cookies } from "next/headers";

import { copy } from "@/lib/copy";
import { matchesDeclaredFormat } from "@/lib/image/magic-bytes";
import { reportHandledError } from "@/lib/observability";
import {
  MOMEN_LIMITS,
  momenSessionStartSchema,
  momenUploadMetaSchema,
} from "@/lib/momen/momen-settings-schema";
import {
  MOMEN_SESSION_TTL_MS,
  signMomenSession,
  verifyMomenSession,
} from "@/lib/momen/session";
import { canGuestViewPhotos, resolveAlbumPhase } from "@/lib/momen/album-phase";
import { momenObjectPaths } from "@/lib/momen/storage-path";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  checkClientRateLimit,
  getClientIp,
  staticRateKey,
} from "@/lib/request-ip";
import { getStorage } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";
import { fetchMomenPhotos } from "@/server/momen/photos";

/**
 * Aksi TAMU Album Momen (FASE H, MOMEN-SPEC §4–§6). Tamu ANON tak menyentuh DB
 * langsung — aksi ini berjalan di server: verifikasi sesi HMAC + Turnstile +
 * rate-limit, lalu memanggil RPC lewat service_role. Pemrosesan gambar HANYA di
 * browser klien; server hanya memvalidasi tipe/ukuran/MAGIC-BYTE lalu menyimpan.
 *
 * Alur unggah = confirm-gated (DECISIONS #22): claim (pra-cek lembut) → unggah
 * objek → confirm (gerbang ATOMIK advisory-lock). Kuota tak bisa tembus paralel.
 */

const COOKIE_NAME = "momen_sess";

/**
 * Rate limit DUA LAPIS (AUDIT-2026-09-04 PER-3).
 *
 * Plafon lama di-key per-jaringan /24 tanpa cakupan: di WiFi venue SELURUH tamu
 * berbagi satu bucket, sehingga hanya 20 tamu/menit bisa masuk dan 60 foto/menit
 * untuk seluruh acara — padahal kuota default saja 5 foto x 200 tamu = 1.000
 * foto. Album Momen praktis tak terpakai persis di hari-H. Tamu seluler juga
 * ikut kena karena CGNAT operator Indonesia.
 *
 * Sekarang:
 *  - lapis JARINGAN = rem anti-banjir, di-scope PER ALBUM dan dilonggarkan
 *    seukuran satu resepsi (lihat angka di bawah);
 *  - lapis PERANGKAT = kendali keadilan sesungguhnya, sehingga satu perangkat
 *    tak bisa menghabiskan kapasitas acara.
 *
 * Keduanya harus lolos. Untuk unggah, identitas perangkat diambil dari cookie
 * ber-TANDA-TANGAN (HMAC terverifikasi) → tepercaya. Untuk mulai sesi, cookie
 * belum ada sehingga `deviceId` masih dari form (bisa dirotasi): di sana lapis
 * perangkat diperiksa SESUDAH Turnstile agar deviceId acak tak membanjiri memori
 * limiter (DECISIONS #39), dan gerbang bot sesungguhnya tetap Turnstile. Rotasi deviceId untuk menguras kuota PESERTA adalah temuan
 * terpisah (KEA-4) yang belum ditangani di sini.
 */

/** Mulai sesi: 300 tamu memindai QR dalam 2-3 menit harus muat. */
const SESSION_VENUE_LIMIT = { max: 150, windowMs: 60_000 };
/** Satu tamu memulai sesi sekali; sisanya ruang untuk percobaan ulang. */
const SESSION_DEVICE_LIMIT = { max: 5, windowMs: 60_000 };

/** Rem tepi unggah (sebelum identitas diketahui) — melindungi DB & storage. */
const UPLOAD_VENUE_LIMIT = { max: 900, windowMs: 60_000 };
/** Jatah per tamu maksimal 20 foto (skema) → 20/menit sudah sangat longgar. */
const UPLOAD_DEVICE_LIMIT = { max: 20, windowMs: 60_000 };

/** Baca galeri: murah & hanya saat tamu menekan "muat lebih". Per acara. */
const GALLERY_LIMIT = { max: 600, windowMs: 60_000 };

export type MomenSessionState =
  | { status: "ok"; remaining: number; deviceCount: number }
  | { status: "error"; message?: string };

export type MomenUploadState =
  | { status: "ok"; remaining: number }
  | {
      status: "error";
      message?: string;
      /**
       * Benar bila MENGIRIM ULANG foto yang sama masih bisa berhasil: gangguan
       * DB/storage atau rate-limit (DECISIONS #46). Penolakan PERMANEN (jatah
       * habis, album tidak aktif, format ditolak, sesi kedaluwarsa) sengaja
       * tidak ditandai — klien tak boleh menawarkan "Kirim ulang" di sana.
       */
      retryable?: boolean;
    };

interface ActiveAlbum {
  albumId: string;
  quotaPerGuest: number;
  allowLibraryUpload: boolean;
  revealAt: string | null;
}

/**
 * Resolusi album AKTIF dari slug undangan (service_role; tamu anon tak punya
 * akses RLS). Fail-closed: undangan tak `active` / tanpa album / album non-aktif
 * → `inactive`.
 *
 * Galat DB DIBEDAKAN (`error`, DECISIONS #46): dulu ikut menjadi `null` dan
 * tamu di hari-H diberi "Album tidak aktif." — pesan permanen yang membuatnya
 * berhenti memotret, padahal gangguannya sesaat.
 */
type AlbumLookup =
  { kind: "ok"; album: ActiveAlbum } | { kind: "inactive" } | { kind: "error" };

async function resolveActiveAlbum(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  slug: string,
): Promise<AlbumLookup> {
  const { data: inv, error: invError } = await admin
    .from("invitations")
    .select("id, status")
    .eq("slug", slug)
    .maybeSingle();
  if (invError) {
    reportHandledError(invError, "momen.guest.invitation", { slug });
    return { kind: "error" };
  }
  if (!inv || inv.status !== "active") return { kind: "inactive" };

  const { data: album, error: albumError } = await admin
    .from("momen_albums")
    .select("id, status, quota_per_guest, allow_library_upload, reveal_at")
    .eq("invitation_id", inv.id)
    .maybeSingle();
  if (albumError) {
    reportHandledError(albumError, "momen.guest.album", { slug });
    return { kind: "error" };
  }
  if (!album || album.status !== "active") return { kind: "inactive" };

  return {
    kind: "ok",
    album: {
      albumId: album.id,
      quotaPerGuest: album.quota_per_guest,
      allowLibraryUpload: album.allow_library_upload,
      revealAt: album.reveal_at,
    },
  };
}

/** Pesan untuk hasil lookup yang bukan `ok`. */
function albumProblem(lookup: AlbumLookup): string {
  return lookup.kind === "error"
    ? copy.momen.error.temporary
    : copy.momen.error.notActive;
}

/**
 * Berapa foto yang sudah diambil perangkat ini di album — angka KOSMETIK:
 * mengisi pips & sisa jatah di layar kamera. Gerbang kuota sesungguhnya ada di
 * RPC `momen_claim_upload`/`momen_confirm_photo` (security definer + advisory
 * lock) yang menghitung ulang di setiap unggah.
 *
 * `null` = gagal dibaca; pemanggil sengaja FAIL-OPEN (lihat di bawah).
 */
async function deviceShotCount(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  albumId: string,
  deviceId: string,
): Promise<number | null> {
  const { count, error } = await admin
    .from("momen_photos")
    .select("id", { count: "exact", head: true })
    .eq("album_id", albumId)
    .eq("device_id", deviceId);
  if (error) {
    reportHandledError(error, "momen.guest.shotCount", { albumId });
    return null;
  }
  return count ?? 0;
}

/** Pesan lokal dari alasan penolakan RPC (claim/confirm). */
function denyMessage(result: string): string {
  switch (result) {
    case "guest-quota":
      return copy.momen.error.guestQuota;
    case "peserta-penuh":
      return copy.momen.error.pesertaFull;
    case "album-full":
      return copy.momen.error.albumFull;
    case "not_active":
    case "not_found":
      return copy.momen.error.notActive;
    default:
      return copy.momen.error.generic;
  }
}

/**
 * Mulai sesi tamu: verifikasi Turnstile → ikat {albumId, deviceId, guestName} ke
 * cookie ber-tanda-tangan. Mengembalikan sisa jatah perangkat agar UI menampilkan
 * pips.
 *
 * Urutan sengaja: Zod dulu (murni, tanpa I/O), rem jaringan (murah), Turnstile,
 * BARU lapis perangkat & DB. Lapis perangkat sengaja di belakang Turnstile
 * karena `deviceId` masih dari form (DECISIONS #39). Cakupan jaringan memakai
 * `slug` (bukan `albumId`) supaya tak perlu query untuk membentuk kunci.
 */
export async function startMomenSessionAction(
  slug: string,
  formData: FormData,
): Promise<MomenSessionState> {
  const parsed = momenSessionStartSchema.safeParse({
    guestName: formData.get("guestName"),
    deviceId: formData.get("deviceId"),
  });
  if (!parsed.success) {
    return { status: "error", message: copy.momen.error.invalid };
  }

  const rateKey = typeof slug === "string" ? slug.trim().toLowerCase() : "";
  if (
    !(await checkClientRateLimit("momen-session", SESSION_VENUE_LIMIT, rateKey))
      .ok
  ) {
    return { status: "error", message: copy.momen.error.rateLimited };
  }

  const token = formData.get("turnstileToken");
  const okBot = await verifyTurnstile(
    typeof token === "string" ? token : undefined,
    await getClientIp(),
  );
  if (!okBot) return { status: "error", message: copy.momen.error.turnstile };

  // Lapis perangkat SESUDAH Turnstile: `deviceId` di sini masih dari form, jadi
  // bila dihitung sebelum gerbang bot, deviceId acak per request membuat kunci
  // limiter tanpa batas dan mendesak penghitung lain keluar dari memori (#39).
  if (
    !checkRateLimit(
      staticRateKey("momen-session-device", parsed.data.deviceId),
      SESSION_DEVICE_LIMIT,
    ).ok
  ) {
    return { status: "error", message: copy.momen.error.rateLimited };
  }

  const admin = createSupabaseAdminClient();
  const lookup = await resolveActiveAlbum(admin, slug);
  if (lookup.kind !== "ok") {
    return { status: "error", message: albumProblem(lookup) };
  }
  const album = lookup.album;

  // FAIL-OPEN saat hitungan gagal (koreksi review #46). Menolak sesi di sini
  // memblokir SELURUH tamu di hari-H tanpa menambah keamanan kuota sedikit pun
  // — kuotanya ditegakkan ulang secara atomik di RPC unggah. Risiko sisanya
  // hanya kosmetik: tamu yang jatahnya sudah habis melihat pips penuh lalu
  // ditolak "Jatah jepretanmu sudah habis." saat menjepret. Momen tak bisa
  // diulang, jadi pintu yang terbuka lebih baik daripada pintu yang terkunci.
  const deviceCount =
    (await deviceShotCount(admin, album.albumId, parsed.data.deviceId)) ?? 0;

  const cookie = signMomenSession({
    albumId: album.albumId,
    deviceId: parsed.data.deviceId,
    guestName: parsed.data.guestName,
    iat: Date.now(),
  });
  const store = await cookies();
  store.set(COOKIE_NAME, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(MOMEN_SESSION_TTL_MS / 1000),
  });

  return {
    status: "ok",
    deviceCount,
    remaining: Math.max(0, album.quotaPerGuest - deviceCount),
  };
}

function isAcceptedBlob(value: unknown, maxBytes: number): value is Blob {
  return (
    value instanceof Blob &&
    (value.type === "image/webp" || value.type === "image/jpeg") &&
    value.size > 0 &&
    value.size <= maxBytes
  );
}

/**
 * Unggah satu foto (sudah di-bake filter + di-encode klien = 2 varian). Identitas
 * tamu (album/device/nama) HANYA dari cookie ber-tanda-tangan — bukan form. Meta
 * foto divalidasi Zod + MAGIC-BYTE (tolak PNG/spoof). claim → unggah → confirm
 * (atomik). Gagal confirm → objek dibersihkan (best-effort; orphan tak tertebak).
 */
export async function uploadMomenPhotoAction(
  slug: string,
  formData: FormData,
): Promise<MomenUploadState> {
  // Rem tepi per-acara: murah, melindungi query DB & unggah storage di bawah.
  // Jalur mahal (DB + storage) tetap terkunci di belakang sesi terverifikasi,
  // jadi banjir tanpa cookie hanya membayar satu verifikasi HMAC lalu ditolak.
  const rateKey = typeof slug === "string" ? slug.trim().toLowerCase() : "";
  if (
    !(await checkClientRateLimit("momen-upload", UPLOAD_VENUE_LIMIT, rateKey))
      .ok
  ) {
    return {
      status: "error",
      message: copy.momen.error.rateLimited,
      retryable: true,
    };
  }

  // Sesi ter-tanda-tangan → identitas tepercaya.
  const store = await cookies();
  const session = verifyMomenSession(store.get(COOKIE_NAME)?.value);
  if (!session) return { status: "error", message: copy.momen.error.session };

  // Kendali keadilan: di-key pada perangkat dari sesi ber-TANDA-TANGAN (bukan
  // jaringan), sehingga satu tamu tak bisa menghabiskan kapasitas acara dan
  // tamu lain di WiFi yang sama tidak ikut terkena.
  if (
    !checkRateLimit(
      staticRateKey("momen-upload-device", session.deviceId),
      UPLOAD_DEVICE_LIMIT,
    ).ok
  ) {
    return {
      status: "error",
      message: copy.momen.error.rateLimited,
      retryable: true,
    };
  }

  const admin = createSupabaseAdminClient();
  const lookup = await resolveActiveAlbum(admin, slug);
  // Sesi harus untuk album yang SAMA dengan slug ini (cegah pakai-ulang lintas).
  // Galat DB dibedakan (#46): jepretan tamu dibuang klien begitu aksi menolak,
  // jadi "Album tidak aktif." yang keliru = foto hilang untuk selamanya.
  if (lookup.kind !== "ok") {
    return {
      status: "error",
      message: albumProblem(lookup),
      retryable: lookup.kind === "error",
    };
  }
  const album = lookup.album;
  if (album.albumId !== session.albumId) {
    return { status: "error", message: copy.momen.error.notActive };
  }

  // Meta foto (gabung identitas sesi + field form) → skema strict penuh.
  const meta = momenUploadMetaSchema.safeParse({
    guestName: session.guestName,
    deviceId: session.deviceId,
    shotId: formData.get("shotId"),
    filterId: formData.get("filterId"),
    format: formData.get("format"),
    source: formData.get("source"),
    width: Number(formData.get("width")),
    height: Number(formData.get("height")),
    displayBytes: Number(formData.get("displayBytes")),
    thumbBytes: Number(formData.get("thumbBytes")),
  });
  if (!meta.success) {
    return { status: "error", message: copy.momen.error.invalid };
  }
  const { format } = meta.data;

  // Setting host "hanya jepretan langsung" ditegakkan di SERVER, bukan cuma UI.
  if (meta.data.source === "library" && !album.allowLibraryUpload) {
    return { status: "error", message: copy.momen.error.libraryDisabled };
  }

  const display = formData.get("display");
  const thumb = formData.get("thumb");
  if (
    !isAcceptedBlob(display, MOMEN_LIMITS.displayBytesMax) ||
    !isAcceptedBlob(thumb, MOMEN_LIMITS.thumbBytesMax)
  ) {
    return { status: "error", message: copy.momen.error.invalid };
  }

  // MAGIC-BYTE: byte awal harus cocok format yang dideklarasikan (bukan hanya
  // Blob.type/nama yang dapat dipalsukan). PNG/spoof → tolak.
  const displayBuf = await display.arrayBuffer();
  const thumbBuf = await thumb.arrayBuffer();
  if (
    !matchesDeclaredFormat(displayBuf, format) ||
    !matchesDeclaredFormat(thumbBuf, format)
  ) {
    return { status: "error", message: copy.momen.error.invalid };
  }

  // IDEMPOTEN (#46): bila jepretan dengan id ini sudah tersimpan, percobaan
  // sebelumnya ternyata sampai di server dan hanya responsnya yang hilang.
  // Jawab "ok" tanpa menyentuh kuota, storage, atau baris baru — kalau tidak,
  // tombol "Kirim ulang" menggandakan foto dan memakan jatah kedua.
  const { data: sudahAda, error: dupErr } = await admin
    .from("momen_photos")
    .select("id")
    .eq("id", meta.data.shotId)
    .eq("album_id", album.albumId)
    .maybeSingle();
  if (dupErr) {
    reportHandledError(dupErr, "momen.dedupe", { albumId: album.albumId });
    return {
      status: "error",
      message: copy.momen.error.generic,
      retryable: true,
    };
  }
  if (sudahAda) {
    const terpakai = await deviceShotCount(
      admin,
      album.albumId,
      session.deviceId,
    );
    return {
      status: "ok",
      remaining: Math.max(0, album.quotaPerGuest - (terpakai ?? 0)),
    };
  }

  // Claim (pra-cek lembut). `photo_id` yang dikembalikannya SENGAJA diabaikan:
  // identitas foto berasal dari klien agar kirim ulang tetap idempoten.
  const { data: claimRows, error: claimErr } = await admin.rpc(
    "momen_claim_upload",
    { p_album_id: album.albumId, p_device_id: session.deviceId },
  );
  if (claimErr) {
    reportHandledError(claimErr, "momen.claim", { albumId: album.albumId });
    return {
      status: "error",
      message: copy.momen.error.generic,
      retryable: true,
    };
  }
  const claim = claimRows?.[0];
  if (!claim || claim.result !== "ok" || !claim.photo_id) {
    return {
      status: "error",
      message: denyMessage(claim?.result ?? "generic"),
    };
  }
  const photoId = meta.data.shotId;

  const [displayPath, thumbPath] = momenObjectPaths(
    album.albumId,
    photoId,
    format,
  );
  const storage = getStorage();
  const cleanup = () =>
    Promise.allSettled([
      storage.delete(displayPath),
      storage.delete(thumbPath),
    ]);

  try {
    await storage.upload({
      path: displayPath,
      body: displayBuf,
      contentType: display.type,
    });
    await storage.upload({
      path: thumbPath,
      body: thumbBuf,
      contentType: thumb.type,
    });
  } catch (err) {
    // Storage bermasalah saat resepsi = seluruh tamu gagal memotret; ini harus
    // memicu alarm, bukan hanya toast "Gagal menyimpan foto".
    reportHandledError(err, "momen.storage", { albumId: album.albumId });
    await cleanup();
    return {
      status: "error",
      message: copy.momen.error.generic,
      retryable: true,
    };
  }

  // Confirm = gerbang ATOMIK (advisory lock): cek ulang kuota lalu sisip baris +
  // naikkan photo_count dalam satu transaksi. Bytes = ukuran display AKTUAL.
  const { data: confirmRows, error: confirmErr } = await admin.rpc(
    "momen_confirm_photo",
    {
      p_album_id: album.albumId,
      p_photo_id: photoId,
      p_device_id: session.deviceId,
      p_guest_name: session.guestName,
      p_filter_id: meta.data.filterId,
      p_storage_path: displayPath,
      p_thumb_path: thumbPath,
      p_width: meta.data.width,
      p_height: meta.data.height,
      p_bytes: display.size,
    },
  );
  // 23505 = baris dengan id ini sudah ada → percobaan lain menang balapan.
  // Fotonya tersimpan, jadi ini SUKSES, bukan kegagalan (lihat pra-cek di atas).
  if (confirmErr?.code === "23505") {
    const terpakai = await deviceShotCount(
      admin,
      album.albumId,
      session.deviceId,
    );
    return {
      status: "ok",
      remaining: Math.max(0, album.quotaPerGuest - (terpakai ?? 0)),
    };
  }
  if (confirmErr) {
    reportHandledError(confirmErr, "momen.confirm", { albumId: album.albumId });
    await cleanup();
    return {
      status: "error",
      message: copy.momen.error.generic,
      retryable: true,
    };
  }
  const confirm = confirmRows?.[0];
  if (!confirm || confirm.result !== "ok") {
    await cleanup();
    return {
      status: "error",
      message: denyMessage(confirm?.result ?? "generic"),
    };
  }

  return { status: "ok", remaining: confirm.remaining };
}

/** Satu foto galeri untuk klien (URL sudah lewat `lib/storage` + domain sendiri). */
export interface MomenGalleryPhoto {
  id: string;
  guestName: string;
  filterId: string;
  url: string;
  thumbUrl: string;
}

export type MomenGalleryState =
  | { status: "ok"; photos: MomenGalleryPhoto[]; nextCursor: string | null }
  | { status: "error" };

/**
 * Halaman BERIKUTNYA galeri album (PER-4). Halaman pertama dirender server di
 * `/{slug}/momen`; ini hanya dipanggil saat tamu menekan "muat lebih".
 *
 * FAIL-CLOSED: gerbang fase diperiksa ULANG di sini — aksi ini publik, jadi
 * tidak boleh bergantung pada halaman yang memanggilnya. Pra-reveal → daftar
 * kosong, sama seperti render awal.
 */
export async function loadMomenPhotosAction(
  slug: string,
  cursor: string | null,
): Promise<MomenGalleryState> {
  const rateKey = typeof slug === "string" ? slug.trim().toLowerCase() : "";
  if (
    !(await checkClientRateLimit("momen-gallery", GALLERY_LIMIT, rateKey)).ok
  ) {
    return { status: "error" };
  }

  // Kursor = `created_at` ISO dari baris terakhir; tolak bentuk lain.
  const safeCursor =
    typeof cursor === "string" && cursor.length > 0 && cursor.length <= 40
      ? cursor
      : null;
  if (cursor !== null && safeCursor === null) return { status: "error" };

  const admin = createSupabaseAdminClient();
  const lookup = await resolveActiveAlbum(admin, slug);
  if (lookup.kind !== "ok") return { status: "error" };
  const album = lookup.album;

  // Gerbang fase FAIL-CLOSED — satu aturan bersama dengan render awal halaman.
  if (!canGuestViewPhotos(resolveAlbumPhase(Date.now(), album.revealAt))) {
    return { status: "ok", photos: [], nextCursor: null };
  }

  const page = await fetchMomenPhotos(admin, album.albumId, {
    cursor: safeCursor,
  });
  // Bacaan gagal → status galat, BUKAN halaman kosong (#46): UI mempertahankan
  // kursor & tombol "Muat lebih" agar tamu bisa mencoba lagi.
  if (page.failed) return { status: "error" };
  return {
    status: "ok",
    photos: page.photos.map((p) => ({
      id: p.id,
      guestName: p.guestName,
      filterId: p.filterId,
      url: p.url,
      thumbUrl: p.thumbUrl,
    })),
    nextCursor: page.nextCursor,
  };
}

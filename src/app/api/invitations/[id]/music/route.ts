import { createHash } from "node:crypto";

import {
  CUSTOM_MUSIC_ATTEST_HEADER,
  CUSTOM_MUSIC_ATTEST_VERSION,
  CUSTOM_MUSIC_MAX_BYTES,
  CUSTOM_MUSIC_UPLOADS_PER_DAY,
  parseMp3,
  validateCustomMusicDuration,
  type CustomMusicUploadResult,
} from "@/lib/custom-music";
import { isUuid } from "@/lib/id";
import { customMusicPath } from "@/lib/media";
import { reportHandledError } from "@/lib/observability";
import { checkClientRateLimit, staticRateKey } from "@/lib/request-ip";
import { getStorage } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEffectiveLimits } from "@/server/limits";

/**
 * Unggah musik sendiri (DECISIONS #121) — Route Handler, BUKAN Server Action,
 * dengan alasan yang sama persis dengan unggah video (baca
 * `../video/route.ts`): batas body Server Action 3MB global, dan body yang
 * melewati middleware dipotong diam-diam di 10MB.
 *
 * Body = berkas MP3 MENTAH (bukan FormData), versi pernyataan hak di header
 * `CUSTOM_MUSIC_ATTEST_HEADER`. Pernyataan, `Content-Length`, sesi, kepemilikan
 * (undangan purged = bukan milik siapa pun), PAKET (Premium), kunci takedown,
 * dan kuota harian diputuskan SEBELUM body dibaca — hanya pemilik undangan
 * Premium yang belum habis kuotanya yang bisa membuat server menampung 10 MB.
 *
 * Isi berkas ditegakkan DI SINI, bukan di editor: `parseMp3` menelusuri rantai
 * frame dan yang disimpan HANYA byte frame (tag ID3/sampul/ekor/sisipan
 * dibuang); durasi dihitung dari frame yang sama. `Content-Type` kiriman klien
 * diabaikan — objek selalu `audio/mpeg`.
 *
 * Menulis SATU baris `music_uploads` (service_role): catatan pernyataan hak +
 * sidik byte yang disimpan, sumber kuota, cron penyapu, purge, dan takedown.
 * TIDAK menulis `content` — `content.customMusic` disimpan autosave editor
 * (pola video FASE J). Objek yang tak pernah tersimpan disapu cron sesudah
 * 24 jam lewat barisnya.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KUOTA_JENDELA_MS = 24 * 60 * 60 * 1000;

function jawab(body: CustomMusicUploadResult, status: number): Response {
  return Response.json(body, { status });
}

/**
 * Server Action memeriksa asal permintaan secara bawaan; route handler tidak.
 * Cookie sesi `SameSite=Lax` sudah menolak POST lintas situs, ini lapis kedua
 * dengan perbandingan yang sama dengan Next (Origin vs host yang diteruskan).
 */
function asalSama(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host"))
    ?.split(",")[0]
    ?.trim();
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: invitationId } = await params;
  if (!isUuid(invitationId) || !asalSama(req)) {
    return jawab({ status: "error", reason: "invalid" }, 400);
  }

  // Pernyataan hak WAJIB per unggahan, dengan versi teks yang berlaku: editor
  // usang (versi lama di tab yang lupa dimuat ulang) ditolak, bukan dicatat
  // sebagai persetujuan atas teks yang tak pernah ia tampilkan.
  if (
    req.headers.get(CUSTOM_MUSIC_ATTEST_HEADER) !==
    String(CUSTOM_MUSIC_ATTEST_VERSION)
  ) {
    return jawab({ status: "error", reason: "attest" }, 400);
  }

  // Disaring sebelum apa pun dibaca. `fetch` dengan body berkas selalu
  // mengirim Content-Length; yang tak mengirimnya (chunked) bukan editor kita.
  const panjang = Number(req.headers.get("content-length"));
  if (!Number.isSafeInteger(panjang) || panjang <= 0) {
    return jawab({ status: "error", reason: "invalid" }, 400);
  }
  if (panjang > CUSTOM_MUSIC_MAX_BYTES) {
    return jawab({ status: "error", reason: "size" }, 413);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jawab({ status: "error", reason: "auth" }, 401);

  // Per jaringan (seperti video) DAN per akun: unggahan yang DITOLAK isinya
  // (bukan MP3, terlalu pendek) tetap membuat server membaca 10 MB, tetapi tak
  // menambah baris kuota — plafon akun inilah yang membatasinya.
  if (
    !(
      await checkClientRateLimit(
        "music-upload",
        { max: 6, windowMs: 60_000 },
        undefined,
        [
          {
            key: staticRateKey("music-upload-user", user.id),
            opts: { max: 15, windowMs: 3_600_000 },
          },
        ],
      )
    ).ok
  ) {
    return jawab({ status: "error", reason: "rate" }, 429);
  }

  const { data: inv, error: invError } = await supabase
    .from("invitations")
    .select("id, user_id, package_id, music_locked_at, purged_at")
    .eq("id", invitationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (invError) {
    reportHandledError(invError, "media.music.owner", { invitationId });
    return jawab({ status: "error", reason: "server" }, 500);
  }
  // Undangan yang sudah di-purge (retensi/hapus pemilik) dijawab seperti bukan
  // milik siapa pun: datanya sudah dimusnahkan, dan objek yang diunggah ke
  // kerangkanya tak dirujuk apa pun — hanya menunggu disapu cron.
  if (!inv || inv.purged_at) {
    return jawab({ status: "error", reason: "auth" }, 404);
  }

  // PENEGAKAN PAKET DI SERVER: Premium = tanpa watermark — konvensi gerbang
  // Premium yang sama dengan live streaming (`server/invitation-data.ts`).
  // Draft tanpa paket jatuh ke lantai Basic (ber-watermark → ditolak).
  const limits = await getEffectiveLimits(supabase, inv.package_id, user.id);
  if (limits.watermark) {
    return jawab({ status: "error", reason: "plan" }, 403);
  }

  // Dikunci admin sesudah takedown — hanya admin yang bisa membukanya
  // (`admin_unlock_custom_music`); pemilik tak punya hak UPDATE kolom ini.
  if (inv.music_locked_at) {
    return jawab({ status: "error", reason: "locked" }, 403);
  }

  // Kuota dari tabel catatan (bertahan melewati deploy, tak seperti rate limit
  // di memori). Baris yang sudah diganti/di-takedown TETAP dihitung: yang
  // dibatasi adalah unggahannya. `id` diambil DARI BARIS DB, bukan param URL.
  const admin = createSupabaseAdminClient();
  const sejak = new Date(Date.now() - KUOTA_JENDELA_MS).toISOString();
  const { count, error: kuotaError } = await admin
    .from("music_uploads")
    .select("id", { count: "exact", head: true })
    .eq("invitation_id", inv.id)
    .gte("created_at", sejak);
  if (kuotaError || count === null) {
    reportHandledError(kuotaError, "media.music.quota", { invitationId });
    return jawab({ status: "error", reason: "server" }, 500);
  }
  if (count >= CUSTOM_MUSIC_UPLOADS_PER_DAY) {
    return jawab({ status: "error", reason: "quota" }, 429);
  }

  // Baru sekarang body dibaca.
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await req.arrayBuffer());
  } catch {
    return jawab({ status: "error", reason: "invalid" }, 400);
  }
  if (bytes.byteLength !== panjang) {
    return jawab({ status: "error", reason: "invalid" }, 400);
  }

  const mp3 = parseMp3(bytes);
  if (!mp3.ok) return jawab({ status: "error", reason: mp3.reason }, 400);
  const durasiSalah = validateCustomMusicDuration(mp3.durationSec);
  if (durasiSalah) return jawab({ status: "error", reason: durasiSalah }, 400);

  // HANYA byte frame yang disimpan. Salinan berdiri sendiri (`slice`, bukan
  // `subarray`): driver yang kelak membaca `.buffer` pun tak bisa ikut
  // menyimpan tag/sisipan yang baru saja dibuang.
  const audio = bytes.slice(mp3.start, mp3.end);
  const sha256 = createHash("sha256").update(audio).digest("hex");
  const path = customMusicPath(inv.id, crypto.randomUUID());

  const storage = getStorage();
  try {
    await storage.upload({ path, body: audio, contentType: "audio/mpeg" });
  } catch (err) {
    reportHandledError(err, "media.music.upload", { invitationId });
    await Promise.allSettled([storage.delete(path)]);
    return jawab({ status: "error", reason: "server" }, 500);
  }

  // Tanpa baris, objek ini tak dikenal cron penyapu/purge/takedown — berkas
  // publik permanen yang tak tercatat. Gagal mencatat = batalkan unggahannya.
  const { error: catatError } = await admin.from("music_uploads").insert({
    invitation_id: inv.id,
    user_id: user.id,
    path,
    sha256,
    bytes: audio.byteLength,
    duration_ms: Math.round(mp3.durationSec * 1000),
    attest_version: CUSTOM_MUSIC_ATTEST_VERSION,
  });
  if (catatError) {
    reportHandledError(catatError, "media.music.record", { invitationId });
    await Promise.allSettled([storage.delete(path)]);
    return jawab({ status: "error", reason: "server" }, 500);
  }

  return jawab(
    {
      status: "success",
      path,
      url: storage.getPublicUrl(path),
      durationSec: mp3.durationSec,
    },
    200,
  );
}

import { downloadZip } from "client-zip";

import { copy } from "@/lib/copy";
import { isUuid } from "@/lib/id";
import { displayPath } from "@/lib/media";
import { getStorage } from "@/lib/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { responsArsipPadam, siapkanArsip, urutan } from "@/server/arsip-zip";

/**
 * Unduh ZIP foto GALERI undangan (AUDIT-2026-10-01 B7 backlog, DECISIONS #66).
 *
 * Kenapa route ini ada: `/syarat` dan email peringatan pra-purge H-30/H-7
 * menyuruh pemilik mengunduh datanya sebelum retensi menghapusnya — padahal foto
 * galeri satu-satunya data yang TIDAK punya jalan unduh. Daftar tamu punya ekspor
 * .xlsx, Album Momen punya ZIP; galeri tidak. Sejak #66 teks `/syarat` dibuat
 * jujur mengakuinya; route ini yang akhirnya menutup celahnya.
 *
 * STREAMING via `client-zip`, pola yang sama dengan ZIP Album Momen: generator
 * menarik satu foto pada satu waktu lalu langsung dialirkan (STORE, tanpa
 * kompres ulang — WebP sudah terkompres), jadi memori VPS tetap ~1 foto.
 *
 * YANG DIUNDUH ADALAH VARIAN 1600px, BUKAN BERKAS ASLI PEMILIK. Foto dikompres
 * di browser klien menjadi dua varian WebP sebelum diunggah (SPEC §4.4) —
 * server tidak pernah menerima, apalagi menyimpan, berkas kamera aslinya. Teks
 * di UI dan `/syarat` HARUS mengatakan itu; menjanjikan "foto asli" akan menjadi
 * janji yang tak bisa ditepati oleh arsitektur mana pun di sini.
 *
 * SENGAJA TIDAK memeriksa `invitations.status`: justru undangan `expired` yang
 * paling butuh route ini, karena itulah keadaan yang menuju purge. Yang ditolak
 * hanya undangan yang datanya SUDAH dihapus (`purged_at`), di mana objek
 * storage-nya memang tak ada lagi.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });

  // Auth + kepemilikan lewat RLS: klien ber-sesi hanya melihat undangan miliknya,
  // jadi `maybeSingle()` yang kosong sudah menutup undangan orang lain tanpa
  // perlu membandingkan `user_id` sendiri.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: inv } = await supabase
    .from("invitations")
    .select("id, slug, purged_at")
    .eq("id", id)
    .maybeSingle();
  if (!inv) return new Response("Not found", { status: 404 });
  // Data pribadi sudah dihapus permanen (retensi UU PDP) — objek storage-nya
  // ikut terhapus, jadi ZIP-nya akan kosong. 410 Gone, bukan 404: barisnya ada,
  // isinya yang sudah tidak ada, dan bedanya penting bagi pemilik yang bertanya.
  if (inv.purged_at) return new Response("Gone", { status: 410 });

  // Klien RLS, BUKAN service_role: `media_select` sudah membatasi ke
  // `owns_invitation`, jadi kepemilikan ditegakkan dua kali (cek di atas +
  // lantai RLS) dan route ini tak perlu kunci yang mem-bypass RLS sama sekali.
  const { data: rows } = await supabase
    .from("media")
    .select("storage_path, sort_order, created_at")
    .eq("invitation_id", id)
    .eq("type", "photo")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const photos = rows ?? [];
  if (photos.length === 0) return new Response("Not found", { status: 404 });

  const storage = getStorage();

  // Generator async → satu foto pada satu waktu. Foto yang gagal di-fetch
  // DILEWATI dan ZIP tetap jadi: pemilik yang kehilangan satu foto jauh lebih
  // baik daripada pemilik yang tak bisa mengunduh apa pun menjelang purge.
  //
  // Yang tidak boleh diam adalah PADAM TOTAL: ZIP sah berisi nol foto, 200 OK,
  // di jalur penyelamatan terakhir pra-purge. `siapkanArsip` memisahkan kedua
  // keadaan itu dan melaporkan keduanya — alasannya di `server/arsip-zip.ts`.
  const arsip = await siapkanArsip(
    photos.map((p, k) => ({
      // `media.storage_path` adalah PREFIX; varian display ada di dalamnya.
      url: storage.getPublicUrl(displayPath(p.storage_path)),
      name: `foto-${urutan(k + 1)}.webp`,
      lastModified: new Date(p.created_at),
    })),
    "zip.galeri",
    { invitationId: id },
  );
  if (arsip.padam) return responsArsipPadam(copy.common.arsipPadam);

  const zip = downloadZip(arsip.files());
  return new Response(zip.body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="foto-galeri-${inv.slug}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}

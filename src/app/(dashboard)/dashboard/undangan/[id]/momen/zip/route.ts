import { downloadZip } from "client-zip";

import { isUuid } from "@/lib/id";
import { getStorage } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Unduh ZIP seluruh album (host, MOMEN-SPEC §5). STREAMING via `client-zip` —
 * tiap foto diambil satu per satu lewat generator lalu langsung dialirkan ke
 * respons (STORE, tanpa kompres ulang: WebP/JPEG sudah terkompres) → memori VPS
 * tetap ~1 foto, aman untuk album ≥100 foto. Auth: pemilik undangan (RLS);
 * mutasi tak ada. Byte foto diambil dari URL publik (jalur penyajian yang sama
 * untuk kedua driver storage) — foto yang gagal diambil dilewati, ZIP tetap jadi.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeName(name: string): string {
  const s = name
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
  return s || "tamu";
}

function extOf(path: string): string {
  return path.endsWith(".jpg") ? "jpg" : "webp";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });

  // Auth + kepemilikan (RLS: undangan milik pemanggil saja).
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, slug")
    .eq("id", id)
    .maybeSingle();
  if (!inv) return new Response("Not found", { status: 404 });

  const admin = createSupabaseAdminClient();
  const { data: album } = await admin
    .from("momen_albums")
    .select("id, status")
    .eq("invitation_id", id)
    .maybeSingle();
  if (!album || album.status !== "active") {
    return new Response("Not found", { status: 404 });
  }

  // Hanya foto VISIBLE (hidden = dimoderasi keluar). Urut kronologis.
  const { data: rows } = await admin
    .from("momen_photos")
    .select("guest_name, storage_path, created_at")
    .eq("album_id", album.id)
    .eq("status", "visible")
    .order("created_at", { ascending: true });
  const photos = rows ?? [];

  const storage = getStorage();

  // Generator async → client-zip menarik satu foto pada satu waktu (memori
  // terbatas). Foto yang gagal di-fetch dilewati (best-effort). Input = Response
  // (client-zip mengalirkan body-nya; tipe InputWithMeta, di-infer).
  async function* files() {
    let i = 0;
    for (const p of photos) {
      i += 1;
      let res: Response;
      try {
        res = await fetch(storage.getPublicUrl(p.storage_path));
      } catch {
        continue;
      }
      if (!res.ok || !res.body) continue;
      const seq = String(i).padStart(3, "0");
      yield {
        name: `${seq}-${safeName(p.guest_name)}.${extOf(p.storage_path)}`,
        input: res,
        lastModified: new Date(p.created_at),
      };
    }
  }

  const zip = downloadZip(files());
  return new Response(zip.body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="album-momen-${inv.slug}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}

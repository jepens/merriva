import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";

import { PrintButton } from "@/components/print-button";
import "@/components/dashboard/momen/momen-qr.css";
import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { appUrl } from "@/lib/env";
import { isUuid } from "@/lib/id";
import { parseContentForRender } from "@/lib/invitation-content";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/guards/auth";

export const metadata: Metadata = { title: copy.momen.qr.title };

const q = copy.momen.qr;

export default async function MomenQrPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  if (!isUuid(id)) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, slug, status, category, content")
    .eq("id", id)
    .maybeSingle();
  if (!inv || inv.status !== "active") notFound();

  const admin = createSupabaseAdminClient();
  const { data: album } = await admin
    .from("momen_albums")
    .select("id, status")
    .eq("invitation_id", id)
    .maybeSingle();
  // Belum ada album → arahkan ke halaman kelola (aktivasi).
  if (!album || album.status !== "active") {
    redirect(`/dashboard/undangan/${id}/momen`);
  }

  const guestUrl = `${appUrl}/${inv.slug}/momen`;
  const shortUrl = guestUrl.replace(/^https?:\/\//, "");
  const parsed = parseContentForRender(inv.content, inv.category);
  const title =
    parsed.category === "wedding"
      ? `${parsed.groom.nickname || parsed.groom.name || copy.public.cover.groomFallback} & ${parsed.bride.nickname || parsed.bride.name || copy.public.cover.brideFallback}`
      : copy.momen.brand;

  // SVG QR dihasilkan server (tanpa JS klien). Konten SVG milik kita → aman.
  const svg = await QRCode.toString(guestUrl, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#221c14", light: "#ffffff" },
  });

  return (
    <div className="mn-qr-wrap space-y-4">
      <div className="mn-noprint flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">{q.title}</h1>
        <Link
          href={`/dashboard/undangan/${id}/momen`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          {q.back}
        </Link>
      </div>

      <div className="mn-qr-card">
        <div className="mn-qr-kicker">{q.kicker}</div>
        <div className="mn-qr-title">{title}</div>
        <div className="mn-qr-svg" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mn-qr-instruction">{q.instruction}</p>
        <p className="mn-qr-url">{shortUrl}</p>
        <p className="mn-qr-hint">{q.hint}</p>
      </div>

      <div className="mn-noprint flex justify-center">
        <PrintButton label={q.print} />
      </div>
    </div>
  );
}

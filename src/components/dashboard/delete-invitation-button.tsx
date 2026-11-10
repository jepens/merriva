"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { deleteInvitationAction } from "@/server/actions/invitation";

/**
 * Tombol "Hapus undangan" self-service (hanya draf/kedaluwarsa — SPEC §3 /
 * DATA-MODEL §5). Konfirmasi eksplisit sebelum aksi destruktif; sukses →
 * `router.refresh()` memuat ulang daftar (kartu hilang: draf terhapus penuh,
 * kedaluwarsa disaring `purged_at`). Tombol tetap nonaktif setelah sukses agar
 * tak ada klik ganda selama refresh.
 */
export function DeleteInvitationButton({
  invitationId,
}: {
  invitationId: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (busy) return;
    const ok = await confirm({
      title: copy.dashboard.deleteConfirmTitle,
      description: copy.dashboard.deleteConfirm,
      confirmLabel: copy.dashboard.deleteConfirmCta,
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    const res = await deleteInvitationAction(invitationId);
    if (res.status === "success") {
      toast.success(copy.dashboard.deleted);
      router.refresh();
    } else {
      setError(res.message ?? copy.dashboard.deleteError);
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-destructive hover:text-destructive"
        onClick={handleDelete}
        disabled={busy}
      >
        {busy ? copy.dashboard.deleting : copy.dashboard.cardDelete}
      </Button>
      {error ? (
        <p className="text-destructive w-full text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

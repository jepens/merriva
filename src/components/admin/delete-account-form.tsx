"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import { adminDeleteAccountAction } from "@/server/actions/admin-users";

const d = copy.admin.deleteAccount;

/**
 * Hapus akun permanen (AUDIT-2026-10-01 A6).
 *
 * Tiga lapis penjagaan karena tindakan ini tak bisa dibatalkan: form harus
 * dibuka dulu (satu klik tak cukup), email akun TARGET harus diketik ulang dan
 * dicocokkan DI SERVER, dan alasan wajib diisi karena ia masuk `admin_logs`.
 *
 * Email ditampilkan sebagai `placeholder`, bukan nilai bawaan — menyalinnya
 * dari layar masih menuntut tindakan sadar, sementara nilai bawaan akan membuat
 * konfirmasinya sekadar formalitas.
 */
export function DeleteAccountForm({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const [buka, setBuka] = useState(false);

  if (!buka) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setBuka(true)}
      >
        {d.cta}
      </Button>
    );
  }

  return (
    <form
      action={adminDeleteAccountAction.bind(null, userId)}
      onSubmit={(e) => {
        if (!window.confirm(d.confirm)) e.preventDefault();
      }}
      className="flex min-w-64 flex-col gap-2"
    >
      <Input
        name="reason"
        required
        maxLength={500}
        placeholder={d.reasonPlaceholder}
        aria-label={d.reasonLabel}
        className="h-8 text-xs"
      />
      <Input
        name="confirmEmail"
        required
        maxLength={320}
        placeholder={email}
        aria-label={d.confirmLabel}
        className="h-8 text-xs"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="destructive">
          {d.submit}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setBuka(false)}
        >
          {copy.common.cancel}
        </Button>
      </div>
      <p className="text-muted-foreground text-[11px] leading-snug">{d.note}</p>
    </form>
  );
}

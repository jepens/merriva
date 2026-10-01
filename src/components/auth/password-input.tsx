"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";

import { Input, type InputProps } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

/**
 * Field kata sandi dengan tombol "lihat" (AUDIT-2026-10-01 B2).
 *
 * Form pendaftaran produk ini tak punya satu pun pengaman salah-ketik: tak ada
 * field konfirmasi, tak ada tombol lihat, dan syarat panjangnya baru muncul
 * SETELAH submit ditolak. Akibatnya salah ketik satu karakter menghasilkan akun
 * yang kata sandinya tak diketahui pemiliknya — dan karena respons pendaftaran
 * sengaja dibuat generik demi anti-enumerasi, mendaftar ulang justru menjawab
 * "Akun dibuat" tanpa mengirim email baru.
 *
 * Dipilih tombol lihat, BUKAN kolom konfirmasi: halaman ini hidup di HP, dan
 * mengetik kata sandi dua kali di keyboard ponsel kerap disiasati salin-tempel
 * sehingga salah ketiknya ikut tersalin. NIST SP 800-63B §5.1.1.2 juga
 * menganjurkan memperlihatkan kata sandi ketimbang memintanya dua kali.
 *
 * Tombolnya `type="button"` — tanpa itu ia menjadi tombol submit default di
 * dalam `<form>` dan menekan "lihat" justru mengirim formulirnya.
 */
export function PasswordInput({
  className,
  hint,
  ...props
}: Omit<InputProps, "type"> & { hint?: string }) {
  const [terlihat, setTerlihat] = useState(false);
  const hintId = useId();

  return (
    <>
      <div className="relative">
        <Input
          {...props}
          type={terlihat ? "text" : "password"}
          className={cn("pr-10", className)}
          aria-describedby={hint ? hintId : props["aria-describedby"]}
        />
        <button
          type="button"
          onClick={() => setTerlihat((v) => !v)}
          aria-pressed={terlihat}
          aria-label={
            terlihat ? copy.auth.passwordHide : copy.auth.passwordShow
          }
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md focus-visible:ring-1 focus-visible:outline-none"
        >
          {terlihat ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
    </>
  );
}

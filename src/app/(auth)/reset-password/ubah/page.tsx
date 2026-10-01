import type { Metadata } from "next";

import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: "Atur kata sandi baru" };

/**
 * Halaman ini dijangkau setelah tautan recovery diklik → /auth/confirm menaruh
 * sesinya di cookie lalu redirect ke sini.
 *
 * Komentar lama di sini menyatakan "dibuka tanpa sesi recovery akan ditolak
 * (getUser null)" — itu SALAH, dan selama berbulan-bulan menutupi celah nyata:
 * sesi dashboard biasa juga membuat `getUser()` tak-null, sehingga siapa pun
 * yang memegang perangkat yang masih login bisa mengganti kata sandi di sini
 * tanpa tahu yang lama. Penjagaannya kini ada di `updatePasswordAction`, yang
 * menuntut sesi lahir dari klik tautan email yang masih segar
 * (AUDIT-2026-10-01 B1, DECISIONS #51).
 */
export default function UpdatePasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.auth.updatePasswordTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <UpdatePasswordForm />
      </CardContent>
    </Card>
  );
}

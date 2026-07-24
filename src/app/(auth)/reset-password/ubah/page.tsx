import type { Metadata } from "next";

import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: "Atur kata sandi baru" };

/**
 * Halaman ini dijangkau setelah tautan recovery diklik → /auth/confirm menaruh
 * sesi recovery di cookie lalu redirect ke sini. Jika dibuka tanpa sesi recovery,
 * updatePasswordAction akan menolak (getUser null).
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

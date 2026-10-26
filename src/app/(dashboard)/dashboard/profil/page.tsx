import type { Metadata } from "next";

import { ChangePasswordForm } from "@/components/dashboard/change-password-form";
import { ProfileForm } from "@/components/dashboard/profile-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { dataOrThrow } from "@/lib/supabase/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/guards/auth";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  // Galat DB akan merender form profil KOSONG — terlihat seperti data yang
  // hilang, dan mengundang pemilik mengetik ulang di atas yang sebenarnya ada.
  const profile = dataOrThrow(
    await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .single(),
    "profiles (halaman profil)",
  );

  return (
    <div className="max-w-lg space-y-6">
      {/*
        Satu-satunya halaman dashboard yang dulu TAK punya `h1` sama sekali:
        isinya hanya Card, dan `CardTitle` dipaku ke `h2`. Akibatnya pembaca
        layar yang menavigasi antar-heading mendarat di halaman tanpa judul
        tingkat atas, dan urutan headingnya melompat dari h2.
        `sr-only`, bukan judul terlihat: kartu pertama sudah berjudul "Profil",
        jadi judul kedua yang terlihat hanya akan menduplikasinya.
      */}
      <h1 className="sr-only">{copy.dashboard.profileTitle}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{copy.dashboard.profileTitle}</CardTitle>
          <CardDescription>{copy.dashboard.profileSubtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            email={user.email ?? ""}
            defaultName={profile?.full_name ?? ""}
            defaultPhone={profile?.phone ?? ""}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy.auth.changePasswordTitle}</CardTitle>
          <CardDescription>{copy.auth.changePasswordSubtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}

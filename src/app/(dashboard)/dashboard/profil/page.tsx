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
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/guards/auth";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .single();

  return (
    <div className="max-w-lg space-y-6">
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

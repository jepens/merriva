import type { Metadata } from "next";

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
    <Card className="max-w-lg">
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
  );
}

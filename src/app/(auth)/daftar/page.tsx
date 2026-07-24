import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GoogleButton } from "@/components/auth/google-button";
import { RegisterForm } from "@/components/auth/register-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { getSessionUser } from "@/server/guards/auth";

export const metadata: Metadata = { title: "Daftar" };

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.auth.registerTitle}</CardTitle>
        <CardDescription>{copy.auth.registerSubtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RegisterForm />

        <div className="flex items-center gap-3">
          <span className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-xs">
            {copy.auth.orSeparator}
          </span>
          <span className="bg-border h-px flex-1" />
        </div>

        <GoogleButton />

        <p className="text-muted-foreground text-center text-sm">
          <Link href="/masuk" className="hover:underline">
            {copy.auth.toLogin}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

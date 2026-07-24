import type { Metadata } from "next";
import Link from "next/link";

import { ResetRequestForm } from "@/components/auth/reset-request-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: "Lupa kata sandi" };

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.auth.resetTitle}</CardTitle>
        <CardDescription>{copy.auth.resetSubtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResetRequestForm />
        <p className="text-muted-foreground text-center text-sm">
          <Link href="/masuk" className="hover:underline">
            {copy.auth.toLogin}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

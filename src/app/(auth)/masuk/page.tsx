import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GoogleButton } from "@/components/auth/google-button";
import { LoginForm } from "@/components/auth/login-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { safeNextPath } from "@/lib/safe-redirect";
import { getSessionUser } from "@/server/guards/auth";

export const metadata: Metadata = { title: "Masuk" };

const errorCopy: Record<string, string> = {
  oauth: copy.auth.errorOauthLogin,
  config: copy.auth.errorOauthConfig,
  verify: copy.auth.errorVerifyLink,
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  const user = await getSessionUser();
  if (user) {
    redirect(safeNextPath(next));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.auth.loginTitle}</CardTitle>
        <CardDescription>{copy.auth.loginSubtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && errorCopy[error] ? (
          <Alert variant="destructive">
            <AlertDescription>{errorCopy[error]}</AlertDescription>
          </Alert>
        ) : null}

        <LoginForm next={next} />

        <div className="flex items-center gap-3">
          <span className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-xs">
            {copy.auth.orSeparator}
          </span>
          <span className="bg-border h-px flex-1" />
        </div>

        <GoogleButton next={next} />

        <p className="text-muted-foreground text-center text-sm">
          {/* `next` ikut menyeberang: pengunjung yang sampai di sini karena
              memilih tema justru paling sering BELUM punya akun, dan tautan
              yang membuangnya mengembalikan mereka ke dasbor kosong. */}
          <Link
            href={next ? `/daftar?next=${encodeURIComponent(next)}` : "/daftar"}
            className="hover:underline"
          >
            {copy.auth.toRegister}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

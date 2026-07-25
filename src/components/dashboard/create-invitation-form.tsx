"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import {
  createInvitationSchema,
  type CreateInvitationInput,
} from "@/lib/validation/invitation";
import { createInvitationAction } from "@/server/actions/invitation";
import type { InvitationCategory } from "@/types";

type ThemeOption = {
  slug: string;
  name: string;
  categories: InvitationCategory[];
  tier: string;
};

const CATEGORIES: InvitationCategory[] = ["wedding", "corporate", "family"];

export function CreateInvitationForm({ themes }: { themes: ThemeOption[] }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateInvitationInput>({
    resolver: zodResolver(createInvitationSchema),
    defaultValues: { category: "wedding", themeSlug: "" },
  });

  const category = watch("category");
  const themeSlug = watch("themeSlug");
  const available = themes.filter((t) => t.categories.includes(category));

  const onSubmit = async (values: CreateInvitationInput) => {
    setFormError(null);
    const res = await createInvitationAction(values);
    // Sukses → server action melakukan redirect; hanya error yang kembali.
    if (res.status === "error") {
      setFormError(res.message ?? copy.common.error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium">{copy.create.chooseCategory}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => {
                setValue("category", c);
                setValue("themeSlug", "");
              }}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                category === c
                  ? "border-primary ring-primary ring-1"
                  : "hover:bg-accent",
              )}
            >
              <p className="font-medium">{copy.create.category[c]}</p>
              <p className="text-muted-foreground text-xs">
                {copy.create.categoryDesc[c]}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">{copy.create.chooseTheme}</h2>
        {available.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {copy.create.noThemeForCategory}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {available.map((t) => (
              <button
                key={t.slug}
                type="button"
                aria-pressed={themeSlug === t.slug}
                onClick={() =>
                  setValue("themeSlug", t.slug, { shouldValidate: true })
                }
                className={cn(
                  "rounded-lg border p-4 text-left transition-colors",
                  themeSlug === t.slug
                    ? "border-primary ring-primary ring-1"
                    : "hover:bg-accent",
                )}
              >
                <p className="font-medium">{t.name}</p>
                <p className="text-muted-foreground text-xs capitalize">
                  {t.tier}
                </p>
              </button>
            ))}
          </div>
        )}
        {errors.themeSlug ? (
          <p className="text-destructive text-xs">{errors.themeSlug.message}</p>
        ) : null}
      </section>

      <Button type="submit" disabled={isSubmitting || available.length === 0}>
        {isSubmitting ? copy.create.creating : copy.create.submit}
      </Button>
    </form>
  );
}

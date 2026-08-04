"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Eye, Send } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { ThemeThumb } from "@/components/dashboard/theme-thumb";
import { ThemeMockup } from "@/components/theme-mockup";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
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
  hasThumb: boolean;
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
            {available.map((t) => {
              const selected = themeSlug === t.slug;
              const tierLabel =
                t.tier === "premium"
                  ? copy.create.tier.premium
                  : copy.create.tier.standard;
              return (
                <div
                  key={t.slug}
                  className={cn(
                    "bg-card relative overflow-hidden rounded-xl border transition-colors",
                    selected
                      ? "border-primary ring-primary ring-1"
                      : "border-border",
                  )}
                >
                  {t.hasThumb ? (
                    <ThemeMockup slug={t.slug} name={t.name} />
                  ) : (
                    <ThemeThumb slug={t.slug} name={t.name} />
                  )}
                  {selected ? (
                    <span className="bg-primary text-primary-foreground absolute top-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full shadow">
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </span>
                  ) : null}
                  <div className="space-y-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{t.name}</p>
                      <span className="text-muted-foreground text-xs">
                        {tierLabel}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`/preview/tema/${t.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "flex-1",
                        )}
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        {copy.create.previewBtn}
                      </a>
                      <button
                        type="button"
                        aria-pressed={selected}
                        aria-label={copy.create.selectThemeAria(t.name)}
                        onClick={() =>
                          setValue("themeSlug", t.slug, {
                            shouldValidate: true,
                          })
                        }
                        className={cn(
                          buttonVariants({
                            variant: selected ? "secondary" : "default",
                            size: "sm",
                          }),
                          "flex-1",
                        )}
                      >
                        {selected ? (
                          <>
                            <Check className="h-4 w-4" aria-hidden="true" />
                            {copy.create.chosen}
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4" aria-hidden="true" />
                            {copy.create.useTheme}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
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

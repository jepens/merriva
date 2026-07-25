"use client";

import { useFieldArray, type UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/lib/copy";

import { Field } from "../field";
import type { WeddingEditorValues } from "../types";

export function EnvelopeStep({
  form,
}: {
  form: UseFormReturn<WeddingEditorValues>;
}) {
  const { register, control } = form;
  const banks = useFieldArray({ control, name: "content.envelope.banks" });
  const ewallets = useFieldArray({
    control,
    name: "content.envelope.ewallets",
  });

  return (
    <div className="space-y-6">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox {...register("content.envelope.enabled")} />
        {copy.editor.fields.envelopeEnabled}
      </label>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">{copy.editor.list.bankSection}</h3>
        {banks.fields.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {copy.editor.list.bankEmpty}
          </p>
        ) : null}
        {banks.fields.map((f, i) => (
          <div
            key={f.id}
            className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <Input
              placeholder={copy.editor.fields.bank}
              {...register(`content.envelope.banks.${i}.bank`)}
            />
            <Input
              placeholder={copy.editor.fields.accountNumber}
              {...register(`content.envelope.banks.${i}.number`)}
            />
            <Input
              placeholder={copy.editor.fields.accountHolder}
              {...register(`content.envelope.banks.${i}.holder`)}
            />
            <Button variant="ghost" size="sm" onClick={() => banks.remove(i)}>
              {copy.editor.list.remove}
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => banks.append({ bank: "", number: "", holder: "" })}
        >
          {copy.editor.list.addBank}
        </Button>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">
          {copy.editor.list.ewalletSection}
        </h3>
        {ewallets.fields.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {copy.editor.list.ewalletEmpty}
          </p>
        ) : null}
        {ewallets.fields.map((f, i) => (
          <div key={f.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              placeholder={copy.editor.fields.ewalletProvider}
              {...register(`content.envelope.ewallets.${i}.provider`)}
            />
            <Input
              placeholder={copy.editor.fields.ewalletNumber}
              {...register(`content.envelope.ewallets.${i}.number`)}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => ewallets.remove(i)}
            >
              {copy.editor.list.remove}
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => ewallets.append({ provider: "", number: "" })}
        >
          {copy.editor.list.addEwallet}
        </Button>
      </div>

      <Field label={copy.editor.fields.giftAddress}>
        <Textarea {...register("content.envelope.giftAddress")} />
      </Field>
    </div>
  );
}

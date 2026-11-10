"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import type { GuestView } from "@/lib/validation/guest";
import {
  addGuestAction,
  deleteGuestAction,
  updateGuestAction,
} from "@/server/actions/guests";

import { GuestImportExport } from "./guest-import-export";

interface FormValues {
  name: string;
  phone: string;
  group: string;
  pax: number;
  notes: string;
}

const EMPTY: FormValues = { name: "", phone: "", group: "", pax: 2, notes: "" };

function toInput(f: FormValues) {
  return {
    name: f.name,
    phone: f.phone,
    groupLabel: f.group,
    paxAllocated: f.pax,
    notes: f.notes,
  };
}

function fromGuest(g: GuestView): FormValues {
  return {
    name: g.name,
    phone: g.phone ?? "",
    group: g.groupLabel ?? "",
    pax: g.paxAllocated,
    notes: g.notes ?? "",
  };
}

function firstError(fe?: Record<string, string[] | undefined>): string | null {
  if (!fe) return null;
  for (const key of Object.keys(fe)) {
    const arr = fe[key];
    if (arr && arr[0]) return arr[0];
  }
  return null;
}

/**
 * Manajemen tamu (SPEC §4.7): tambah / ubah (inline) / hapus + salin link
 * personal. State lokal diperbarui optimistis setelah action sukses. Batas paket
 * ditegakkan OTORITATIF di DB (RPC `insert_guest`); di sini hanya menonaktifkan
 * tombol tambah saat kuota terlihat penuh (UX).
 */
export function GuestManager({
  invitationId,
  slug,
  initial,
  maxGuests,
}: {
  invitationId: string;
  slug: string;
  initial: GuestView[];
  maxGuests: number | null;
}) {
  const confirm = useConfirm();
  const t = copy.dashboard.guests;
  const [guests, setGuests] = useState<GuestView[]>(initial);
  const [addForm, setAddForm] = useState<FormValues>(EMPTY);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormValues>(EMPTY);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const atLimit = maxGuests !== null && guests.length >= maxGuests;

  async function handleAdd() {
    if (adding || atLimit || !addForm.name.trim()) return;
    setAdding(true);
    setAddError(null);
    const res = await addGuestAction(invitationId, toInput(addForm));
    if (res.status === "success") {
      setGuests((prev) => [res.guest, ...prev]);
      setAddForm(EMPTY);
    } else {
      setAddError(res.message ?? firstError(res.fieldErrors) ?? t.actionError);
    }
    setAdding(false);
  }

  function startEdit(g: GuestView) {
    setEditingId(g.id);
    setEditForm(fromGuest(g));
    setRowError(null);
  }

  async function saveEdit(id: string) {
    if (busyId || !editForm.name.trim()) return;
    setBusyId(id);
    setRowError(null);
    const res = await updateGuestAction(invitationId, id, toInput(editForm));
    if (res.status === "success") {
      setGuests((prev) => prev.map((g) => (g.id === id ? res.guest : g)));
      setEditingId(null);
    } else {
      setRowError(res.message ?? firstError(res.fieldErrors) ?? t.actionError);
    }
    setBusyId(null);
  }

  async function remove(id: string) {
    if (busyId) return;
    const ok = await confirm({
      title: t.confirmRemoveTitle,
      description: t.confirmRemove,
      confirmLabel: t.confirmRemoveCta,
      destructive: true,
    });
    if (!ok) return;
    setBusyId(id);
    setRowError(null);
    const res = await deleteGuestAction(invitationId, id);
    if (res.status === "success") {
      setGuests((prev) => prev.filter((g) => g.id !== id));
      if (editingId === id) setEditingId(null);
      toast.success(t.removed);
    } else {
      setRowError(res.message ?? t.actionError);
    }
    setBusyId(null);
  }

  async function copyLink(g: GuestView) {
    const url = `${window.location.origin}/${slug}?g=${g.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(g.id);
      setTimeout(() => setCopiedId((c) => (c === g.id ? null : c)), 1500);
    } catch {
      // clipboard tak tersedia — abaikan diam-diam.
    }
  }

  return (
    <div className="space-y-6">
      {/* Impor / ekspor */}
      <GuestImportExport
        invitationId={invitationId}
        slug={slug}
        guestCount={guests.length}
        onImported={(imported) => setGuests((prev) => [...imported, ...prev])}
      />

      {/* Tambah tamu */}
      <Card>
        <CardContent className="space-y-4 py-5">
          <h2 className="text-base font-medium">{t.addTitle}</h2>
          <GuestFields
            idPrefix="add"
            values={addForm}
            disabled={adding || atLimit}
            onChange={setAddForm}
          />
          {addError ? (
            <p className="text-destructive text-sm" role="alert">
              {addError}
            </p>
          ) : null}
          {atLimit ? (
            <p className="text-muted-foreground text-sm">{t.limitReached}</p>
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={handleAdd}
            disabled={adding || atLimit || !addForm.name.trim()}
          >
            {adding ? t.adding : t.addCta}
          </Button>
        </CardContent>
      </Card>

      {rowError ? (
        <p className="text-destructive text-sm" role="alert">
          {rowError}
        </p>
      ) : null}

      {/* Daftar tamu */}
      {guests.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t.empty}</p>
      ) : (
        <ul className="space-y-3">
          {guests.map((g) => {
            const editing = editingId === g.id;
            const busy = busyId === g.id;
            return (
              <li key={g.id}>
                <Card>
                  <CardContent className="space-y-3 py-4">
                    {editing ? (
                      <>
                        <GuestFields
                          idPrefix={`edit-${g.id}`}
                          values={editForm}
                          disabled={busy}
                          onChange={setEditForm}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => saveEdit(g.id)}
                            disabled={busy || !editForm.name.trim()}
                          >
                            {busy ? t.saving : t.save}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                            disabled={busy}
                          >
                            {t.cancel}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{g.name}</span>
                          {g.groupLabel ? (
                            <span className="bg-muted rounded-full px-2 py-0.5 text-xs">
                              {g.groupLabel}
                            </span>
                          ) : null}
                          <span className="text-muted-foreground text-xs">
                            {g.paxAllocated} {t.paxUnit}
                          </span>
                          {g.firstViewedAt ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                              {t.opened}
                            </span>
                          ) : null}
                          {g.waClickedAt ? (
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-800">
                              {t.waSent}
                            </span>
                          ) : null}
                        </div>
                        {g.phone ? (
                          <p className="text-muted-foreground text-sm">
                            {g.phone}
                          </p>
                        ) : null}
                        {g.notes ? (
                          <p className="text-muted-foreground text-sm whitespace-pre-line">
                            {g.notes}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => copyLink(g)}
                          >
                            {copiedId === g.id ? t.copied : t.copyLink}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(g)}
                            disabled={busy}
                          >
                            {t.edit}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => remove(g.id)}
                            disabled={busy}
                          >
                            {busy ? t.removing : t.remove}
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function GuestFields({
  idPrefix,
  values,
  disabled,
  onChange,
}: {
  idPrefix: string;
  values: FormValues;
  disabled?: boolean;
  onChange: (next: FormValues) => void;
}) {
  const t = copy.dashboard.guests;
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    onChange({ ...values, [key]: value });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-name`}>{t.name}</Label>
        <Input
          id={`${idPrefix}-name`}
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          maxLength={80}
          placeholder={t.namePlaceholder}
          disabled={disabled}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-phone`}>{t.phone}</Label>
        <Input
          id={`${idPrefix}-phone`}
          value={values.phone}
          onChange={(e) => set("phone", e.target.value)}
          inputMode="tel"
          maxLength={20}
          placeholder={t.phonePlaceholder}
          disabled={disabled}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-group`}>{t.group}</Label>
        <Input
          id={`${idPrefix}-group`}
          value={values.group}
          onChange={(e) => set("group", e.target.value)}
          maxLength={40}
          placeholder={t.groupPlaceholder}
          disabled={disabled}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-pax`}>{t.pax}</Label>
        <Input
          id={`${idPrefix}-pax`}
          type="number"
          min={1}
          max={20}
          value={values.pax}
          onChange={(e) => set("pax", Number(e.target.value) || 1)}
          disabled={disabled}
          className={cn("max-w-28")}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-notes`}>{t.notes}</Label>
        <Textarea
          id={`${idPrefix}-notes`}
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
          maxLength={300}
          rows={2}
          placeholder={t.notesPlaceholder}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

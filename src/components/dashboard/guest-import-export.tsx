"use client";

import { useRef, useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import {
  GUEST_TEMPLATE_HEADERS,
  parseCsv,
  parseSheetRows,
  type ImportParsed,
} from "@/lib/guest-import";
import type { GuestView } from "@/lib/validation/guest";
import {
  getGuestsExportAction,
  importGuestsAction,
} from "@/server/actions/guest-import";

type Phase = "idle" | "parsing" | "preview" | "importing" | "done";

const MAX_INVALID_SHOWN = 8;

/**
 * Impor (.xlsx/.csv) + ekspor tamu (SPEC §4.7). Parsing di KLIEN (library
 * spreadsheet di-`import()` dinamis → code-split, tak membebani bundle awal &
 * offload dari VPS); hanya baris VALID dikirim ke server yang MEMVALIDASI ULANG
 * lalu insert massal (RPC berlimit). Ekspor: data dari server → berkas dirakit
 * di klien.
 */
export function GuestImportExport({
  invitationId,
  slug,
  guestCount,
  onImported,
}: {
  invitationId: string;
  slug: string;
  guestCount: number;
  onImported: (guests: GuestView[]) => void;
}) {
  const t = copy.dashboard.guestsImport;
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [parsed, setParsed] = useState<ImportParsed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    inserted: number;
    skippedLimit: number;
  } | null>(null);
  const [exporting, setExporting] = useState(false);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = ""; // izinkan pilih berkas sama lagi
    if (!file) return;
    setError(null);
    setResult(null);
    setPhase("parsing");
    try {
      let rows: unknown[][];
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".csv") || file.type === "text/csv") {
        rows = parseCsv(await file.text());
      } else {
        // `readSheet` (bukan default `readXlsxFile` yang mengembalikan Sheet[])
        // membaca 1 sheet → baris array-of-array. Struktur divalidasi ulang di
        // `parseSheetRows`.
        const { readSheet } = await import("read-excel-file/browser");
        rows = (await readSheet(file)) as unknown as unknown[][];
      }
      const p = parseSheetRows(rows);
      if (p.headerError) {
        setError(p.headerError);
        setPhase("idle");
        return;
      }
      setParsed(p);
      setPhase("preview");
    } catch {
      setError(t.parseError);
      setPhase("idle");
    }
  }

  async function confirmImport() {
    if (!parsed || phase === "importing") return;
    setPhase("importing");
    setError(null);
    const res = await importGuestsAction(
      invitationId,
      parsed.valid.map((v) => v.input),
    );
    if (res.status === "success") {
      onImported(res.guests);
      setResult({ inserted: res.inserted, skippedLimit: res.skippedLimit });
      setParsed(null);
      setPhase("done");
    } else {
      setError(res.message ?? t.parseError);
      setPhase("preview");
    }
  }

  function cancelPreview() {
    setParsed(null);
    setError(null);
    setPhase("idle");
  }

  async function downloadTemplate() {
    const { default: writeXlsxFile } = await import("write-excel-file/browser");
    const header = GUEST_TEMPLATE_HEADERS.map((h) => ({
      value: h,
      fontWeight: "bold" as const,
    }));
    const example = [
      { value: "Budi Santoso" },
      { value: "08123456789" },
      { value: "Keluarga" },
      { value: 2, type: Number },
      { value: "Meja depan" },
    ];
    await writeXlsxFile([header, example]).toFile("template-tamu.xlsx");
  }

  async function exportGuests() {
    if (exporting || guestCount === 0) return;
    setExporting(true);
    setError(null);
    try {
      const res = await getGuestsExportAction(invitationId);
      if (res.status !== "success") {
        setError(res.message ?? t.parseError);
        return;
      }
      const { default: writeXlsxFile } =
        await import("write-excel-file/browser");
      const origin = window.location.origin;
      const c = t.col;
      const header = [
        c.name,
        c.phone,
        c.group,
        c.pax,
        c.link,
        c.opened,
        c.rsvp,
        c.rsvpPax,
        c.message,
      ].map((v) => ({ value: v, fontWeight: "bold" as const }));
      const body = res.rows.map((r) => [
        { value: r.name },
        { value: r.phone },
        { value: r.groupLabel },
        { value: r.paxAllocated, type: Number },
        { value: `${origin}/${slug}?g=${r.token}` },
        { value: r.opened ? t.yes : t.no },
        {
          value:
            r.attendance === "yes"
              ? t.rsvpYes
              : r.attendance === "no"
                ? t.rsvpNo
                : t.rsvpNone,
        },
        r.rsvpPax !== null ? { value: r.rsvpPax, type: Number } : { value: "" },
        { value: r.message },
      ]);
      await writeXlsxFile([header, ...body]).toFile("daftar-tamu.xlsx");
    } catch {
      setError(t.parseError);
    } finally {
      setExporting(false);
    }
  }

  const busy = phase === "parsing" || phase === "importing";

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-medium">{t.importTitle}</h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={exportGuests}
            disabled={exporting || guestCount === 0}
          >
            {exporting ? t.exporting : t.exportCta}
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">{t.importHint}</p>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.csv,text/csv"
          onChange={onFile}
          className="hidden"
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            {phase === "parsing" ? t.parsing : t.chooseFile}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={downloadTemplate}
          >
            {t.template}
          </Button>
        </div>

        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}

        {phase === "preview" && parsed ? (
          <div className="bg-muted/40 space-y-3 rounded-md border p-3">
            <p className="text-sm">
              <span className="font-medium text-emerald-700">
                {parsed.valid.length}
              </span>{" "}
              {t.previewValid}
              {parsed.invalid.length > 0 ? (
                <>
                  {" · "}
                  <span className="text-destructive font-medium">
                    {parsed.invalid.length}
                  </span>{" "}
                  {t.previewInvalid}
                </>
              ) : null}
            </p>
            {parsed.invalid.length > 0 ? (
              <ul className="text-muted-foreground space-y-0.5 text-xs">
                {parsed.invalid.slice(0, MAX_INVALID_SHOWN).map((iv) => (
                  <li key={iv.rowNumber}>
                    {t.previewRow} {iv.rowNumber} ({iv.name}): {iv.error}
                  </li>
                ))}
                {parsed.invalid.length > MAX_INVALID_SHOWN ? <li>…</li> : null}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={confirmImport}
                disabled={parsed.valid.length === 0}
              >
                {t.confirmImport} {parsed.valid.length}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={cancelPreview}
              >
                {t.cancel}
              </Button>
            </div>
          </div>
        ) : null}

        {phase === "importing" ? (
          <p className="text-muted-foreground text-sm">{t.importing}</p>
        ) : null}

        {phase === "done" && result ? (
          <p className="text-sm text-emerald-700" role="status">
            {result.inserted > 0
              ? `${result.inserted} ${t.resultInserted}`
              : t.resultNothing}
            {result.skippedLimit > 0
              ? ` ${result.skippedLimit} ${t.resultSkippedLimit}`
              : ""}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

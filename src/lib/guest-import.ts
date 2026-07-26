import { copy } from "@/lib/copy";
import { guestSchema, type GuestInput } from "@/lib/validation/guest";

/**
 * Parsing & validasi impor tamu (SPEC §4.7) — MURNI (tanpa I/O) agar mudah diuji
 * & bisa jalan di klien. Baca berkas (.xlsx via read-excel-file / .csv via
 * `parseCsv`) menghasilkan baris array-of-array; `parseSheetRows` memetakan kolom
 * (header fleksibel), memvalidasi tiap baris dengan `guestSchema` yang SAMA seperti
 * CRUD, lalu memisahkan baris valid vs bermasalah (untuk pratinjau + laporan).
 * Server tetap MEMVALIDASI ULANG sebelum insert.
 */

/** Header template yang diunduh pengguna (urutan kolom baku). */
export const GUEST_TEMPLATE_HEADERS = [
  "Nama",
  "No. WhatsApp",
  "Label",
  "Kursi",
  "Catatan",
] as const;

type ColKey = "name" | "phone" | "group" | "pax" | "notes";

/** Alias header (huruf kecil, tanpa spasi tepi) → kunci kolom. */
const HEADER_ALIASES: Record<ColKey, string[]> = {
  name: ["nama", "name", "nama tamu"],
  phone: [
    "no. whatsapp",
    "no whatsapp",
    "nomor whatsapp",
    "whatsapp",
    "wa",
    "no. wa",
    "no wa",
    "no. hp",
    "no hp",
    "nomor hp",
    "hp",
    "telepon",
    "telpon",
    "phone",
  ],
  group: ["label", "grup", "group", "label / grup", "label/grup", "kategori"],
  pax: ["kursi", "pax", "alokasi", "alokasi kursi", "jumlah", "jumlah tamu"],
  notes: ["catatan", "notes", "note", "keterangan"],
};

export interface ImportRowError {
  rowNumber: number;
  name: string;
  error: string;
}

export interface ImportParsed {
  valid: { rowNumber: number; input: GuestInput }[];
  invalid: ImportRowError[];
  /** Non-null bila header wajib (Nama) tak ditemukan → seluruh berkas ditolak. */
  headerError: string | null;
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v).trim();
}

/** Deteksi pemisah CSV sederhana: `;` (umum di Excel lokal ID) vs `,`. */
function detectDelimiter(firstLine: string): "," | ";" {
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semis = (firstLine.match(/;/g) ?? []).length;
  return semis > commas ? ";" : ",";
}

/**
 * Parser CSV mandiri (tanpa dependency): menangani field berkutip, koma/;
 * di dalam kutip, kutip ganda ter-escape (`""`), dan CRLF. BOM UTF-8 dibuang.
 */
export function parseCsv(input: string): string[][] {
  let text = input;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const nl = text.indexOf("\n");
  const delimiter = detectDelimiter(nl === -1 ? text : text.slice(0, nl));

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === delimiter) {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (c === "\r") {
      i += 1;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function mapHeaderIndexes(header: unknown[]): Partial<Record<ColKey, number>> {
  const idx: Partial<Record<ColKey, number>> = {};
  header.forEach((cell, i) => {
    const norm = cellToString(cell).toLowerCase();
    if (!norm) return;
    for (const key of Object.keys(HEADER_ALIASES) as ColKey[]) {
      if (idx[key] === undefined && HEADER_ALIASES[key].includes(norm)) {
        idx[key] = i;
      }
    }
  });
  return idx;
}

/**
 * Petakan baris mentah (baris 0 = header) → tamu valid + baris bermasalah.
 * Baris yang seluruh selnya kosong dilewati. `rowNumber` 1-based (header = 1).
 */
export function parseSheetRows(rows: unknown[][]): ImportParsed {
  const t = copy.dashboard.guestsImport;
  if (rows.length === 0) {
    return { valid: [], invalid: [], headerError: t.emptyFile };
  }

  const idx = mapHeaderIndexes(rows[0]);
  if (idx.name === undefined) {
    return { valid: [], invalid: [], headerError: t.missingNameColumn };
  }

  const valid: ImportParsed["valid"] = [];
  const invalid: ImportRowError[] = [];

  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r] ?? [];
    const at = (key: ColKey): string =>
      idx[key] === undefined ? "" : cellToString(cells[idx[key] as number]);

    const name = at("name");
    const phone = at("phone");
    const group = at("group");
    const pax = at("pax");
    const notes = at("notes");

    // Lewati baris kosong total (mis. baris pemisah di Excel).
    if (![name, phone, group, pax, notes].some((v) => v !== "")) continue;

    const rowNumber = r + 1;
    const parsed = guestSchema.safeParse({
      name,
      phone,
      groupLabel: group,
      // pax kosong → undefined agar default 2 berlaku (coerce "" jadi 0 → gagal).
      paxAllocated: pax === "" ? undefined : pax,
      notes,
    });

    if (parsed.success) {
      valid.push({
        rowNumber,
        input: { name, phone, groupLabel: group, paxAllocated: pax, notes },
      });
    } else {
      invalid.push({
        rowNumber,
        name: name || "—",
        error: parsed.error.issues[0]?.message ?? t.invalidRow,
      });
    }
  }

  return { valid, invalid, headerError: null };
}

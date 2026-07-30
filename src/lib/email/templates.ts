import { copy } from "@/lib/copy";
import { formatIdr } from "@/lib/format";

/**
 * Templat email transaksional (MURNI/teruji). Menghasilkan `subject` + `html` +
 * `text`. HTML memakai gaya inline + tabel (kompatibel klien email); semua nilai
 * dinamis DI-ESCAPE (cegah injeksi HTML dari nama/paket pengguna). Teks di
 * `lib/copy.ts` (`copy.email`). Tanpa dependency (rakit string, seperti `calendar.ts`).
 */

const C = copy.email;

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface ReceiptEmailData {
  name: string | null;
  packageName: string;
  amountIdr: number;
  orderCode: string;
  /** Sudah diformat (mis. "30 Januari 2027, 14.00 WIB") atau null. */
  paidAtLabel: string | null;
  activeUntilLabel: string | null;
  invitationUrl: string;
}

export interface ReminderEmailData {
  name: string | null;
  daysLeft: number;
  activeUntilLabel: string;
  invitationUrl: string;
  renewUrl: string;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape untuk konteks teks/atribut HTML. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

const BRAND = "#b8446a"; // rose (selaras merek)
const INK = "#1f2933";
const MUTED = "#6b7280";

/** Tombol "bulletproof" sederhana (anchor bergaya inline). URL sudah tepercaya (appUrl+slug). */
function button(url: string, label: string): string {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;background:${BRAND};color:#ffffff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px">${escapeHtml(label)}</a>`;
}

/** Kerangka HTML email: preheader tersembunyi + kartu terpusat + footer. */
function layout(preheader: string, heading: string, innerHtml: string): string {
  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;color:${INK};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="padding:28px 32px 8px"><div style="font-size:14px;font-weight:700;letter-spacing:.04em;color:${BRAND};text-transform:uppercase">${escapeHtml(C.brand)}</div></td></tr>
<tr><td style="padding:0 32px"><h1 style="margin:8px 0 16px;font-size:22px;line-height:1.3;color:${INK}">${escapeHtml(heading)}</h1></td></tr>
<tr><td style="padding:0 32px 28px;font-size:15px;line-height:1.6;color:${INK}">${innerHtml}</td></tr>
<tr><td style="padding:18px 32px;border-top:1px solid #eef0f2;font-size:12px;line-height:1.5;color:${MUTED}">${escapeHtml(C.footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

/** Baris label:nilai untuk ringkasan (kuitansi). */
function detailRows(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;background:#f9fafb;border-radius:10px">
${rows
  .map(
    ([k, v]) =>
      `<tr><td style="padding:8px 16px;font-size:13px;color:${MUTED}">${escapeHtml(k)}</td><td style="padding:8px 16px;font-size:14px;font-weight:600;text-align:right;color:${INK}">${escapeHtml(v)}</td></tr>`,
  )
  .join("\n")}
</table>`;
}

export function renderReceiptEmail(data: ReceiptEmailData): RenderedEmail {
  const r = C.receipt;
  const rows: [string, string][] = [
    [r.pkg, data.packageName],
    [r.total, formatIdr(data.amountIdr)],
    [r.order, data.orderCode],
  ];
  if (data.paidAtLabel) rows.push([r.paidAt, data.paidAtLabel]);
  if (data.activeUntilLabel) rows.push([r.activeUntil, data.activeUntilLabel]);

  const inner = `<p style="margin:0 0 16px">${escapeHtml(r.greeting(data.name))}</p>
<p style="margin:0 0 8px">${escapeHtml(r.intro)}</p>
${detailRows(rows)}
<p style="margin:0 0 24px">${button(data.invitationUrl, r.cta)}</p>
<p style="margin:0;font-size:13px;color:${MUTED}">${escapeHtml(r.outro)}</p>`;

  const text = [
    r.greeting(data.name),
    "",
    r.intro,
    "",
    `${r.pkg}: ${data.packageName}`,
    `${r.total}: ${formatIdr(data.amountIdr)}`,
    `${r.order}: ${data.orderCode}`,
    ...(data.paidAtLabel ? [`${r.paidAt}: ${data.paidAtLabel}`] : []),
    ...(data.activeUntilLabel
      ? [`${r.activeUntil}: ${data.activeUntilLabel}`]
      : []),
    "",
    `${r.cta}: ${data.invitationUrl}`,
    "",
    r.outro,
  ].join("\n");

  return {
    subject: r.subject,
    html: layout(r.preheader, r.heading, inner),
    text,
  };
}

export function renderExpiryReminderEmail(
  data: ReminderEmailData,
): RenderedEmail {
  const r = C.reminder;
  const inner = `<p style="margin:0 0 16px">${escapeHtml(r.greeting(data.name))}</p>
<p style="margin:0 0 20px">${escapeHtml(r.intro(data.activeUntilLabel, data.daysLeft))}</p>
<p style="margin:0 0 12px">${button(data.renewUrl, r.ctaRenew)}</p>
<p style="margin:0 0 24px;font-size:14px"><a href="${escapeHtml(data.invitationUrl)}" style="color:${BRAND}">${escapeHtml(r.ctaView)}</a></p>
<p style="margin:0;font-size:13px;color:${MUTED}">${escapeHtml(r.outro)}</p>`;

  const text = [
    r.greeting(data.name),
    "",
    r.intro(data.activeUntilLabel, data.daysLeft),
    "",
    `${r.ctaRenew}: ${data.renewUrl}`,
    `${r.ctaView}: ${data.invitationUrl}`,
    "",
    r.outro,
  ].join("\n");

  return {
    subject: r.subject(data.daysLeft),
    html: layout(r.preheader, r.heading, inner),
    text,
  };
}

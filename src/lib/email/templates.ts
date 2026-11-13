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

export interface MomenReceiptEmailData {
  name: string | null;
  packageName: string;
  amountIdr: number;
  orderCode: string;
  /** Sudah diformat (mis. "30 Januari 2027, 14.00 WIB") atau null. */
  paidAtLabel: string | null;
  /** Halaman kelola album (dashboard) — tempat cetak QR & unduh ZIP. */
  manageUrl: string;
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

/**
 * Kuitansi UPGRADE paket (AUDIT-2026-10-01 B3).
 *
 * Bentuknya sama dengan kuitansi aktivasi, teksnya TIDAK: `copy.email.receipt`
 * mengaku "undangan Anda kini aktif" dan membuat barisnya terbaca seperti
 * pembelian masa aktif. Pada upgrade keduanya salah — undangan sudah aktif
 * sebelum ini, dan yang dibayar hanya selisih harga. `activeUntilLabel` tetap
 * dicantumkan karena nilainya memang tak berubah; justru itu yang perlu dilihat.
 */
export function renderUpgradeReceiptEmail(
  data: ReceiptEmailData,
): RenderedEmail {
  const r = C.upgradeReceipt;
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

export function renderMomenReceiptEmail(
  data: MomenReceiptEmailData,
): RenderedEmail {
  const r = C.momenReceipt;
  const rows: [string, string][] = [
    [r.pkg, data.packageName],
    [r.total, formatIdr(data.amountIdr)],
    [r.order, data.orderCode],
  ];
  if (data.paidAtLabel) rows.push([r.paidAt, data.paidAtLabel]);

  const inner = `<p style="margin:0 0 16px">${escapeHtml(r.greeting(data.name))}</p>
<p style="margin:0 0 8px">${escapeHtml(r.intro)}</p>
${detailRows(rows)}
<p style="margin:0 0 24px">${button(data.manageUrl, r.cta)}</p>
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
    "",
    `${r.cta}: ${data.manageUrl}`,
    "",
    r.outro,
  ].join("\n");

  return {
    subject: r.subject,
    html: layout(r.preheader, r.heading, inner),
    text,
  };
}

export interface PurgeWarningEmailData {
  name: string | null;
  slug: string;
  /** Sudah diformat, mis. "3 April 2027". */
  purgeDateLabel: string;
  daysLeft: number;
  /** Tahap terakhir (~H-7): urutan tombol dibalik & outro berubah. */
  final: boolean;
  renewUrl: string;
  dashboardUrl: string;
}

/**
 * Peringatan pra-purge (AUDIT-2026-10-01 B7).
 *
 * SATU templat untuk kedua tahap: "H-30" dan "H-7" adalah nama TAHAP, bukan isi
 * email — angkanya dihitung per baris dari tanggal purge yang sebenarnya, jadi
 * baris yang masuk antrean terlambat tak pernah mengaku "30 hari" saat sisanya
 * tiga. `final` mengubah subjek, urutan tombol, dan outro: pada H-30
 * memperpanjang masih wajar dipikirkan; pada H-7 menyelamatkan data jauh lebih
 * realistis daripada memutuskan membeli.
 */
export function renderPurgeWarningEmail(
  data: PurgeWarningEmailData,
): RenderedEmail {
  const r = C.purgeWarning;
  const utama = data.final
    ? button(data.dashboardUrl, r.ctaUnduh)
    : button(data.renewUrl, r.ctaPerpanjang);
  const kedua = data.final
    ? { url: data.renewUrl, label: r.ctaPerpanjang }
    : { url: data.dashboardUrl, label: r.ctaUnduh };
  const outro = data.final ? r.outroFinal : r.outroPertama;

  const inner = `<p style="margin:0 0 16px">${escapeHtml(r.greeting(data.name))}</p>
<p style="margin:0 0 16px">${escapeHtml(r.intro(data.slug, data.purgeDateLabel, data.daysLeft))}</p>
<p style="margin:0 0 8px;font-size:14px">${escapeHtml(r.yangHilang)}</p>
<p style="margin:0 0 20px;font-size:14px;color:${MUTED}">${escapeHtml(r.yangTetap)}</p>
<p style="margin:0 0 12px">${utama}</p>
<p style="margin:0 0 20px;font-size:14px"><a href="${escapeHtml(kedua.url)}" style="color:${BRAND}">${escapeHtml(kedua.label)}</a></p>
<p style="margin:0 0 20px;font-size:13px;color:${MUTED}">${escapeHtml(r.unduhHint)}</p>
<p style="margin:0;font-size:13px;color:${MUTED}">${escapeHtml(outro)}</p>`;

  const text = [
    r.greeting(data.name),
    "",
    r.intro(data.slug, data.purgeDateLabel, data.daysLeft),
    "",
    r.yangHilang,
    r.yangTetap,
    "",
    `${r.ctaPerpanjang}: ${data.renewUrl}`,
    `${r.ctaUnduh}: ${data.dashboardUrl}`,
    "",
    r.unduhHint,
    "",
    outro,
  ].join("\n");

  return {
    subject: r.subject(data.daysLeft, data.slug),
    html: layout(r.preheader(data.purgeDateLabel), r.heading, inner),
    text,
  };
}

export interface ExpiredNoticeEmailData {
  name: string | null;
  slug: string;
  /** Sudah diformat, mis. "3 April 2027". */
  expiredAtLabel: string;
  /** Tanggal purge, sudah diformat — SATU sumber dgn `renderPurgeWarningEmail`. */
  purgeDateLabel: string;
  renewUrl: string;
  dashboardUrl: string;
}

/**
 * Notis masa aktif berakhir (AUDIT-2026-10-01 B7).
 *
 * Satu-satunya email yang menyebut apa yang DILIHAT TAMU sekarang — itu fakta
 * yang paling mengagetkan bagi pemilik, dan selama ini ia harus menemukannya
 * sendiri (atau dikabari tamunya). Kebalikan dari `renderPurgeWarningEmail`:
 * tekanannya pada apa yang masih bisa dipulihkan, bukan pada tenggat.
 */
export function renderExpiredNoticeEmail(
  data: ExpiredNoticeEmailData,
): RenderedEmail {
  const r = C.expired;
  const inner = `<p style="margin:0 0 16px">${escapeHtml(r.greeting(data.name))}</p>
<p style="margin:0 0 16px">${escapeHtml(r.intro(data.slug, data.expiredAtLabel))}</p>
<p style="margin:0 0 20px;font-size:14px;color:${MUTED}">${escapeHtml(r.dataAman(data.purgeDateLabel))}</p>
<p style="margin:0 0 12px">${button(data.renewUrl, r.ctaRenew)}</p>
<p style="margin:0 0 24px;font-size:14px"><a href="${escapeHtml(data.dashboardUrl)}" style="color:${BRAND}">${escapeHtml(r.ctaDashboard)}</a></p>
<p style="margin:0;font-size:13px;color:${MUTED}">${escapeHtml(r.outro)}</p>`;

  const text = [
    r.greeting(data.name),
    "",
    r.intro(data.slug, data.expiredAtLabel),
    "",
    r.dataAman(data.purgeDateLabel),
    "",
    `${r.ctaRenew}: ${data.renewUrl}`,
    `${r.ctaDashboard}: ${data.dashboardUrl}`,
    "",
    r.outro,
  ].join("\n");

  return {
    subject: r.subject(data.slug),
    html: layout(r.preheader, r.heading, inner),
    text,
  };
}

export interface SuspendedEmailData {
  name: string | null;
  slug: string;
  /** Alasan yang DITULIS UNTUK PELANGGAN, atau null bila admin tak menulisnya. */
  publicReason: string | null;
  supportEmail: string;
  dashboardUrl: string;
}

/**
 * Pemberitahuan penangguhan (AUDIT-2026-10-01 B7, DECISIONS #68).
 *
 * `publicReason` sengaja berasal dari kolom terpisah, bukan dari catatan internal
 * yang masuk `admin_logs`: catatan itu ditulis admin untuk admin dan wajar memuat
 * nama pelapor atau nomor pihak ketiga. Jalur banding dicetak baik alasannya ada
 * maupun tidak — penangguhan tanpa cara membantahnya bukan moderasi.
 */
export function renderSuspendedEmail(data: SuspendedEmailData): RenderedEmail {
  const r = C.suspended;
  const alasan = data.publicReason?.trim() || r.alasanKosong;
  const inner = `<p style="margin:0 0 16px">${escapeHtml(r.greeting(data.name))}</p>
<p style="margin:0 0 20px">${escapeHtml(r.intro(data.slug))}</p>
<p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${MUTED}">${escapeHtml(r.alasanJudul)}</p>
<p style="margin:0 0 20px;padding:12px 16px;background:#f9fafb;border-radius:10px;font-size:14px">${escapeHtml(alasan)}</p>
<p style="margin:0 0 20px;font-size:14px;color:${MUTED}">${escapeHtml(r.dataAman)}</p>
<p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${MUTED}">${escapeHtml(r.bandingJudul)}</p>
<p style="margin:0 0 20px;font-size:14px">${escapeHtml(r.banding(data.supportEmail))}</p>
<p style="margin:0">${button(data.dashboardUrl, r.ctaDashboard)}</p>`;

  const text = [
    r.greeting(data.name),
    "",
    r.intro(data.slug),
    "",
    `${r.alasanJudul}: ${alasan}`,
    "",
    r.dataAman,
    "",
    r.bandingJudul,
    r.banding(data.supportEmail),
    "",
    `${r.ctaDashboard}: ${data.dashboardUrl}`,
  ].join("\n");

  return {
    subject: r.subject(data.slug),
    html: layout(r.preheader, r.heading, inner),
    text,
  };
}

export interface MusicRemovedEmailData {
  name: string | null;
  slug: string;
  /** Alasan yang DITULIS UNTUK PELANGGAN, atau null bila admin tak menulisnya. */
  publicReason: string | null;
  supportEmail: string;
  dashboardUrl: string;
}

/**
 * Pemberitahuan takedown musik unggahan (DECISIONS #121). Saudara ringan
 * `renderSuspendedEmail`: undangannya tetap tayang, yang hilang hanya musik
 * unggahannya dan hak unggahnya (dikunci). Aturan dua kolomnya sama — alasan
 * dari kolom publik, catatan internal (yang bisa memuat identitas pelapor) tak
 * pernah sampai ke sini — dan jalur sanggahan dicetak baik alasannya ada
 * maupun tidak.
 */
export function renderMusicRemovedEmail(
  data: MusicRemovedEmailData,
): RenderedEmail {
  const r = C.musicRemoved;
  const alasan = data.publicReason?.trim() || r.alasanKosong;
  const inner = `<p style="margin:0 0 16px">${escapeHtml(r.greeting(data.name))}</p>
<p style="margin:0 0 20px">${escapeHtml(r.intro(data.slug))}</p>
<p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${MUTED}">${escapeHtml(r.alasanJudul)}</p>
<p style="margin:0 0 20px;padding:12px 16px;background:#f9fafb;border-radius:10px;font-size:14px">${escapeHtml(alasan)}</p>
<p style="margin:0 0 20px;font-size:14px;color:${MUTED}">${escapeHtml(r.kunci)}</p>
<p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${MUTED}">${escapeHtml(r.sanggahJudul)}</p>
<p style="margin:0 0 20px;font-size:14px">${escapeHtml(r.sanggah(data.supportEmail))}</p>
<p style="margin:0">${button(data.dashboardUrl, r.ctaDashboard)}</p>`;

  const text = [
    r.greeting(data.name),
    "",
    r.intro(data.slug),
    "",
    `${r.alasanJudul}: ${alasan}`,
    "",
    r.kunci,
    "",
    r.sanggahJudul,
    r.sanggah(data.supportEmail),
    "",
    `${r.ctaDashboard}: ${data.dashboardUrl}`,
  ].join("\n");

  return {
    subject: r.subject(data.slug),
    html: layout(r.preheader, r.heading, inner),
    text,
  };
}

export interface ReinstatedEmailData {
  name: string | null;
  slug: string;
  /** `true` hanya bila statusnya pulih menjadi `active`. */
  tampilKembali: boolean;
  invitationUrl: string;
  renewUrl: string;
}

/**
 * Pencabutan penangguhan (B7). Pasangan wajib dari `renderSuspendedEmail`:
 * pelanggan yang bandingnya diterima harus diberi tahu, bukan dibiarkan menebak.
 *
 * `tampilKembali` bukan hiasan — reinstate memulihkan status dari `active_until`,
 * jadi undangan yang masa aktifnya sudah lewat menjadi `expired` dan BELUM tampil.
 */
export function renderReinstatedEmail(
  data: ReinstatedEmailData,
): RenderedEmail {
  const r = C.reinstated;
  const pokok = data.tampilKembali
    ? r.tampil(data.slug)
    : r.belumTampil(data.slug);
  const cta = data.tampilKembali
    ? { url: data.invitationUrl, label: r.ctaView }
    : { url: data.renewUrl, label: r.ctaRenew };

  const inner = `<p style="margin:0 0 16px">${escapeHtml(r.greeting(data.name))}</p>
<p style="margin:0 0 20px">${escapeHtml(pokok)}</p>
<p style="margin:0 0 20px">${button(cta.url, cta.label)}</p>
<p style="margin:0;font-size:13px;color:${MUTED}">${escapeHtml(r.outro)}</p>`;

  const text = [
    r.greeting(data.name),
    "",
    pokok,
    "",
    `${cta.label}: ${cta.url}`,
    "",
    r.outro,
  ].join("\n");

  return {
    subject: r.subject(data.slug),
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

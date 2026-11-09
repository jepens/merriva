import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { formatEventDateTime } from "@/lib/datetime";
import { formatIdr } from "@/lib/format";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";
import { dataOrThrow } from "@/lib/supabase/result";
import { getAdminMetrics } from "@/server/admin/metrics";
import { fetchCronStatus, type CronHealth } from "@/server/cron/status";
import { requireAdmin } from "@/server/guards/auth";

export const metadata: Metadata = { title: copy.admin.overview.title };

const c = copy.admin.overview;

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 py-5">
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

/** Ringkasan admin (SPEC §4.9): metrik utama + aktivitas admin terakhir. */
/**
 * Angka yang BUKAN sekadar informasi: nilainya > 0 berarti ada yang perlu
 * diperiksa manusia, jadi ditandai.
 *
 * Sisanya (dipindai, diaktifkan, terkirim) justru sehat bila besar, dan
 * menandainya akan membuat panel tampak merah setiap hari sampai orang berhenti
 * mempercayainya — kegagalan yang sama dengan ambang "basi" di `status.ts`.
 */
const STAT_PERHATIAN = new Set([
  "failed",
  "notifyFailed",
  "warnFailed",
  "cancelFailed",
  "storageFailed",
  "truncated",
  "notifyTruncated",
  "budgetHabis",
  "tanpaTxn",
  "noOwner",
  "notifyNoOwner",
  "warnNoOwner",
  "backstop",
  "musicFailed",
  "musicTruncated",
  "musicSweepFailed",
]);

const cronBadge: Record<CronHealth, string> = {
  ok: "bg-emerald-100 text-emerald-800",
  gagal: "bg-red-100 text-red-800",
  basi: "bg-amber-100 text-amber-800",
  "belum-pernah": "bg-muted text-muted-foreground",
};

export default async function AdminOverviewPage() {
  await requireAdmin(); // defense-in-depth di atas guard layout (page pakai service_role)
  const metrics = await getAdminMetrics();

  const admin = createSupabaseAdminClient();
  // `dataOrThrow`, bukan `data ?? []`: panel yang dipakai merekonsiliasi uang
  // tak boleh menjawab "tidak ada aktivitas" saat DB berkedip
  // (AUDIT-2026-10-01). Mendarat di `(admin)/admin/error.tsx`.
  const logs = dataOrThrow(
    await admin
      .from("admin_logs")
      .select("id, action, target_type, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    "admin_logs (beranda admin)",
  );

  const cron = await fetchCronStatus(admin);

  const conversionPct = `${(metrics.conversionRate * 100).toFixed(1)}%`;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{c.title}</h1>
        <p className="text-muted-foreground text-sm">{c.subtitle}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric
          label={c.newInvitations24h}
          value={String(metrics.newInvitations24h)}
        />
        <Metric
          label={c.newInvitations7d}
          value={String(metrics.newInvitations7d)}
        />
        <Metric
          label={c.totalInvitations}
          value={String(metrics.totalInvitations)}
        />
        <Metric
          label={c.activeInvitations}
          value={String(metrics.activeInvitations)}
        />
        <Metric
          label={c.conversion}
          value={conversionPct}
          hint={c.convertedOf(
            metrics.convertedInvitations,
            metrics.totalInvitations,
          )}
        />
        <Metric
          label={c.revenueThisMonth}
          value={formatIdr(metrics.revenueThisMonthIdr)}
          hint={c.paidOrdersThisMonth(metrics.paidOrdersThisMonth)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{c.cron.heading}</CardTitle>
          <p className="text-muted-foreground text-sm">{c.cron.subtitle}</p>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {cron.map((j) => (
              <li key={j.name} className="space-y-1 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs">{j.name}</span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      cronBadge[j.health],
                    )}
                  >
                    {c.cron.health[j.health]}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {c.cron.lastRun}:{" "}
                  {j.lastRunAt
                    ? (formatEventDateTime(j.lastRunAt, "Asia/Jakarta")?.full ??
                      j.lastRunAt)
                    : c.cron.never}
                  {j.runs > 0 ? (
                    <> · {c.cron.failuresOf(j.failures, j.runs)}</>
                  ) : null}
                </p>
                {Object.keys(j.stats).length > 0 ? (
                  <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                    {Object.entries(j.stats)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([k, v]) => (
                        <span
                          key={k}
                          className={cn(
                            v > 0 && STAT_PERHATIAN.has(k)
                              ? "font-medium text-amber-700"
                              : v === 0
                                ? "opacity-50"
                                : undefined,
                          )}
                        >
                          {/* Kunci tanpa label tetap TAMPIL apa adanya — angka
                              yang hilang dari panel karena lupa diberi label
                              adalah kegagalan yang panel ini cegah. */}
                          {c.cron.statLabel[k] ?? k}{" "}
                          <span className="tabular-nums">{v}</span>
                        </span>
                      ))}
                  </div>
                ) : null}
                {j.health === "basi" || j.health === "belum-pernah" ? (
                  <p className="text-xs text-amber-700">{c.cron.staleHint}</p>
                ) : null}
                {j.lastError ? (
                  <p className="text-destructive font-mono text-[11px] break-all">
                    {j.lastError}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{c.recentActivity}</CardTitle>
        </CardHeader>
        <CardContent>
          {logs && logs.length > 0 ? (
            <ul className="divide-y text-sm">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="flex items-center justify-between gap-4 py-2"
                >
                  <span className="font-mono text-xs">
                    {log.action}
                    {log.target_type ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {log.target_type}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {formatEventDateTime(log.created_at, "Asia/Jakarta")
                      ?.full ?? log.created_at}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">{c.noActivity}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

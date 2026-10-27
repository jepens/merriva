import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { SUSPEND_REASON_LIMIT } from "@/lib/validation/admin";
import { wibDate } from "@/lib/admin/display";
import { formatIdr } from "@/lib/format";
import { isUuid } from "@/lib/id";
import { isDraftSlug } from "@/lib/slug";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/env";
import { requireAdmin } from "@/server/guards/auth";
import {
  adminActivateInvitationAction,
  adminChangeOwnerAction,
  adminExtendInvitationAction,
  adminReinstateInvitationAction,
  adminSuspendInvitationAction,
} from "@/server/actions/admin";
import type { InvitationStatus, OrderStatus } from "@/types";

export const metadata: Metadata = { title: copy.admin.detail.title };

const d = copy.admin.detail;
const OK_MSG = new Set([
  "activate_ok",
  "extend_ok",
  "suspend_ok",
  "reinstate_ok",
  "owner_ok",
]);
const PAYABLE = new Set<InvitationStatus>([
  "draft",
  "pending_payment",
  "expired",
]);

const fieldClass =
  "border-input bg-background h-9 rounded-md border px-3 text-sm";

export default async function AdminInvitationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  await requireAdmin(); // defense-in-depth (page pakai service_role)
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { msg } = await searchParams;

  const admin = createSupabaseAdminClient();
  const { data: inv } = await admin
    .from("invitations")
    .select(
      "id, slug, category, status, active_until, created_at, published_at, user_id, package_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (!inv) notFound();

  // Pemilik bisa TAK ADA: akun yang dihapus meninggalkan kerangka undangan
  // ber-`user_id` NULL demi pembukuan (A6). Memanggil `getUserById(null)` dan
  // `.eq("id", null)` di sini akan memecahkan halaman — kemungkinan yang
  // tersembunyi dari compiler selama tipe DB menyatakan kolomnya non-null.
  const ownerId = inv.user_id;
  const [{ data: orders }, { data: packages }] = await Promise.all([
    admin
      .from("orders")
      .select(
        "order_code, status, amount_idr, payment_method, created_at, paid_at",
      )
      .eq("invitation_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("packages")
      .select("code, name, price_idr")
      .eq("is_active", true)
      .eq("kind", "invitation") // aktivasi manual hanya paket undangan
      .order("price_idr", { ascending: true }),
  ]);

  const [profileRes, ownerRes] = ownerId
    ? await Promise.all([
        admin
          .from("profiles")
          .select("full_name, phone")
          .eq("id", ownerId)
          .maybeSingle(),
        admin.auth.admin.getUserById(ownerId),
      ])
    : [null, null];
  const profile = profileRes?.data ?? null;
  const email = ownerId
    ? (ownerRes?.data?.user?.email ?? copy.admin.common.dash)
    : d.ownerDeleted;
  const status = inv.status as InvitationStatus;
  const draftSlug = isDraftSlug(inv.slug);
  const msgText =
    msg && msg in copy.admin.msg
      ? copy.admin.msg[msg as keyof typeof copy.admin.msg]
      : null;

  return (
    <div className="space-y-5">
      <Link
        href="/admin/undangan"
        className="text-muted-foreground text-sm hover:underline"
      >
        {copy.admin.common.back}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-mono text-lg font-semibold tracking-tight">
          {inv.slug}
        </h1>
        <span className="bg-muted rounded-md px-2 py-1 text-xs font-medium">
          {copy.admin.statusLabel[status]}
        </span>
      </div>

      {msgText ? (
        <div
          className={`rounded-md border px-4 py-2 text-sm ${
            msg && OK_MSG.has(msg)
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-amber-300 bg-amber-50 text-amber-800"
          }`}
        >
          {msgText}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{d.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row
              label={d.category}
              value={copy.admin.categoryLabel[inv.category]}
            />
            <Row label={d.activeUntil} value={wibDate(inv.active_until)} />
            <Row label={d.created} value={wibDate(inv.created_at)} />
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{d.publicUrl}</span>
              {draftSlug ? (
                <span className="text-muted-foreground">
                  {copy.admin.common.dash}
                </span>
              ) : (
                <a
                  href={`${appUrl}/${inv.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate hover:underline"
                >
                  /{inv.slug}
                </a>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{d.sectionOwner}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row
              label={d.ownerName}
              value={profile?.full_name ?? copy.admin.common.dash}
            />
            <Row label={d.ownerEmail} value={email} />
            <Row
              label={d.ownerPhone}
              value={profile?.phone ?? copy.admin.common.dash}
            />
            <Row label={d.ownerId} value={ownerId ?? d.ownerDeleted} mono />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{d.sectionOrders}</CardTitle>
        </CardHeader>
        <CardContent>
          {orders && orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground text-left">
                  <tr>
                    <th className="py-1 pr-4 font-medium">
                      {copy.admin.orders.colCode}
                    </th>
                    <th className="py-1 pr-4 font-medium">
                      {copy.admin.orders.colStatus}
                    </th>
                    <th className="py-1 pr-4 font-medium">
                      {copy.admin.orders.colAmount}
                    </th>
                    <th className="py-1 pr-4 font-medium">
                      {copy.admin.orders.colMethod}
                    </th>
                    <th className="py-1 pr-4 font-medium">
                      {copy.admin.orders.colPaidAt}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((o) => (
                    <tr key={o.order_code}>
                      <td className="py-1 pr-4 font-mono">{o.order_code}</td>
                      <td className="py-1 pr-4">
                        {copy.admin.orderStatusLabel[o.status as OrderStatus]}
                      </td>
                      <td className="py-1 pr-4">{formatIdr(o.amount_idr)}</td>
                      <td className="py-1 pr-4">
                        {o.payment_method ?? copy.admin.common.dash}
                      </td>
                      <td className="py-1 pr-4">{wibDate(o.paid_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{d.noOrders}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{d.sectionActions}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          {PAYABLE.has(status) ? (
            // Katalog kosong → `<select required>` tanpa `<option>`: dropdown
            // buntu dan tombol yang menolak terkirim, tanpa sebab yang terbaca.
            // Satu-satunya jalan keluar manual dari order macet tak boleh
            // tampak rusak justru saat dibutuhkan.
            (packages ?? []).length > 0 ? (
              <form
                action={adminActivateInvitationAction.bind(null, id)}
                className="space-y-2"
              >
                <p className="text-sm font-medium">{d.activateTitle}</p>
                <p className="text-muted-foreground text-xs">
                  {d.activateHint}
                </p>
                <div className="flex gap-2">
                  <select name="packageCode" className={fieldClass} required>
                    {(packages ?? []).map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name} — {formatIdr(p.price_idr)}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" size="sm">
                    {d.activateCta}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">{d.activateTitle}</p>
                <p className="text-muted-foreground text-xs">
                  {copy.checkout.packageUnavailable}
                </p>
              </div>
            )
          ) : null}

          {(status === "active" || status === "expired") && (
            <form
              action={adminExtendInvitationAction.bind(null, id)}
              className="space-y-2"
            >
              <p className="text-sm font-medium">{d.extendTitle}</p>
              <div className="flex gap-2">
                <input
                  name="months"
                  type="number"
                  min={1}
                  max={24}
                  defaultValue={6}
                  className={`${fieldClass} w-24`}
                  aria-label={d.extendMonths}
                  required
                />
                <Button type="submit" size="sm">
                  {d.extendCta}
                </Button>
              </div>
            </form>
          )}

          {status !== "suspended" ? (
            <form
              action={adminSuspendInvitationAction.bind(null, id)}
              className="space-y-2"
            >
              <p className="text-sm font-medium">{d.suspendTitle}</p>
              {/*
                `maxLength` memakai angka yang SAMA dengan skema server: tanpa itu
                alasan kelewat panjang hanya berbuah redirect `suspend_invalid`
                yang tak menyebut apa yang salah, dan admin kehilangan teks yang
                sudah diketiknya.

                Dua kolom, sengaja terpisah: `reason` masuk audit log internal,
                `publicReason` dikirim ke pemilik lewat email (DECISIONS #68).
                Urutannya internal dulu — itu yang wajib diisi — dan labelnya
                menyebut tujuan masing-masing, bukan hanya "Alasan".
              */}
              <input
                name="reason"
                placeholder={d.suspendReason}
                className={`${fieldClass} w-full`}
                maxLength={SUSPEND_REASON_LIMIT}
                required
              />
              <input
                name="publicReason"
                placeholder={d.suspendPublicReason}
                className={`${fieldClass} w-full`}
                maxLength={SUSPEND_REASON_LIMIT}
              />
              <p className="text-muted-foreground text-xs">
                {d.suspendPublicHint}
              </p>
              <Button type="submit" size="sm" variant="destructive">
                {d.suspendCta}
              </Button>
            </form>
          ) : (
            <form
              action={adminReinstateInvitationAction.bind(null, id)}
              className="space-y-2"
            >
              <p className="text-sm font-medium">{d.reinstateTitle}</p>
              <p className="text-muted-foreground text-xs">{d.reinstateHint}</p>
              <Button type="submit" size="sm">
                {d.reinstateCta}
              </Button>
            </form>
          )}

          <form
            action={adminChangeOwnerAction.bind(null, id)}
            className="space-y-2"
          >
            <p className="text-sm font-medium">{d.ownerTitle}</p>
            <p className="text-muted-foreground text-xs">{d.ownerHint}</p>
            <div className="flex gap-2">
              <input
                name="newUserId"
                placeholder={d.ownerNewId}
                className={`${fieldClass} flex-1 font-mono`}
                required
              />
              <Button type="submit" size="sm" variant="outline">
                {d.ownerCta}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={mono ? "font-mono text-xs" : "text-right"}>{value}</span>
    </div>
  );
}

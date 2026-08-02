"use client";

import { Lock, RotateCcw, Sparkles } from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import { buttonVariants } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { appearanceStyle } from "@/lib/customizer/appearance-style";
import { resolveAppearance } from "@/lib/customizer/resolve";
import {
  defaultCustomSettings,
  type CustomSettings,
  type ThemeOptions,
} from "@/lib/customizer/theme-options";
import { cn } from "@/lib/utils";
import {
  resetInvitationAppearanceAction,
  updateInvitationAppearanceAction,
} from "@/server/actions/appearance";

import { SectionOrderList, type SectionEntry } from "./appearance-sections";

const L = copy.appearance;
type Tab = "color" | "font" | "sections" | "style";

/**
 * Editor kustomisasi (Fase G / CUSTOMIZER-SPEC §7). Preview = tema asli dalam
 * iframe `/preview/[id]?embed=1`; perubahan diterapkan INSTAN via DOM same-origin
 * (CSS var + data-atribut + urutan section) — memakai `resolveAppearance` yang
 * SAMA dengan render server → editor ≡ halaman publik. Simpan = Server Action +
 * revalidatePath. Bottom sheet mobile-first (peek/expand), tab Warna/Font/Bagian/
 * Gaya, reorder drag + panah, badge Premium untuk opsi terkunci.
 */
export function AppearanceEditor({
  invitationId,
  previewSrc,
  backHref,
  options,
  premium,
  initialCustom,
}: {
  invitationId: string;
  previewSrc: string;
  backHref: string;
  options: ThemeOptions;
  premium: boolean;
  initialCustom: CustomSettings;
}) {
  const [custom, setCustom] = useState<CustomSettings>(initialCustom);
  const [saved, setSaved] = useState<CustomSettings>(initialCustom);
  const [tab, setTab] = useState<Tab>("color");
  const [expanded, setExpanded] = useState(true);
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const frameRef = useRef<HTMLIFrameElement>(null);
  const loadedRef = useRef(false);

  const dirty = JSON.stringify(custom) !== JSON.stringify(saved);

  // Tab kontekstual: Font hanya bila ada >1 pasangan; Gaya bila ada gaya/motion/
  // grain. Warna & Bagian selalu ada. Tema yang belum mendeklarasikan aksis
  // tertentu tak menampilkan tab-nya (tak ada kontrol kosong).
  const hasStyleTab =
    Object.keys(options.styles).length > 0 ||
    options.supports.motion ||
    options.supports.grain;
  const tabs: [Tab, string][] = [["color", L.tabs.color]];
  if (options.fontPairs.length > 1) tabs.push(["font", L.tabs.font]);
  tabs.push(["sections", L.tabs.sections]);
  if (hasStyleTab) tabs.push(["style", L.tabs.style]);

  // Terapkan token ke dokumen iframe (same-origin) — tanpa reload. Memakai
  // resolver + peta `preview.vars` yang SAMA dgn render server → identik dgn
  // hasil simpan, untuk SEMUA tema (bukan hanya eternal-rose). Selektor DOM
  // diturunkan dari `preview.root` mengikuti konvensi `<root>-stage/-grain/-open`.
  const p = options.preview;
  const stageSel = p.stage ?? `${p.root}-stage`;
  const grainSel = p.grain === false ? null : (p.grain ?? `${p.root}-grain`);
  const openSel = p.open ?? `${p.root}-open`;

  const applyToFrame = (c: CustomSettings) => {
    const doc = frameRef.current?.contentDocument;
    const root = doc?.querySelector<HTMLElement>(`.${p.root}`);
    if (!root) return;
    const r = resolveAppearance(options, c);
    for (const [name, value] of Object.entries(appearanceStyle(p.vars, r))) {
      if (value != null) root.style.setProperty(name, String(value));
    }
    if (r.styles.gallery) root.setAttribute("data-gallery", r.styles.gallery);
    root.setAttribute("data-motion", r.motion);
    if (grainSel) {
      const grain = root.querySelector<HTMLElement>(`.${grainSel}`);
      if (grain) grain.style.display = r.grain ? "" : "none";
    }

    const stage = root.querySelector(`.${stageSel}`);
    if (stage) {
      const wrappers = new Map<string, HTMLElement>();
      stage
        .querySelectorAll<HTMLElement>(":scope > [data-section-id]")
        .forEach((n) => {
          const id = n.getAttribute("data-section-id");
          if (id) wrappers.set(id, n);
        });
      // Jangkar = elemen tepat sebelum section pertama (grain/marquee/progress),
      // agnostik-tema. Footer (tanpa data-section-id) tetap di akhir.
      const first = stage.querySelector<HTMLElement>(
        ":scope > [data-section-id]",
      );
      let anchor: Element | null = first?.previousElementSibling ?? null;
      for (const s of r.sections) {
        const w = wrappers.get(s.id);
        if (!w) continue;
        w.style.display = s.visible ? "contents" : "none";
        if (anchor) anchor.after(w);
        else stage.prepend(w);
        anchor = w;
      }
    }
  };

  const onFrameLoad = () => {
    loadedRef.current = true;
    // Buka sampul agar konten terlihat saat mengedit.
    frameRef.current?.contentDocument
      ?.querySelector<HTMLElement>(`.${openSel}`)
      ?.click();
    // Tunggu satu frame agar DOM konten siap, lalu terapkan.
    window.requestAnimationFrame(() => applyToFrame(custom));
  };

  useEffect(() => {
    if (loadedRef.current) applyToFrame(custom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [custom]);

  const patch = (p: Partial<CustomSettings>) =>
    setCustom((c) => ({ ...c, ...p }));

  const save = () =>
    startTransition(async () => {
      setFlash(null);
      const res = await updateInvitationAppearanceAction(invitationId, custom);
      if (res.status === "success") {
        setSaved(custom);
        setFlash({ ok: true, text: L.saved });
      } else {
        setFlash({
          ok: false,
          text: (res.status === "error" && res.message) || L.error,
        });
      }
    });

  const reset = () => {
    if (!window.confirm(L.resetConfirm)) return;
    startTransition(async () => {
      const res = await resetInvitationAppearanceAction(invitationId);
      if (res.status === "success") {
        const d = defaultCustomSettings(options);
        setCustom(d);
        setSaved(d);
        setFlash({ ok: true, text: L.saved });
      } else {
        setFlash({
          ok: false,
          text: (res.status === "error" && res.message) || L.error,
        });
      }
    });
  };

  return (
    <div className="bg-muted fixed inset-0 z-50 flex flex-col">
      {/* Bilah atas */}
      <div className="bg-background flex items-center justify-between gap-2 border-b px-2 py-2">
        <Link
          href={backHref}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          {L.back}
        </Link>
        <span className="truncate text-sm font-semibold">{L.title}</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={reset}
            disabled={pending}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "gap-1.5",
            )}
          >
            <RotateCcw className="size-3.5" />
            <span className="hidden sm:inline">{L.reset}</span>
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending || !dirty}
            className={buttonVariants({ size: "sm" })}
          >
            {pending ? L.saving : L.save}
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="relative flex-1 overflow-hidden">
        <iframe
          ref={frameRef}
          src={previewSrc}
          onLoad={onFrameLoad}
          title={copy.preview.frameTitle}
          className="h-full w-full border-0 bg-white"
        />
        {(dirty || flash) && (
          <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center px-3">
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium shadow",
                flash
                  ? flash.ok
                    ? "bg-emerald-600 text-white"
                    : "bg-destructive text-white"
                  : "bg-foreground/85 text-background",
              )}
            >
              {flash ? flash.text : L.dirty}
            </span>
          </div>
        )}
      </div>

      {/* Bottom sheet */}
      <div
        className={cn(
          "bg-background flex shrink-0 flex-col rounded-t-2xl border-t shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.3)] transition-[height] duration-200",
          expanded ? "h-[48vh]" : "h-[104px]",
        )}
      >
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? "Ciutkan" : "Perluas"}
          className="flex h-6 items-center justify-center"
        >
          <span className="bg-muted-foreground/30 h-1 w-10 rounded-full" />
        </button>

        {/* Tab (Font/Gaya hanya muncul bila tema menyediakannya) */}
        <div className="flex gap-1 px-3 pb-2">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTab(key);
                setExpanded(true);
              }}
              className={cn(
                "h-11 flex-1 rounded-lg text-sm font-medium transition-colors",
                tab === key
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {tab === "color" && (
            <ColorTab
              options={options}
              custom={custom}
              premium={premium}
              patch={patch}
            />
          )}
          {tab === "font" && (
            <FontTab
              options={options}
              custom={custom}
              premium={premium}
              patch={patch}
            />
          )}
          {tab === "sections" && (
            <div className="space-y-2 pt-1">
              <p className="text-muted-foreground text-xs">{L.sectionsHint}</p>
              <SectionOrderList
                options={options}
                sections={custom.sections}
                onChange={(next: SectionEntry[]) => patch({ sections: next })}
              />
            </div>
          )}
          {tab === "style" && (
            <StyleTab
              options={options}
              custom={custom}
              premium={premium}
              patch={patch}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- sub-komponen ------ */

function PremiumBadge() {
  return (
    <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
      <Sparkles className="size-2.5" /> {L.premiumBadge}
    </span>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
      {children}
    </p>
  );
}

interface TabProps {
  options: ThemeOptions;
  custom: CustomSettings;
  premium: boolean;
  patch: (p: Partial<CustomSettings>) => void;
}

function ColorTab({ options, custom, premium, patch }: TabProps) {
  const activeVariant =
    options.variants.find((v) => v.id === custom.variant) ??
    options.variants[0];
  const accentEnabled = custom.accent !== null;
  return (
    <div className="space-y-4 pt-1">
      <div>
        <FieldLabel>{L.colorVariant}</FieldLabel>
        <div className="grid grid-cols-4 gap-2">
          {options.variants.map((v) => {
            const active = v.id === custom.variant && !accentEnabled;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => patch({ variant: v.id, accent: null })}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-2 text-center",
                  active ? "border-foreground" : "border-transparent",
                )}
              >
                <span
                  className="h-9 w-full rounded-md border"
                  style={{
                    background: `linear-gradient(135deg, ${v.paper} 0 55%, ${v.acc} 55% 100%)`,
                  }}
                />
                <span className="text-[11px]">{v.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {options.supports.customAccent && (
        <div>
          <div className="flex items-center justify-between">
            <FieldLabel>
              {L.customAccent}
              {!premium && <PremiumBadge />}
            </FieldLabel>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="color"
              aria-label={L.customAccent}
              disabled={!premium}
              value={accentEnabled ? custom.accent! : activeVariant!.acc}
              onChange={(e) => patch({ accent: e.target.value })}
              className="h-11 w-14 cursor-pointer rounded-md border disabled:opacity-40"
            />
            {accentEnabled ? (
              <button
                type="button"
                onClick={() => patch({ accent: null })}
                className="text-muted-foreground text-xs underline"
              >
                {L.followPalette}
              </button>
            ) : (
              <span className="text-muted-foreground text-xs">
                {premium ? L.customAccentHint : L.premiumHint}
              </span>
            )}
          </div>
          {accentEnabled && (
            <p className="text-muted-foreground mt-2 text-[11px]">
              {L.contrastNote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function FontTab({ options, custom, premium, patch }: TabProps) {
  return (
    <div className="pt-1">
      <FieldLabel>{L.fontPair}</FieldLabel>
      <div className="flex flex-col gap-2">
        {options.fontPairs.map((f, i) => {
          const gated = i > 0 && !premium;
          const active = custom.fontPair === f.id;
          return (
            <button
              key={f.id}
              type="button"
              disabled={gated}
              onClick={() => patch({ fontPair: f.id })}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-3 text-left",
                active ? "border-foreground" : "border-input",
                gated && "opacity-60",
              )}
            >
              <span className="text-sm">{f.name}</span>
              {gated ? <PremiumBadge /> : active ? <Dot /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StyleTab({ options, custom, premium, patch }: TabProps) {
  const galleryValues = options.styles.gallery ?? [];
  return (
    <div className="space-y-4 pt-1">
      {galleryValues.length > 0 && (
        <div>
          <FieldLabel>{L.galleryStyle}</FieldLabel>
          <div className="grid grid-cols-3 gap-2">
            {galleryValues.map((val, i) => {
              const gated = i > 0 && !premium;
              const active =
                (custom.styles.gallery ?? galleryValues[0]) === val;
              return (
                <button
                  key={val}
                  type="button"
                  disabled={gated}
                  onClick={() =>
                    patch({ styles: { ...custom.styles, gallery: val } })
                  }
                  className={cn(
                    "relative rounded-lg border px-2 py-3 text-xs",
                    active ? "border-foreground" : "border-input",
                    gated && "opacity-60",
                  )}
                >
                  {(L.styleLabels as Record<string, string>)[val] ?? val}
                  {gated && (
                    <Lock className="absolute top-1 right-1 size-3 text-amber-600" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {options.supports.motion && (
        <div>
          <FieldLabel>{L.motion}</FieldLabel>
          <Segmented
            value={custom.motion}
            onChange={(v) => patch({ motion: v as CustomSettings["motion"] })}
            items={[
              ["full", L.motionFull],
              ["calm", L.motionCalm],
            ]}
          />
        </div>
      )}

      {options.supports.grain && (
        <div>
          <FieldLabel>{L.grain}</FieldLabel>
          <Segmented
            value={custom.grain ? "on" : "off"}
            onChange={(v) => patch({ grain: v === "on" })}
            items={[
              ["on", L.on],
              ["off", L.off],
            ]}
          />
        </div>
      )}
    </div>
  );
}

function Segmented({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (v: string) => void;
  items: [string, string][];
}) {
  return (
    <div className="bg-muted flex gap-1 rounded-lg p-1">
      {items.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            "h-9 flex-1 rounded-md text-sm font-medium",
            value === key ? "bg-background shadow-sm" : "text-muted-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Dot() {
  return <span className="bg-foreground size-2 rounded-full" />;
}

"use client";

import { useState, type ReactNode } from "react";

import type { InvitationCategory } from "@/types";

export type ThemeFilter = "all" | InvitationCategory;

export interface ThemeCatalogLabels {
  tabs: { key: ThemeFilter; label: string }[];
  filterLabel: string;
  /** Satuan hitung, mis. "tema tersedia" → dirakit sebagai `${n} ${countUnit}`. */
  countUnit: string;
  empty: string;
}

/**
 * Katalog tema dengan saring per kategori. Kartu dirender SERVER (`cards`) lalu
 * dilewatkan sebagai prop — sehingga `copy` & modul poster tetap di sisi server
 * dan TIDAK ikut ke bundel client /tema (jaga JS minimal untuk Lighthouse). Yang
 * client hanya state filter + toggle tampil/sembunyi. `categories` sejajar dengan
 * `cards` (indeks sama) untuk memutuskan kartu mana yang tampil.
 */
export function ThemeCatalog({
  cards,
  categories,
  labels,
}: {
  cards: ReactNode[];
  categories: InvitationCategory[][];
  labels: ThemeCatalogLabels;
}) {
  const [filter, setFilter] = useState<ThemeFilter>("all");

  const visible = categories
    .map((cats, i) => (filter === "all" || cats.includes(filter) ? i : -1))
    .filter((i) => i >= 0);

  return (
    <div className="space-y-6">
      <div className="mrv-tabs" role="group" aria-label={labels.filterLabel}>
        {labels.tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className="mrv-tab"
            aria-pressed={filter === tab.key}
            onClick={() => setFilter(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <p
        className="mrv-theme-card__cats"
        aria-live="polite"
        style={{ margin: 0 }}
      >
        {visible.length} {labels.countUnit}
      </p>

      {visible.length > 0 ? (
        <div className="mrv-grid mrv-grid--themes">
          {visible.map((i) => cards[i])}
        </div>
      ) : (
        <p className="mrv-lead">{labels.empty}</p>
      )}
    </div>
  );
}

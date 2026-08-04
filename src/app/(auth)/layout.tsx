import Link from "next/link";
import type { ReactNode } from "react";

import { ThemeMockup } from "@/components/theme-mockup";
import { copy } from "@/lib/copy";
import { mrvFontVars } from "@/lib/mrv-fonts";

import "../(marketing)/marketing.css";

/**
 * Layout auth (masuk/daftar/reset) — split-screen: panel kiri "showcase" gelap
 * (brand + value + mockup tema) yang tampil di layar lebar, form di kanan pada
 * kertas hangat. Di layar sempit panel disembunyikan → hanya brand ringkas +
 * form (fokus). Memakai sistem visual marketing (`.mrv`) agar senada situs.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const c = copy.marketing;
  return (
    <div className={`mrv ${mrvFontVars} mrv-auth`}>
      <aside className="mrv-auth__panel mrv-band-dark">
        <Link href="/" className="mrv-brand" aria-label={copy.brand.name}>
          {copy.brand.name}
          <span className="mrv-brand__dot" aria-hidden="true" />
        </Link>

        <div className="mrv-auth__lead">
          <span className="mrv-eyebrow">{c.hero.eyebrow}</span>
          <h2 className="mrv-display mrv-auth__title">
            {c.hero.titleLead}{" "}
            <span className="mrv-accent-word">{c.hero.titleAccent}</span>
          </h2>
          <ul className="mrv-trust">
            {c.trust.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>

        <div className="mrv-auth__showcase" aria-hidden="true">
          <div className="mrv-auth__mock">
            <ThemeMockup slug="eternal-rose" name="Eternal Rose" />
          </div>
          <div className="mrv-auth__mock">
            <ThemeMockup slug="noir" name="Noir" />
          </div>
        </div>
      </aside>

      <main className="mrv-auth__form">
        <Link
          href="/"
          className="mrv-brand mrv-auth__brand-mobile"
          aria-label={copy.brand.name}
        >
          {copy.brand.name}
          <span className="mrv-brand__dot" aria-hidden="true" />
        </Link>
        <div className="mrv-auth__form-inner">{children}</div>
      </main>
    </div>
  );
}

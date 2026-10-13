import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { MerrivaLogo } from "@/components/brand/merriva-logo";
import { ThemeMockup } from "@/components/theme-mockup";
import { copy } from "@/lib/copy";
import { mrvFontVars } from "@/lib/mrv-fonts";

import "../(marketing)/marketing.css";

/**
 * Layout auth (masuk/daftar/reset) — split-screen: panel kiri "showcase" gelap
 * (brand + value + mockup tema, dengan glow hangat) di layar lebar; form di kanan
 * dibingkai sebagai halaman utuh (jangkar atas: kembali ke beranda; jangkar bawah:
 * footer ringkas). Di layar sempit panel disembunyikan → brand ringkas + form.
 * Memakai sistem visual marketing (`.mrv`) agar senada situs.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const c = copy.marketing;
  const a = copy.auth;
  const year = new Date().getFullYear();

  return (
    <div className={`mrv ${mrvFontVars} mrv-auth`}>
      <aside className="mrv-auth__panel mrv-band-dark">
        <Link href="/" className="mrv-brand" aria-label={copy.brand.name}>
          <MerrivaLogo />
        </Link>

        <div className="mrv-auth__lead">
          <span className="mrv-eyebrow">{c.hero.eyebrow}</span>
          <h2 className="mrv-display mrv-auth__title">
            {c.hero.titleLead}{" "}
            <span className="mrv-accent-word">{c.hero.titleAccent}</span>
          </h2>
          <p className="mrv-lead">{c.hero.subtitle}</p>
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
            <ThemeMockup slug="barakah" name="Barakah" />
          </div>
          <div className="mrv-auth__mock">
            <ThemeMockup slug="noir" name="Noir" />
          </div>
        </div>
      </aside>

      <main className="mrv-auth__form">
        <div className="mrv-auth__form-top">
          <Link
            href="/"
            className="mrv-brand mrv-auth__brand-mobile"
            aria-label={copy.brand.name}
          >
            <MerrivaLogo />
          </Link>
          <Link href="/" className="mrv-auth__back">
            <ArrowLeft size={15} aria-hidden="true" />
            {a.backHome}
          </Link>
        </div>

        <div className="mrv-auth__body">
          <div className="mrv-auth__form-inner">{children}</div>
        </div>

        <footer className="mrv-auth__foot">
          <span>{a.footerRights(year)}</span>
          <div className="mrv-auth__foot-links">
            <Link href="/syarat">{a.footerTerms}</Link>
            <Link href="/privasi">{a.footerPrivacy}</Link>
            <Link href="/faq">{a.footerHelp}</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}

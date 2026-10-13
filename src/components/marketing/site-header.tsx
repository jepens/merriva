import Link from "next/link";
import { Menu } from "lucide-react";

import { MerrivaLogo } from "@/components/brand/merriva-logo";
import { copy } from "@/lib/copy";

const NAV = [
  { href: "/tema", label: copy.marketing.nav.themes },
  { href: "/harga", label: copy.marketing.nav.pricing },
  { href: "/faq", label: copy.marketing.nav.faq },
];

/**
 * Header marketing. Nav desktop + menu mobile via `<details>` (tanpa JavaScript).
 * Brand kiri, aksi (Masuk + CTA) kanan.
 */
export function SiteHeader() {
  const m = copy.marketing.nav;
  return (
    <header className="mrv-header">
      <div className="mrv-container mrv-header__inner">
        <Link href="/" className="mrv-brand" aria-label={copy.brand.name}>
          <MerrivaLogo />
        </Link>

        <nav className="mrv-nav" aria-label={m.menu}>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mrv-header__actions">
          <Link href="/masuk" className="mrv-header__login">
            {m.login}
          </Link>
          <Link href="/daftar" className="mrv-btn mrv-btn--primary">
            {m.cta}
          </Link>
        </div>

        <details className="mrv-menu">
          <summary className="mrv-menu__toggle" aria-label={m.menu}>
            <Menu size={20} aria-hidden="true" />
          </summary>
          <div className="mrv-menu__panel">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
            <div className="mrv-menu__sep" />
            <Link href="/masuk">{m.login}</Link>
            <Link href="/daftar">{m.cta}</Link>
          </div>
        </details>
      </div>
    </header>
  );
}

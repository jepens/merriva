import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { copy } from "@/lib/copy";

interface ThemeNeighbor {
  slug: string;
  name: string;
}

/**
 * Showcase tema publik: plakat "galeri" (nama tema, kategori/tier, CTA konversi,
 * stepper antar-tema) di samping SPESIMEN hidup — tema dirender di dalam bingkai
 * ponsel (iframe = viewport bersarang, sama seperti WebView WA). Presentasional
 * murni; konteks tema & tetangga prev/next disuplai server dari katalog aktif.
 */
export function ThemeShowcase({
  name,
  category,
  tier,
  embedSrc,
  credit,
  prev,
  next,
}: {
  name: string;
  category: string | null;
  tier: string | null;
  embedSrc: string;
  credit: ReactNode;
  prev: ThemeNeighbor | null;
  next: ThemeNeighbor | null;
}) {
  const p = copy.preview;

  return (
    <section className="mrv-show">
      <div className="mrv-container mrv-show__grid">
        {/* Plakat — placard museum: identitas produk (tema), bukan isi undangan. */}
        <div className="mrv-show__placard">
          <span className="mrv-eyebrow">{p.demoBadge}</span>
          <h1 className="mrv-display mrv-show__name">{name}</h1>

          {category || tier ? (
            <div className="mrv-show__chips">
              {category ? <span className="mrv-chip">{category}</span> : null}
              {tier ? (
                <span className="mrv-chip mrv-chip--tier">{tier}</span>
              ) : null}
            </div>
          ) : null}

          <p className="mrv-lead mrv-show__note">{p.showcaseNote}</p>

          <div className="mrv-show__ctas">
            <Link href="/daftar" className="mrv-btn mrv-btn--primary">
              {p.useThisTheme}
            </Link>
            <Link href="/tema" className="mrv-btn mrv-btn--ghost">
              {p.allThemes}
            </Link>
          </div>

          {prev || next ? (
            <nav className="mrv-show__steppers" aria-label={p.otherThemes}>
              {prev ? (
                <Link
                  href={`/preview/tema/${prev.slug}`}
                  className="mrv-stepper"
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  <span className="mrv-stepper__text">
                    <span className="mrv-stepper__dir">{p.prevTheme}</span>
                    <span className="mrv-stepper__name">{prev.name}</span>
                  </span>
                </Link>
              ) : (
                <span aria-hidden="true" />
              )}
              {next ? (
                <Link
                  href={`/preview/tema/${next.slug}`}
                  className="mrv-stepper mrv-stepper--next"
                >
                  <span className="mrv-stepper__text">
                    <span className="mrv-stepper__dir">{p.nextTheme}</span>
                    <span className="mrv-stepper__name">{next.name}</span>
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ) : (
                <span aria-hidden="true" />
              )}
            </nav>
          ) : null}
        </div>

        {/* Spesimen — ponsel di atas plinth kertas. */}
        <div className="mrv-show__stage">
          <div className="mrv-show__phone">
            <span className="mrv-show__speaker" aria-hidden="true" />
            <iframe
              src={embedSrc}
              title={p.frameTitle}
              className="mrv-show__screen"
            />
          </div>
          <div className="mrv-show__credit">{credit}</div>
        </div>
      </div>
    </section>
  );
}

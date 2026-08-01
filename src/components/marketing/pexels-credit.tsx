import { copy } from "@/lib/copy";
import {
  allDemoPhotographers,
  demoPhotoCreditsFor,
} from "@/themes/_shared/demo-photos";

/**
 * Atribusi foto demo Pexels (Server Component, nol JS klien). Lisensi Pexels
 * mewajibkan tautan menonjol ke Pexels + kredit fotografer di mana foto tampil.
 * Dipakai di footer /preview (per tema) & katalog /tema (gabungan). Merender
 * `null` bila belum ada foto Pexels (skrip `pnpm demo:photos` belum jalan →
 * demo memakai swatch) sehingga tak menampilkan atribusi kosong.
 */
const PEXELS_URL = "https://www.pexels.com";

function CreditLine({ people }: { people: { name: string; url: string }[] }) {
  if (people.length === 0) return null;
  const c = copy.marketing.pexels;
  return (
    <p className="text-center text-xs text-neutral-500">
      {c.by}{" "}
      {people.map((p, i) => (
        <span key={p.url}>
          {i > 0 ? ", " : ""}
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-neutral-700"
          >
            {p.name}
          </a>
        </span>
      ))}{" "}
      {c.via}{" "}
      <a
        href={PEXELS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-neutral-700"
      >
        {c.label}
      </a>
    </p>
  );
}

/** Kredit foto satu tema — untuk footer /preview/tema/{slug} & /preview/demo. */
export function PexelsCredit({ slug }: { slug: string }) {
  const seen = new Map<string, { name: string; url: string }>();
  for (const cr of demoPhotoCreditsFor(slug)) {
    if (!seen.has(cr.photographerUrl)) {
      seen.set(cr.photographerUrl, {
        name: cr.photographer,
        url: cr.photographerUrl,
      });
    }
  }
  return <CreditLine people={[...seen.values()]} />;
}

/** Kredit gabungan seluruh fotografer — untuk footer katalog /tema. */
export function PexelsCreditFooter() {
  return <CreditLine people={allDemoPhotographers()} />;
}

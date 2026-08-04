import { getThemeCatalogMeta } from "@/themes/catalog-meta";

/**
 * Thumbnail spesimen tema untuk pemilih tema (dashboard). Mandiri dari CSS
 * marketing: hanya memakai palet khas tema dari `catalog-meta` (bg/ink/accent/
 * ornament) via inline style + Tailwind. Tanpa gambar/font per-tema → ringan &
 * otomatis ikut saat tema baru ditambah. Pratinjau hidup penuh via "Lihat demo".
 */
export function ThemeThumb({ slug, name }: { slug: string; name: string }) {
  const meta = getThemeCatalogMeta(slug);
  return (
    <div
      className="flex aspect-[3/2] w-full flex-col items-center justify-center gap-2 px-4 py-5 text-center"
      style={{ backgroundColor: meta.bg, color: meta.ink }}
    >
      <span className="font-serif text-lg leading-tight tracking-wide">
        {name}
      </span>
      <span
        className="flex w-full items-center justify-center gap-2 text-sm"
        style={{ color: meta.accent }}
        aria-hidden="true"
      >
        <span className="h-px w-6 bg-current opacity-50" />
        {meta.ornament}
        <span className="h-px w-6 bg-current opacity-50" />
      </span>
    </div>
  );
}

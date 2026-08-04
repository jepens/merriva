import Image from "next/image";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { getThemeCatalogMeta } from "@/themes/catalog-meta";

/** Satu bingkai ponsel berisi 1 screenshot tema (Next Image — lazy + optimasi). */
function Phone({
  src,
  alt,
  className,
  style,
}: {
  src: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn(
        "absolute aspect-9/19 overflow-hidden rounded-[1.1rem] border-[3px] border-neutral-950 bg-neutral-950 shadow-[0_18px_34px_-16px_rgba(0,0,0,0.65)]",
        className,
      )}
      style={style}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[0.85rem]">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 640px) 45vw, 170px"
          className="object-cover object-top"
        />
      </div>
    </div>
  );
}

/**
 * Mockup tema: DUA ponsel miring (cover + isi) di atas panel berwarna khas tema
 * (dari `catalog-meta`) — pengganti spesimen tipografi agar kartu memperlihatkan
 * rupa asli tema. Gambar dari `public/theme-thumbs/{slug}-{cover,inner}.jpg`
 * (regen: `pnpm thumbs`) disajikan via Next <Image> (lazy + WebP/AVIF). Isomorfik
 * (dipakai katalog server & form client). Jika tema belum difoto, pemanggil
 * memakai fallback poster spesimen (lihat `hasThemeThumb`).
 */
export function ThemeMockup({ slug, name }: { slug: string; name: string }) {
  const meta = getThemeCatalogMeta(slug);
  return (
    <div
      className="relative aspect-4/3 w-full overflow-hidden"
      style={{
        background: `linear-gradient(157deg, ${meta.bg}, color-mix(in srgb, ${meta.bg} 76%, #000))`,
      }}
    >
      {/* Ponsel belakang — bagian isi (mempelai/galeri). */}
      <Phone
        src={`/theme-thumbs/${slug}-inner.jpg`}
        alt={`Cuplikan isi tema ${name}`}
        className="h-[70%]"
        style={{
          top: "53%",
          left: "50%",
          transform: "translate(-84%, -50%) rotate(-9deg)",
          zIndex: 1,
        }}
      />
      {/* Ponsel depan — cover. */}
      <Phone
        src={`/theme-thumbs/${slug}-cover.jpg`}
        alt={`Cuplikan cover tema ${name}`}
        className="h-[82%]"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-16%, -50%) rotate(5deg)",
          zIndex: 2,
        }}
      />
    </div>
  );
}

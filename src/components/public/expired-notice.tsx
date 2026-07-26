import { copy } from "@/lib/copy";

/**
 * Halaman sopan untuk undangan `expired` (SPEC §4.5) — bukan error 404/500.
 * Tanpa data pribadi apa pun; sekadar pemberitahuan masa aktif berakhir.
 */
export function ExpiredNotice() {
  const t = copy.public.expired;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold text-neutral-800">{t.title}</h1>
      <p className="text-sm leading-relaxed text-neutral-500">{t.body}</p>
      <p className="mt-6 text-xs tracking-wide text-neutral-400">{t.brand}</p>
    </main>
  );
}

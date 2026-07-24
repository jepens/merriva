import { copy } from "@/lib/copy";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">
        {copy.brand.name}
      </h1>
      <p className="max-w-md text-sm text-gray-600 dark:text-gray-400">
        {copy.brand.tagline}
      </p>
      <p className="text-xs text-gray-400">
        Fondasi (M0) aktif — fitur menyusul.
      </p>
    </main>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";

import { copy } from "@/lib/copy";
import type { GuestbookEntry } from "@/lib/validation/guestbook";
import { getGuestbookAction } from "@/server/actions/guestbook";

/**
 * Dinding ucapan (SPEC §4.6): hanya ucapan yang disetujui & tak disembunyikan,
 * terbaru di atas, paginasi "muat lebih banyak". Diambil via server action
 * (bukan bagian halaman ISR) agar selalu segar tanpa membatalkan cache halaman.
 * `refreshKey` naik saat ada kiriman baru → muat ulang dari awal.
 */
export function GuestbookWall({
  slug,
  refreshKey = 0,
}: {
  slug: string;
  refreshKey?: number;
}) {
  const t = copy.guestbook.wall;
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  // Dipisahkan dari "kosong": daftar kosong karena rate limit pernah tampil
  // sebagai fakta ("belum ada ucapan") — menyesatkan tamu (AUDIT PER-3).
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Muat awal / muat ulang (saat refreshKey berubah). Di dalam effect → `await`
  // dulu, JANGAN setState sinkron (hindari cascading render). `loading` awal
  // sudah true sehingga halaman pertama tampil "memuat" tanpa perlu di-set ulang.
  useEffect(() => {
    let active = true;
    getGuestbookAction(slug, 0).then((res) => {
      if (!active) return;
      setEntries(res.entries);
      setHasMore(res.hasMore);
      setFailed(res.rateLimited === true);
      setPage(0);
      setLoaded(true);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [slug, refreshKey, attempt]);

  // Tombol "muat lebih" — handler (bukan effect), boleh setState sinkron.
  const loadMore = useCallback(async () => {
    setLoading(true);
    const next = page + 1;
    const res = await getGuestbookAction(slug, next);
    if (res.rateLimited) {
      setFailed(true);
      setLoading(false);
      return;
    }
    // Dedup by id: offset pagination atas feed hidup bisa menggeser jendela →
    // cegah entri ganda / tabrakan React key.
    setEntries((prev) => {
      const seen = new Set(prev.map((e) => e.id));
      return [...prev, ...res.entries.filter((e) => !seen.has(e.id))];
    });
    setHasMore(res.hasMore);
    setPage(next);
    setLoading(false);
  }, [slug, page]);

  return (
    <div className="gb-wall">
      <h3 className="gb-wall__title">{t.heading}</h3>
      {loaded && entries.length === 0 && !loading && !failed ? (
        <p className="gb-wall__empty">{t.empty}</p>
      ) : null}
      {failed && !loading ? (
        <p className="gb-wall__empty" role="status">
          {t.failed}{" "}
          <button
            type="button"
            className="gb-retry"
            onClick={() => {
              setFailed(false);
              setLoading(true);
              setAttempt((n) => n + 1);
            }}
          >
            {t.retry}
          </button>
        </p>
      ) : null}
      <ul className="gb-wall__list">
        {entries.map((e) => (
          <li key={e.id} className="gb-note">
            <p className="gb-note__msg">{e.message}</p>
            <p className="gb-note__name">— {e.name}</p>
          </li>
        ))}
      </ul>
      {hasMore ? (
        <button
          type="button"
          className="gb-more"
          onClick={loadMore}
          disabled={loading}
        >
          {loading ? t.loading : t.loadMore}
        </button>
      ) : null}
    </div>
  );
}

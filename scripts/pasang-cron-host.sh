#!/usr/bin/env bash
# Pasang cron Merriva di host. Secret dibaca dari STDIN — tak pernah muncul di
# argumen perintah, `ps`, riwayat shell, maupun di dalam crontab itu sendiri.
#
# IDEMPOTEN: dijalankan dua kali tidak menggandakan baris.
# TIDAK MERUSAK: crontab yang sudah ada (mis. backup Directus) dipertahankan,
# dan cadangannya disimpan sebelum apa pun diubah.
set -euo pipefail

CONF=/etc/merriva-cron.conf
TANDA='# >>> merriva cron'
AKHIR='# <<< merriva cron'
LOG=/var/log/merriva-cron.log

read -r SECRET
if [ -z "${SECRET:-}" ]; then
  echo "GAGAL: secret kosong di stdin" >&2
  exit 1
fi

# --- 1. Berkas header untuk curl -K (600, root saja) -------------------------
umask 077
printf 'header = "Authorization: Bearer %s"\n' "$SECRET" > "$CONF"
chmod 600 "$CONF"
echo "konfigurasi : $(ls -l "$CONF" | awk '{print $1, $3, $9}')"

# --- 2. Cadangkan crontab yang ada -------------------------------------------
BAK="/root/crontab.sebelum-merriva.$(date -u +%Y%m%dT%H%M%SZ)"
crontab -l > "$BAK" 2>/dev/null || : > "$BAK"
echo "cadangan    : $BAK ($(wc -l < "$BAK") baris)"

# --- 3. Susun crontab baru: yang lama UTUH + blok merriva --------------------
TMP=$(mktemp)
# Buang blok merriva lama bila ada, pertahankan sisanya apa adanya.
awk -v a="$TANDA" -v b="$AKHIR" '
  $0 == a { lewat = 1; next }
  $0 == b { lewat = 0; next }
  !lewat  { print }
' "$BAK" > "$TMP"

{
  echo "$TANDA"
  echo "# Jam = zona waktu HOST (Etc/UTC). WIB = +7."
  echo "# -X POST wajib (route POST-only; tanpa itu 405). -fsS wajib (tanpa -f,"
  echo "# curl keluar 0 pada 401 dan cron mengira sukses). -K menyembunyikan"
  echo "# secret dari \`ps\`. Dokumen: docs/LAUNCH-CHECKLIST.md Fase 3."
  echo "0  *    * * * curl -fsS -m 600 -X POST -K $CONF https://merriva.id/api/cron/expire-orders      >>$LOG 2>&1"
  echo "15 0    * * * curl -fsS -m 600 -X POST -K $CONF https://merriva.id/api/cron/expire-invitations >>$LOG 2>&1"
  echo "30 1,13 * * * curl -fsS -m 600 -X POST -K $CONF https://merriva.id/api/cron/expiry-reminders   >>$LOG 2>&1"
  echo "45 2,14 * * * curl -fsS -m 600 -X POST -K $CONF https://merriva.id/api/cron/purge-expired      >>$LOG 2>&1"
  echo "$AKHIR"
} >> "$TMP"

crontab "$TMP"
rm -f "$TMP"

echo "--- crontab terpasang sekarang ---"
crontab -l

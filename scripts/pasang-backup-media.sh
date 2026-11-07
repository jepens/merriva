#!/usr/bin/env bash
# Pasang backup media harian Merriva di host VPS (DECISIONS #117).
#
#   scp scripts/backup-media.sh scripts/pasang-backup-media.sh <vps>:/root/
#   ssh -t <vps> 'bash /root/pasang-backup-media.sh'
#
# Kredensial R2 DITANYAKAN (kunci tanpa gema) — tak pernah muncul di argumen
# perintah, `ps`, riwayat shell, maupun crontab. Bisa juga dialirkan lewat
# STDIN, satu nilai per baris, urutan: account id, bucket, access key id,
# secret access key.
#
# IDEMPOTEN: dijalankan ulang menimpa konfigurasi & skrip, tak menggandakan
# baris cron. TIDAK MERUSAK: blok cron lain (merriva cron, backup Directus)
# dipertahankan, dan crontab lama dicadangkan lebih dulu.
#
# Diakhiri SATU backup sungguhan, supaya kredensial yang salah ketahuan
# sekarang — bukan besok pagi sebagai baris "Tidak jalan" di panel.
#
# Env opsional: R2_ENDPOINT (bucket berjurisdiksi, mis.
# https://<akun>.eu.r2.cloudflarestorage.com), HEARTBEAT_URL (staging), dan
# VOLUME (nama volume Docker = <proyek-easypanel>_merriva_media; bawaan
# etc_merriva_media).
set -euo pipefail
umask 077

DIR=$(cd "$(dirname "$0")" && pwd)
SUMBER_SKRIP="$DIR/backup-media.sh"
BIN=/usr/local/sbin/merriva-backup-media
CONF=/etc/merriva-backup.conf
CURL_CONF=/etc/merriva-backup.curl
LOG=/var/log/merriva-backup.log
TANDA='# >>> merriva backup'
AKHIR='# <<< merriva backup'

[ "$(id -u)" -eq 0 ] || { echo "GAGAL: jalankan sebagai root" >&2; exit 1; }
[ -r "$SUMBER_SKRIP" ] || { echo "GAGAL: $SUMBER_SKRIP tak ada — scp kedua berkas ke folder yang sama" >&2; exit 1; }

# --- 0. Prasyarat ------------------------------------------------------------
for t in curl zstd tar flock md5sum docker crontab; do
  command -v "$t" >/dev/null || { echo "GAGAL: '$t' tak terpasang" >&2; exit 1; }
done
curl --help all 2>/dev/null | grep -q -- '--aws-sigv4' \
  || { echo "GAGAL: curl terlalu tua (butuh --aws-sigv4, curl >= 7.75)" >&2; exit 1; }

# --- 1. Kredensial -----------------------------------------------------------
tanya() { # $1 = label, $2 = "rahasia" untuk tanpa gema
  local v
  if [ -t 0 ]; then
    if [ "${2:-}" = rahasia ]; then read -rsp "$1: " v; echo >&2; else read -rp "$1: " v; fi
  else
    read -r v
  fi
  printf '%s' "$v" | tr -d '[:space:]'
}
ACCOUNT_ID=$(tanya "R2 Account ID")
BUCKET=$(tanya "Nama bucket")
KEY_ID=$(tanya "Access Key ID" rahasia)
SECRET=$(tanya "Secret Access Key" rahasia)

# Validasi bentuk SEBELUM menulis apa pun. Selain menangkap salah tempel, ini
# menjamin nilainya aman di dalam kutip berkas konfigurasi curl (tanpa `"`/`\`).
[[ "$ACCOUNT_ID" =~ ^[0-9a-f]{32}$ ]] || { echo "GAGAL: Account ID harus 32 hex" >&2; exit 1; }
[[ "$BUCKET" =~ ^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$ ]] || { echo "GAGAL: nama bucket tak sah" >&2; exit 1; }
[[ "$KEY_ID" =~ ^[A-Za-z0-9]{16,128}$ ]] || { echo "GAGAL: Access Key ID tak sah" >&2; exit 1; }
[[ "$SECRET" =~ ^[A-Za-z0-9]{16,128}$ ]] || { echo "GAGAL: Secret Access Key tak sah" >&2; exit 1; }
VOLUME=${VOLUME:-etc_merriva_media}
[[ "$VOLUME" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || { echo "GAGAL: nama VOLUME tak sah" >&2; exit 1; }

# --- 2. Konfigurasi (600, root saja) -----------------------------------------
printf 'user = "%s:%s"\n' "$KEY_ID" "$SECRET" > "$CURL_CONF"
chmod 600 "$CURL_CONF"
{
  echo "# Dibuat pasang-backup-media.sh — non-rahasia. Kunci ada di $CURL_CONF."
  echo "R2_ACCOUNT_ID=$ACCOUNT_ID"
  echo "R2_BUCKET=$BUCKET"
  [ -z "${R2_ENDPOINT:-}" ] || echo "R2_ENDPOINT=$R2_ENDPOINT"
  echo "VOLUME=$VOLUME"
  echo "PREFIX=media/"
  echo "HEARTBEAT_URL=${HEARTBEAT_URL:-https://merriva.id/api/cron/backup-media}"
  echo "CRON_CONF=/etc/merriva-cron.conf"
} > "$CONF"
chmod 600 "$CONF"
install -m 700 -o root -g root "$SUMBER_SKRIP" "$BIN"
echo "terpasang   : $BIN, $CONF, $CURL_CONF"
[ -r /etc/merriva-cron.conf ] \
  || echo "PERINGATAN: /etc/merriva-cron.conf tak ada — laporan ke panel akan ditolak 401 (jalankan pasang-cron-host.sh)"

# --- 3. Crontab: yang lama UTUH + blok backup --------------------------------
BAK="/root/crontab.sebelum-backup.$(date -u +%Y%m%dT%H%M%SZ)"
crontab -l > "$BAK" 2>/dev/null || : > "$BAK"
echo "cadangan    : $BAK ($(wc -l < "$BAK") baris)"
TMP=$(mktemp)
awk -v a="$TANDA" -v b="$AKHIR" '
  $0 == a { lewat = 1; next }
  $0 == b { lewat = 0; next }
  !lewat  { print }
' "$BAK" > "$TMP"
{
  echo "$TANDA"
  echo "# Snapshot media harian ke R2 (DECISIONS #117). Jam = zona HOST (UTC); 20:30 UTC = 03:30 WIB."
  echo "30 20 * * * $BIN >>$LOG 2>&1"
  echo "$AKHIR"
} >> "$TMP"
crontab "$TMP"
rm -f "$TMP"
echo "--- blok cron backup ---"
crontab -l | awk -v a="$TANDA" -v b="$AKHIR" '$0==a{p=1} p{print} $0==b{p=0}'

# --- 4. Satu backup sungguhan sekarang ---------------------------------------
echo "--- backup pertama ---"
"$BIN" 2>&1 | tee -a "$LOG"
echo "--- isi bucket ---"
"$BIN" daftar

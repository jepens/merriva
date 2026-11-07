#!/usr/bin/env bash
# Backup harian volume media Merriva ke bucket R2 privat (DECISIONS #117).
#
# Dijalankan cron HOST (bukan di dalam image) — dipasang oleh
# `scripts/pasang-backup-media.sh`. Selama STORAGE_DRIVER=local, volume media
# adalah SATU-SATUNYA salinan foto pelanggan (RUNBOOK "Komponen & lokasi data").
#
#   merriva-backup-media                 buat snapshot + unggah + verifikasi
#   merriva-backup-media daftar          20 snapshot terbaru di bucket
#   merriva-backup-media unduh KEY FILE  unduh satu snapshot + uji integritasnya
#
# Snapshot = tar penuh (bukan inkremental) yang dikompres zstd, satu objek per
# jalan, nama ber-cap waktu sehingga TAK PERNAH menimpa objek lama (kompatibel
# dengan bucket lock R2). Retensi diatur aturan lifecycle bucket, bukan skrip ini.
#
# Kebenaran unggahan dibuktikan, bukan diasumsikan: HEAD sesudah PUT harus
# menunjukkan ukuran yang sama, dan ETag (MD5 untuk unggahan satu-bagian) harus
# sama dengan MD5 lokal. Hasilnya dilaporkan ke `/api/cron/backup-media` → baris
# `cron_runs` "backup-media" → panel /admin dan `pnpm ops:verify`. Backup yang
# BERHENTI jalan tidak mengirim galat apa pun; yang terlihat adalah baris yang
# membasi — persis pola keempat cron lainnya.
set -euo pipefail
umask 077
# PATH cron bawaan hanya /usr/bin:/bin — tetapkan sendiri, jangan bergantung.
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

CONF=${MERRIVA_BACKUP_CONF:-/etc/merriva-backup.conf}
CURL_CONF=${MERRIVA_BACKUP_CURL:-/etc/merriva-backup.curl}

# --- Konfigurasi non-rahasia (KEY=VALUE; DIBACA, bukan di-`source`) ----------
R2_ACCOUNT_ID=""
R2_BUCKET=""
R2_ENDPOINT=""
R2_REGION="auto"
VOLUME="etc_merriva_media"
SUMBER_DIR=""
PREFIX="media/"
HEARTBEAT_URL="https://merriva.id/api/cron/backup-media"
CRON_CONF="/etc/merriva-cron.conf"
# Batas satu PUT R2 ~5 GiB. Di atas ini perlu unggahan multi-bagian (rclone);
# skrip menolak dengan pesan jelas alih-alih gagal samar di tengah unggahan.
MAKS_BYTE=$((4500 * 1024 * 1024))

[ -r "$CONF" ] || { echo "GAGAL: $CONF tak terbaca — jalankan pasang-backup-media.sh" >&2; exit 1; }
[ -r "$CURL_CONF" ] || { echo "GAGAL: $CURL_CONF tak terbaca" >&2; exit 1; }
while IFS='=' read -r k v; do
  case "$k" in
    R2_ACCOUNT_ID|R2_BUCKET|R2_ENDPOINT|R2_REGION|VOLUME|SUMBER_DIR|PREFIX|HEARTBEAT_URL|CRON_CONF)
      printf -v "$k" '%s' "$v" ;;
    ''|'#'*) ;;
    *) echo "peringatan: kunci tak dikenal di $CONF diabaikan: $k" >&2 ;;
  esac
done < "$CONF"
[ -n "$R2_ENDPOINT" ] || R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
[ -n "$R2_BUCKET" ] || { echo "GAGAL: R2_BUCKET kosong di $CONF" >&2; exit 1; }

# `aws-sigv4` + `user` ada di $CURL_CONF (600) supaya kunci tak pernah muncul di
# argumen proses (`ps`). Region `auto` = region kanonik R2.
s3() { curl -sS -K "$CURL_CONF" --aws-sigv4 "aws:amz:${R2_REGION}:s3" "$@"; }

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

# --- Subperintah pemulihan ---------------------------------------------------
case "${1:-}" in
  daftar)
    # Prefix di-encode sendiri: SigV4 menandatangani query kanonik ter-encode.
    pfx=$(printf '%s' "$PREFIX" | sed 's|/|%2F|g')
    xml=$(s3 -f "${R2_ENDPOINT}/${R2_BUCKET}?list-type=2&prefix=${pfx}")
    # Satu halaman ListObjectsV2 = ≤1000 kunci, cukup untuk retensi harian.
    printf '%s' "$xml" | grep -o '<Key>[^<]*</Key>' | sed 's|</\?Key>||g' | sort | tail -20 \
      || echo "(belum ada snapshot di ${R2_BUCKET}/${PREFIX})"
    exit 0
    ;;
  unduh)
    key=${2:?pakai: unduh KEY FILE}; out=${3:?pakai: unduh KEY FILE}
    s3 -f -o "$out" "${R2_ENDPOINT}/${R2_BUCKET}/${key}"
    zstd -tq "$out"
    n=$(zstd -dc "$out" | tar -tf - | grep -vc '/$' || true)
    log "OK: $out utuh (zstd checksum lulus), $n berkas"
    exit 0
    ;;
  '') ;;
  *) echo "subperintah tak dikenal: $1" >&2; exit 2 ;;
esac

# --- Laporan ke aplikasi -----------------------------------------------------
lapor() {
  # $1 = true|false, $2 = berkas, $3 = byte, $4 = pesan galat
  [ -n "$HEARTBEAT_URL" ] || return 0
  local body
  if [ "$1" = true ]; then
    body=$(printf '{"ok":true,"files":%d,"bytes":%d}' "$2" "$3")
  else
    # Pesan dibersihkan dari kutip/backslash/kontrol → JSON selalu valid.
    local pesan
    pesan=$(printf '%s' "${4:-gagal tanpa pesan}" | tr -d '"\\' | tr -c '[:print:]' ' ' | cut -c1-200)
    body=$(printf '{"ok":false,"error":"%s"}' "$pesan")
  fi
  if ! curl -fsS -m 30 --retry 3 --retry-delay 5 -X POST -K "$CRON_CONF" \
      -H 'Content-Type: application/json' --data "$body" -o /dev/null "$HEARTBEAT_URL"; then
    log "PERINGATAN: laporan ke $HEARTBEAT_URL gagal — panel akan menampilkan 'Tidak jalan'"
  fi
}

gagal() {
  trap - ERR
  log "GAGAL: $1"
  lapor false 0 0 "$1"
  exit 1
}
trap 'gagal "langkah tak terduga gagal di baris $LINENO"' ERR

# --- Satu jalan pada satu waktu ----------------------------------------------
exec 9>/run/merriva-backup.lock
if ! flock -n 9; then
  log "lewat: backup lain masih berjalan"
  exit 0
fi

# --- Sumber ------------------------------------------------------------------
if [ -z "$SUMBER_DIR" ]; then
  # Volume BERNAMA, bukan bind path Easypanel — path RUNBOOK lama kosong
  # (memori ops 2026-10-27). Dibaca dari Docker, bukan ditebak.
  SUMBER_DIR=$(docker volume inspect -f '{{.Mountpoint}}' "$VOLUME" 2>/dev/null) \
    || gagal "volume Docker '$VOLUME' tak ditemukan"
fi
[ -d "$SUMBER_DIR" ] || gagal "direktori sumber tak ada: $SUMBER_DIR"
# `|| true`: find keluar 1 bila direktori lenyap SAAT dijelajahi (driver local
# me-`rmdir` folder foto yang dihapus). Jumlahnya tetap tercetak; kegagalan
# total tetap jatuh ke cek "sumber kosong" di bawah. Di sisi kiri `||`, trap
# ERR tak terpicu.
n_sumber=$(find "$SUMBER_DIR" -type f ! -name '*.tmp' | wc -l) || true
# Nol berkas = mount hilang/volume salah, BUKAN "belum ada foto": pustaka lagu
# selalu ada. Jangan unggah arsip kosong yang terlihat seperti backup sehat.
[ "$n_sumber" -gt 0 ] || gagal "sumber kosong ($SUMBER_DIR) - volume salah atau tak ter-mount?"

# --- Arsip -------------------------------------------------------------------
KERJA=$(mktemp -d /var/tmp/merriva-backup.XXXXXX)
trap 'rm -rf "$KERJA"' EXIT
cap=$(date -u +%Y%m%dT%H%M%SZ)
KEY="${PREFIX}merriva-media-${cap}.tar.zst"
ARSIP="$KERJA/arsip.tar.zst"

# `*.tmp` = tulisan driver local yang belum di-rename (atomik) — bukan foto.
# tar exit 1 = berkas/direktori berubah atau terhapus SAAT dibaca (unggahan,
# hapus foto, rename `*.tmp` yang sedang jalan) → arsip tetap sah; snapshot
# besok menangkap keadaan barunya. Flag `--warning` hanya membisukan pesan,
# BUKAN kode keluarnya.
#
# Status dibaca lewat `|| st=(...)`, bukan `set +e`: trap ERR tetap terpicu
# di bawah `set +e` (ia tak bergantung pada errexit), sedangkan sisi kiri `||`
# tidak memicunya — dan PIPESTATUS masih milik pipeline ini.
st=(0 0)
tar -C "$SUMBER_DIR" --exclude='*.tmp' --warning=no-file-changed \
  --warning=no-file-removed -cf - . | zstd -q -T0 -o "$ARSIP" || st=("${PIPESTATUS[@]}")
# zstd diperiksa dulu: zstd yang mati (disk penuh) membuat tar kena SIGPIPE
# (141), dan pesan "tar gagal" akan menyesatkan.
[ "${st[1]}" -eq 0 ] || gagal "zstd gagal (exit ${st[1]}) - disk /var/tmp penuh?"
[ "${st[0]}" -le 1 ] || gagal "tar gagal (exit ${st[0]})"

zstd -tq "$ARSIP" || gagal "arsip gagal uji integritas zstd"
n_arsip=$(zstd -dc "$ARSIP" | tar -tf - | grep -vc '/$' || true)
[ "$n_arsip" -gt 0 ] || gagal "arsip tak berisi berkas"
ukuran=$(stat -c %s "$ARSIP")
[ "$ukuran" -le "$MAKS_BYTE" ] || gagal "arsip ${ukuran} byte melewati batas satu PUT - pindah ke unggahan multi-bagian"
md5=$(md5sum "$ARSIP" | cut -c1-32)

# --- Unggah + buktikan -------------------------------------------------------
# Pesan `gagal` sengaja ASCII: cron jalan di locale C, dan pembersih JSON di
# `lapor` memperlakukan byte non-ASCII sebagai karakter tak tercetak.
URL="${R2_ENDPOINT}/${R2_BUCKET}/${KEY}"
# PUT idempoten (kunci unik per jalan) → aman diulang. `--retry` mengulang
# timeout & 408/429/5xx; 4xx lain (kunci salah, bucket salah) langsung gagal.
http=$(s3 --retry 3 --retry-delay 10 -T "$ARSIP" -H 'Content-Type: application/zstd' \
  -o "$KERJA/put.body" -w '%{http_code}' "$URL") || http="000 (koneksi gagal)"
if [ "$http" != 200 ]; then
  kode=$(grep -o '<Code>[^<]*' "$KERJA/put.body" 2>/dev/null | head -1 | sed 's/<Code>//' || true)
  gagal "unggah ditolak: HTTP $http ${kode:-}"
fi

s3 -f -I -o /dev/null -D "$KERJA/head.h" "$URL" || gagal "HEAD sesudah unggah gagal - objek tak terkonfirmasi"
h_len=$(tr -d '\r' < "$KERJA/head.h" | awk -F': ' 'tolower($1)=="content-length"{print $2}' | tail -1)
h_etag=$(tr -d '\r"' < "$KERJA/head.h" | awk -F': ' 'tolower($1)=="etag"{print tolower($2)}' | tail -1)
[ "$h_len" = "$ukuran" ] || gagal "ukuran di bucket ($h_len) != lokal ($ukuran)"
if [[ "$h_etag" =~ ^[0-9a-f]{32}$ ]]; then
  [ "$h_etag" = "$md5" ] || gagal "ETag bucket ($h_etag) != MD5 lokal ($md5) - objek korup"
  bukti="ukuran + MD5"
else
  bukti="ukuran saja (ETag bukan MD5: $h_etag)"
fi

log "OK: $KEY — $n_arsip berkas, $ukuran byte, terbukti $bukti"
lapor true "$n_arsip" "$ukuran"

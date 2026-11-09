# Fixture audio — parser MP3 musik unggahan

Dipakai `tests/unit/lib/custom-music.test.ts` dan `tests/unit/music-upload.test.ts`
(DECISIONS #121). Semua berkas DIBUAT ffmpeg dari sinyal sintetis (nada + derau),
bukan rekaman/lagu siapa pun — aman di-commit. Lagu pustaka di `handoff/music/`
JANGAN disalin ke sini.

Dibuat dengan ffmpeg 8.1.2 (libmp3lame). Sumber bersama, 11,5 dtk:

```bash
SRC="aevalsrc=0.4*sin(2*PI*(300+200*sin(2*PI*0.3*t))*t)+0.05*(random(0)-0.5):s=44100:d=11.5"
F="ffmpeg -hide_banner -loglevel error -y"
```

| Berkas          | Isi                                                     | Perintah                                                                                                                                                                                                                                                                                             |
| --------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cbr-mpeg1.mp3` | MPEG-1 44,1 kHz mono 32 kbps CBR, tanpa tag/Xing        | `$F -f lavfi -i "$SRC" -ac 1 -c:a libmp3lame -b:a 32k -write_xing 0 -id3v2_version 0 -map_metadata -1 cbr-mpeg1.mp3`                                                                                                                                                                                 |
| `vbr-xing.mp3`  | MPEG-1 32 kHz mono VBR (`-q:a 9`) dengan frame Xing     | `$F -f lavfi -i "$SRC" -ac 1 -ar 32000 -c:a libmp3lame -q:a 9 -id3v2_version 0 -map_metadata -1 vbr-xing.mp3`                                                                                                                                                                                        |
| `mpeg2-22k.mp3` | MPEG-2 22,05 kHz mono 24 kbps                           | `$F -f lavfi -i "$SRC" -ac 1 -ar 22050 -c:a libmp3lame -b:a 24k -write_xing 0 -id3v2_version 0 -map_metadata -1 mpeg2-22k.mp3`                                                                                                                                                                       |
| `id3-cover.mp3` | seperti `cbr-mpeg1` + ID3v2.3 (judul, APIC) + ID3v1     | `$F -f lavfi -i "color=c=0xc08040:s=96x96" -frames:v 1 cover.png` lalu `$F -f lavfi -i "$SRC" -i cover.png -map 0:a -map 1:v -ac 1 -c:a libmp3lame -b:a 32k -write_xing 0 -c:v copy -id3v2_version 3 -write_id3v1 1 -metadata title="Lagu Uji" -metadata artist="Merriva" -metadata:s:v title="Album cover" -metadata:s:v comment="Cover (front)" id3-cover.mp3` |
| `short-3s.mp3`  | MP3 3 dtk (lolos parser, ditolak batas durasi)          | `$F -f lavfi -i "sine=frequency=440:sample_rate=44100:duration=3" -ac 1 -c:a libmp3lame -b:a 32k -write_xing 0 -id3v2_version 0 -map_metadata -1 short-3s.mp3`                                                                                                                                       |
| `aac.m4a`       | AAC dalam MP4 (harus ditolak `format`)                  | `$F -f lavfi -i "$SRC" -ac 1 -c:a aac -b:a 24k aac.m4a`                                                                                                                                                                                                                                              |
| `vorbis.ogg`    | Vorbis dalam OGG (harus ditolak `format`)               | `$F -f lavfi -i "$SRC" -ac 1 -ar 22050 -c:a libvorbis -q:a 0 vorbis.ogg`                                                                                                                                                                                                                             |
| `short.wav`     | PCM 8-bit 8 kHz 1 dtk (harus ditolak `format`)          | `$F -f lavfi -i "sine=frequency=440:sample_rate=8000:duration=1" -ac 1 -c:a pcm_u8 short.wav`                                                                                                                                                                                                        |

Durasi acuan di test = `ffprobe -show_entries format=duration` atas byte yang
DISIMPAN (`bytes.subarray(start, end)`). Byte ternormalisasi setiap fixture MP3
diverifikasi sekali dengan `ffmpeg -v error -i norm.mp3 -f null -` (tanpa galat).

Bila fixture dibuat ulang, angka di test (durasi, `start` = 412 untuk
`id3-cover.mp3`) WAJIB diukur ulang — ukuran tag bergantung versi ffmpeg.

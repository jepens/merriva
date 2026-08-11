"""
Merriva — produksi library musik instrumental (WAV 44.1kHz stereo 16-bit).
2 aransemen public domain (Canon in D, Gymnopedie No.1) + 4 komposisi original.
Semua disintesis dari nol -> hak rekaman & (utk original) komposisi milik Merriva.
"""
import numpy as np
import wave

SR = 44100
rng = np.random.default_rng(42)

# ---------------------------------------------------------------- util nada
NOTES = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5,
         "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}

def f(note):
    """'A4' -> Hz (A4=440)."""
    name = note[:-1]; octave = int(note[-1])
    semi = NOTES[name] + (octave - 4) * 12 - 9  # relatif A4
    return 440.0 * 2 ** (semi / 12)

def t(n):
    return np.arange(int(n * SR)) / SR

def env_ad(n, a, tau, rel=0.05):
    """attack linier + peluruhan eksponensial + release halus di ujung."""
    x = t(n)
    e = np.minimum(1, x / max(a, 1e-4)) * np.exp(-np.maximum(0, x - a) / tau)
    r = int(rel * SR)
    if r > 0 and len(e) > r:
        e[-r:] *= np.linspace(1, 0, r)
    return e

# ---------------------------------------------------------------- instrumen
def piano(freq, dur, vel=1.0, dark=False):
    x = t(dur + 0.4)
    amps = [1, .58, .32, .2, .12, .07, .045]
    if dark:
        amps = [1, .38, .14, .05]
    out = np.zeros_like(x)
    for k, a in enumerate(amps, start=1):
        det = 1 + (k * k) * 1.2e-4          # inharmonisitas ringan ala senar
        out += a * np.sin(2 * np.pi * freq * k * det * x)
    tau = 0.9 + 2.2 / (1 + freq / 220)      # nada rendah meluruh lebih lama
    out *= env_ad(dur + 0.4, 0.012 if dark else 0.005, tau) * vel
    return out

def pad(freq, dur, vel=1.0):
    x = t(dur)
    out = np.zeros_like(x)
    for det in (-4, 0, 4):                   # chorus 3 lapis
        fr = freq * 2 ** (det / 1200)
        for k, a in ((1, 1), (2, .18), (3, .12)):
            out += a * np.sin(2 * np.pi * fr * k * x + rng.uniform(0, 6.28))
    a = min(0.9, dur * 0.3); r = min(1.4, dur * 0.4)
    e = np.minimum(1, x / a) * np.minimum(1, (dur - x) / r)
    return out * e * vel * 0.33

def bell(freq, dur, vel=1.0, partials=((1, 1, 1.0), (2.756, .55, .5), (5.404, .26, .28), (8.933, .1, .16))):
    """metalofon/gamelan: parsial inharmonik, tiap parsial punya umur sendiri."""
    x = t(dur)
    out = np.zeros_like(x)
    for ratio, amp, life in partials:
        out += amp * np.sin(2 * np.pi * freq * ratio * x) * np.exp(-x / (dur * life * 0.55 + 0.05))
    strike = rng.normal(0, 1, len(x)) * np.exp(-x / 0.004) * 0.25
    out = (out + strike) * np.minimum(1, x / 0.002)
    r = int(0.04 * SR); out[-r:] *= np.linspace(1, 0, r)
    return out * vel

def musicbox(freq, dur, vel=1.0):
    return bell(freq, dur, vel, partials=((1, 1, .5), (3.01, .3, .3), (5.4, .08, .18)))

def gong(freq, dur, vel=1.0):
    x = t(dur)
    out = np.zeros_like(x)
    for ratio, amp in ((1, 1), (1.52, .6), (2.48, .3), (3.61, .15)):
        wob = 1 + 0.05 * np.sin(2 * np.pi * 2.7 * x)
        out += amp * np.sin(2 * np.pi * freq * ratio * x * wob) * np.exp(-x / (dur * 0.5))
    return out * np.minimum(1, x / 0.01) * vel

def pluck(freq, dur, vel=1.0):
    """Karplus-Strong sederhana."""
    n = int(dur * SR)
    d = max(2, int(SR / freq))
    buf = rng.uniform(-1, 1, d)
    out = np.empty(n)
    for i in range(n):
        out[i] = buf[i % d]
        buf[i % d] = 0.5 * (buf[i % d] + buf[(i + 1) % d]) * 0.996
    return out * env_ad(dur, 0.001, dur) * vel

def shaker(dur=0.06, vel=1.0):
    n = int(dur * SR)
    x = rng.normal(0, 1, n)
    x = np.diff(x, prepend=0)                # highpass kasar
    return x * np.hanning(n) * vel * 0.5

# ---------------------------------------------------------------- rendering
def place(buf, sig, start, pan=0.0, gain=1.0):
    """taruh sinyal mono ke buffer stereo dgn pan -1..1 (equal power)."""
    i = int(start * SR)
    seg = sig[: max(0, buf.shape[1] - i)]
    th = (pan + 1) * np.pi / 4
    buf[0, i:i + len(seg)] += seg * np.cos(th) * gain
    buf[1, i:i + len(seg)] += seg * np.sin(th) * gain

def reverb(buf, wet=0.24, decay=1.4):
    """konvolusi IR noise eksponensial (plate lembut), decorrelated L/R."""
    n = int(decay * SR)
    x = t(decay)
    irL = rng.normal(0, 1, n) * np.exp(-x / (decay * 0.35))
    irR = rng.normal(0, 1, n) * np.exp(-x / (decay * 0.35))
    for ir in (irL, irR):                     # redam nada tinggi (smoothing 2x)
        ir[1:] = 0.6 * ir[1:] + 0.4 * ir[:-1]
        ir[1:] = 0.6 * ir[1:] + 0.4 * ir[:-1]
    irL /= np.sqrt((irL ** 2).sum()); irR /= np.sqrt((irR ** 2).sum())
    m = buf.shape[1] + n - 1
    nfft = 1 << (m - 1).bit_length()
    out = np.zeros((2, m))
    for ch, ir in ((0, irL), (1, irR)):
        out[ch] = np.fft.irfft(np.fft.rfft(buf[ch], nfft) * np.fft.rfft(ir, nfft), nfft)[:m]
    dry = np.zeros((2, m)); dry[:, :buf.shape[1]] = buf
    return dry + wet * out

def master(buf, peak=0.87):
    buf = buf / (np.max(np.abs(buf)) + 1e-9) * peak
    return np.tanh(buf * 1.1) / np.tanh(1.1)  # soft ceiling halus

def write_wav(path, buf):
    data = (np.clip(buf, -1, 1).T * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(data.tobytes())
    print(f"  -> {path}  {buf.shape[1]/SR:.1f}s  peak={np.max(np.abs(buf)):.2f}")

def song(total_s):
    return np.zeros((2, int(total_s * SR)))

# ================================================================ 1. CANON IN D
def canon_in_d():
    bpm = 54; b = 60 / bpm
    bass = ["D3", "A2", "B2", "F#2", "G2", "D3", "G2", "A2"]
    tri = [["D4", "F#4", "A4"], ["A3", "C#4", "E4"], ["B3", "D4", "F#4"], ["F#3", "A3", "C#4"],
           ["G3", "B3", "D4"], ["D4", "F#4", "A4"], ["G3", "B3", "D4"], ["A3", "C#4", "E4"]]
    half = ["F#5", "E5", "D5", "C#5", "B4", "A4", "B4", "C#5",
            "D5", "C#5", "B4", "A4", "G4", "F#4", "G4", "E4"]     # 2 siklus, 1 nada/akor
    quar = ["D5 F#5", "E5 C#5", "D5 F#5", "C#5 A4", "B4 D5", "A4 F#4? ", "", ""]
    quarter = [["D5", "F#5"], ["C#5", "E5"], ["D5", "B4"], ["C#5", "A4"],
               ["B4", "D5"], ["A4", "F#5"], ["B4", "G4"], ["C#5", "E5"],
               ["F#5", "A5"], ["E5", "A4"], ["F#5", "D5"], ["C#5", "E5"],
               ["D5", "B4"], ["D5", "F#5"], ["B4", "D5"], ["C#5", "E5"]]  # 2 siklus, 2 nada/akor
    cycles = 6
    total = cycles * 8 * 2 * b + 6
    S = song(total)
    for c in range(cycles):
        for i in range(8):
            t0 = (c * 8 + i) * 2 * b
            place(S, piano(f(bass[i]), 2 * b, .9, dark=True), t0, pan=-.25, gain=.8)
            if c >= 1:                                   # pad akor masuk siklus ke-2
                for j, n in enumerate(tri[i]):
                    place(S, pad(f(n), 2 * b), t0, pan=(j - 1) * .4, gain=.5)
            k = (c % 2) * 8 + i                          # melodi
            if c in (1, 2):                              # nada setengah (half notes)
                place(S, piano(f(half[k]), 2 * b, .95), t0, pan=.15)
            elif c in (3, 4):                            # nada seperempat
                for j, n in enumerate(quarter[k]):
                    place(S, piano(f(n), b, .9), t0 + j * b, pan=.15)
            elif c == 5 and i < 4:                       # penutup: kembali tenang
                place(S, piano(f(half[i]), 2 * b, .8), t0, pan=.15)
        if c == 5:
            t_end = (c * 8 + 4) * 2 * b
            for j, n in enumerate(["D3", "A3", "D4", "F#4", "A4", "D5"]):
                place(S, piano(f(n), 5, .85, dark=(j < 2)), t_end + j * 0.06, pan=(j - 2.5) * .12)
            break
    return master(reverb(S, wet=.26, decay=1.8))

# ================================================================ 2. GYMNOPEDIE 1
def gymnopedie():
    bpm = 72; b = 60 / bpm; bar = 3 * b
    A_mel = [("F#5", 1), ("A5", 1), ("G5", 1), ("F#5", 1), ("C#5", 1), ("B4", 1),
             ("C#5", 1), ("D5", 1), ("A4", 1), ("A4", 3),
             ("F#5", 1), ("A5", 1), ("G5", 1), ("F#5", 1), ("C#5", 1), ("B4", 1),
             ("C#5", 1), ("D5", 1), ("A4", 1), ("A4", 3)]
    tail = [("B4", 1), ("C#5", 1), ("D5", 1), ("C#5", 1), ("B4", 1), ("A4", 1),
            ("F#4", 3), ("G4", 3)]
    bars = 4 + 8 + 8 + 4
    S = song(bars * bar + 6)
    for m in range(bars):                                # iringan khas: bass lalu akor
        t0 = m * bar
        if m % 2 == 0:
            place(S, piano(f("G2"), b, .8, dark=True), t0, pan=-.3, gain=.9)
            chord = ["F#3", "B3", "D4"]
        else:
            place(S, piano(f("D2"), b, .8, dark=True), t0, pan=-.3, gain=.9)
            chord = ["F#3", "A3", "C#4"]
        for j, n in enumerate(chord):
            place(S, piano(f(n), 2 * b, .55, dark=True), t0 + b, pan=-.1 + j * .1, gain=.8)
    beat = 4 * 3                                          # melodi masuk bar ke-5
    for n, d in A_mel + tail:
        place(S, piano(f(n), d * b + .3, .95), beat * b, pan=.2)
        beat += d
    place(S, pad(f("G3"), 5), (bars - 1) * bar, pan=0, gain=.4)
    return master(reverb(S, wet=.3, decay=2.2))

# ================================================================ 3. CAHAYA (original)
def cahaya():
    bpm = 63; b = 60 / bpm
    prog = [("C", ["C3", "G3", "E4", "G3"], ["C4", "E4", "G4"]),
            ("Am", ["A2", "E3", "C4", "E3"], ["A3", "C4", "E4"]),
            ("F", ["F2", "C3", "A3", "C3"], ["F3", "A3", "C4"]),
            ("G", ["G2", "D3", "B3", "D3"], ["G3", "B3", "D4"])]
    mel = [(None, 4)] * 1 + [  # masuk siklus ke-2 (16 beat kosong ditangani offset)
        ("E5", 2), ("G5", 2), ("A5", 2), ("G5", 1), ("E5", 1),
        ("D5", 2), ("C5", 2), ("D5", 3), (None, 1),
        ("E5", 2), ("G5", 2), ("A5", 2), ("C6", 2),
        ("G5", 2), ("E5", 1), ("D5", 1), ("C5", 4)]
    cycles = 5
    S = song(cycles * 16 * b + 6)
    for c in range(cycles):
        for i, (_, arp, chord) in enumerate(prog):
            t0 = (c * 16 + i * 4) * b
            for j in range(4):                            # arpeggio LH (felt)
                place(S, piano(f(arp[j]), b * 1.2, .6, dark=True), t0 + j * b, pan=-.2, gain=.9)
            if c >= 1:
                for j, n in enumerate(chord):             # pad hangat
                    place(S, pad(f(n), 4 * b), t0, pan=(j - 1) * .35, gain=.4)
    beat = 16                                             # melodi dari siklus ke-2
    for n, d in mel * 2:
        if beat * b > (cycles * 16 - 4) * b: break
        if n: place(S, piano(f(n), d * b + .4, .9), beat * b, pan=.15)
        beat += d
    tend = (cycles * 16 - 1) * b
    for j, n in enumerate(["C3", "G3", "E4", "D5", "G5"]):
        place(S, piano(f(n), 5, .8, dark=(j < 2)), tend + j * .07, pan=(j - 2) * .15)
    return master(reverb(S, wet=.28, decay=2.0))

# ================================================================ 4. KIRANA (original, slendro)
def kirana():
    bpm = 66; b = 60 / bpm
    base = 293.66                                          # pusat ~D4
    sl = [base * 2 ** (k * 240 / 1200) for k in range(-5, 7)]   # tangga slendro 5-TET
    def N(k): return sl[k + 5]
    balungan = [0, 2, 3, 2, 0, 2, 3, 5, 3, 2, 0, -1, 0, 2, 3, 2]   # 16 ketuk / gongan
    gongan = 5
    S = song(gongan * 16 * b + 7)
    for g in range(gongan):
        for i, k in enumerate(balungan):
            t0 = (g * 16 + i) * b
            place(S, bell(N(k), 2.2, .8), t0, pan=-.1)             # saron (inti)
            if g >= 1:                                              # imbal 8th di atasnya
                hi = k + 5 if k + 5 <= 6 else k + 1
                place(S, bell(N(hi), 1.0, .4), t0 + b / 2, pan=.35, gain=.8)
            if i % 4 == 2:                                          # kenong
                place(S, bell(N(k - 5) if k - 5 >= -5 else N(-5), 3.0, .5,
                              partials=((1, 1, 1), (2.31, .5, .6), (4.2, .2, .3))), t0, pan=-.4, gain=.9)
        place(S, gong(f("D2") * 0.99, 6.5, .9), (g * 16 + 15) * b, pan=0, gain=1.0)  # gong ageng
    return master(reverb(S, wet=.22, decay=1.6))

# ================================================================ 5. CERIA (original)
def ceria():
    bpm = 96; b = 60 / bpm
    bassline = ["C2", "G2", "A2", "E2", "F2", "C3", "G2", "G2"]     # 8 bar × 2 beat
    mel = ["C5", "E5", "G5", "E5", "A5", "G5", "E5", "D5",
           "C5", "E5", "G5", "A5", "G5", "E5", "D5", "C5",
           "E5", "G5", "A5", "C6", "A5", "G5", "E5", "G5",
           "A5", "G5", "E5", "D5", "C5", "D5", "E5", "C5"]          # 32 × 8th (4 bar)
    sections = 4
    S = song(sections * 16 * b + 4)
    for s in range(sections):
        for i, n in enumerate(bassline):
            t0 = (s * 16 + i * 2) * b
            place(S, pluck(f(n), 2 * b, .9), t0, pan=-.2, gain=1.1)
            place(S, pluck(f(n) * 2, b, .5), t0 + b, pan=-.35, gain=.7)   # oktaf ringan
        if s >= 1:
            for i, n in enumerate(mel):
                t0 = (s * 16 + i * 0.5) * b
                place(S, musicbox(f(n), 1.2, .85), t0, pan=.25)
        for i in range(16):                                          # shaker offbeat
            place(S, shaker(0.05, .6 if i % 2 else .3), (s * 16 + i + 0.5) * b, pan=.45)
    tend = sections * 16 * b
    for j, n in enumerate(["C3", "G3", "C4", "E5", "G5", "C6"]):
        place(S, musicbox(f(n), 3, .8) if j > 2 else pluck(f(n), 3, .8), tend + j * .05, pan=(j - 2.5) * .15)
    return master(reverb(S, wet=.18, decay=1.1))

# ================================================================ 6. TENANG (original)
def tenang():
    chords = [["F2", "F3", "A3", "C4", "E4"], ["A2", "A3", "C4", "E4", "G4"],
              ["Bb2", "Bb3", "D4", "F4", "A4"], ["C3", "C4", "E4", "G4", "Bb4"]]
    dur = 9.0
    passes = 2
    S = song(passes * 4 * dur + 10)
    for p in range(passes):
        for i, ch in enumerate(chords):
            t0 = (p * 4 + i) * dur
            for j, n in enumerate(ch):
                place(S, pad(f(n), dur + 2.5), t0, pan=(j - 2) * .3, gain=.55 if j else .8)
            place(S, piano(f(ch[1]) * 2, 4, .35, dark=True), t0 + dur * .5, pan=.1)  # sentuhan piano jarang
    t_end = passes * 4 * dur
    for j, n in enumerate(["F2", "F3", "A3", "C4"]):
        place(S, pad(f(n), 8), t_end, pan=(j - 1.5) * .3, gain=.7)
    return master(reverb(S, wet=.34, decay=2.6))

# ================================================================ render semua
TRACKS = {
    "canon-in-d": canon_in_d,
    "gymnopedie-no-1": gymnopedie,
    "cahaya": cahaya,
    "kirana": kirana,
    "ceria": ceria,
    "tenang": tenang,
}

if __name__ == "__main__":
    import sys, os
    os.makedirs("out", exist_ok=True)
    only = sys.argv[1:] or list(TRACKS)
    for name in only:
        print(f"render {name} ...")
        buf = TRACKS[name]()
        write_wav(f"out/{name}.wav", buf)

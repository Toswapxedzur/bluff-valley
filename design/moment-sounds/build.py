#!/usr/bin/env python3
"""Candidates for the animations' NEW sounds (owner, 2026-09-27: reuse existing sounds where they fit —
done in the game — and build candidates for the rest; the owner picks). Each candidate is a trimmed
library clip or a composition of clips (incl. the sounds already chosen), normalised to -3 dBFS, no
pitch change (time stretches use atempo). Writes clips/*.mp3 + candidates.json (with each clip's LEAD:
ms from its start to its main hit, so the game can land the hit on the frame).
Run from statisticasino/:  python3 design/moment-sounds/build.py"""
import json, os, subprocess, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); LIB = os.path.join(HERE, "..", "sfx-library", "audio")
STATIC = os.path.join(HERE, "..", "..", "static", "sfx"); SR = 44100
os.makedirs(os.path.join(HERE, "clips"), exist_ok=True); os.makedirs(os.path.join(HERE, "ctx"), exist_ok=True)

def src_path(s):
    if s.startswith("app:"): return os.path.join(STATIC, s[4:] + ".ogg")
    for ext in (".mp3", ".wav", ".ogg", ".flac", ".aif", ".m4a"):
        p = os.path.join(LIB, s + ext)
        if os.path.exists(p): return p
    raise FileNotFoundError(s)
def load(s, start=0.0, dur=None, tempo=1.0):
    args = ["ffmpeg", "-v", "error", "-ss", str(start)] + (["-t", str(dur / tempo if tempo != 1 else dur)] if dur else []) + ["-i", src_path(s)]
    af = []
    t = tempo
    while t < 0.5: af.append("atempo=0.5"); t /= 0.5
    if t != 1.0: af.append(f"atempo={t:.4f}")
    if af: args += ["-af", ",".join(af)]
    raw = subprocess.run(args + ["-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()
def env(y, ms=3):
    w = max(1, int(ms / 1000 * SR)); return np.sqrt(np.convolve(y ** 2, np.ones(w) / w, mode="same"))
def peak_at(y, first=False):
    e = env(y)
    if first:
        idx = np.where(e > 0.45 * e.max())[0]
        return int(idx[0]) if len(idx) else int(np.argmax(e))
    return int(np.argmax(e))
def fade(y, fin=0.004, fout=0.08):
    a, b = int(fin * SR), int(fout * SR)
    if a: y[:a] *= np.linspace(0, 1, a)
    if b and len(y) > b: y[-b:] *= np.linspace(1, 0, b)
    return y
def hit(s, length, first=True, pre=0.03, **kw):
    y = load(s, **kw); p = peak_at(y, first); a = max(0, p - int(pre * SR))
    return fade(y[a:a + int(length * SR)].copy())
def seg(s, start, length, **kw): return fade(load(s, start, length, **kw), 0.03, 0.25)
def layer(parts):
    """parts: [(clip, offset_ms, gain)] mixed into one."""
    n = max(int(o / 1000 * SR) + len(c) for c, o, g in parts); out = np.zeros(n, dtype=np.float32)
    for c, o, g in parts: i = int(o / 1000 * SR); out[i:i + len(c)] += c * g
    return out
def save(name, y):
    y = np.concatenate([y, np.zeros(int(0.06 * SR), dtype=np.float32)]); y = y * (10 ** (-3 / 20) / (np.abs(y).max() or 1))
    wav = os.path.join(HERE, "clips", name + ".wav")
    import wave
    with wave.open(wav, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(y, -1, 1) * 32767).astype("<i2").tobytes())
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-q:a", "4", os.path.join(HERE, "clips", name + ".mp3")], check=True)
    os.remove(wav)
    return {"file": f"clips/{name}.mp3", "lead": round(float(np.argmax(env(y)) / SR * 1000), 1), "dur": round(len(y) / SR * 1000)}

S = {}
def slot(key, label, where, cands):
    S[key] = {"label": label, "where": where, "candidates": [{"name": n, **save(f"{key}-{i}", y)} for i, (n, y) in enumerate(cands)]}

# ---- ROUND 2 (2026-09-27): the owner picked 9 slots (now in the game); the 4 below had no good option
# in round 1 and get a different direction each. The picked clips join the contexts (ctx/pick_*.mp3).
S["picked"] = {"allInSlam": "A", "buttonTap": "A", "ballRoll": "C", "ballSettle": "A", "medalClink": "C", "ringSet": "A", "lowThud": "B", "stampHit": "B", "coinShower": "B"}
PICK = lambda f: load("app:table/" + f)
def ticks(click, gaps):
    """A reel spinning: the reel-stop click repeating, slowing (gaps in ms)."""
    parts, t = [], 0
    for g in gaps: parts.append((click, t, 1.0)); t += g
    return layer(parts)
reel_click = hit("app:reel-1", 0.05)
slot("cardKnock", "Bust", "your own hand busts (the shake) — round 2: card sounds, not hits", [
    ("A card shoved away (Kenney)", hit("kenney-casino-card-shove-2", 0.6)),
    ("A firm card placement", hit("mixkit-2001", 0.6)),
    ("Your fold tap + your low thud, soft", layer([(PICK("card-pile"), 0, 1.0), (PICK("low-thud"), 0, 0.45)]))])
slot("reelSpin", "Slot reels spinning", "until the first reel stops — round 2: mechanical, no electronics", [
    ("A fishing reel, fast", seg("bsb-1435", 0.4, 1.5)),
    ("A pistol cylinder spinning", seg("fs-675633", 0.5, 1.5)),
    ("Your reel-stop click, repeating and slowing", ticks(reel_click, [55] * 8 + [65] * 5 + [80] * 4 + [100] * 3 + [125] * 2))])
slot("squeeze", "The river squeeze", "the all-in showdown's last card turning slowly — round 2: natural speed", [
    ("A card fanned slowly (Kenney)", seg("kenney-casino-card-fan-2", 0.0, 1.25)),
    ("An index card turned by hand", seg("fs-339015", 0.3, 1.1)),
    ("A soft slide, then your flip", layer([(hit("kenney-casino-card-slide-5", 0.6), 0, 0.7), (PICK("card-flip"), 650, 1.0)]))])
slot("revealHit", "A rare hand's name", "four of a kind / straight flush / royal appearing — round 2: from your own sounds", [
    ("Your all-in slam", PICK("allin-slam")),
    ("Your low thud + a card slam", layer([(PICK("low-thud"), 0, 1.0), (PICK("card-play"), 250, 1.0)])),
    ("A card placed + your clay chips", layer([(hit("kenney-casino-card-place-3", 0.6), 0, 1.0), (PICK("coin-few-1"), 40, 0.8)]))])

# the sounds already in the game that the "in context" sequences play around each candidate
for f in ["ball-roll", "ball-settle", "low-thud", "stamp-hit", "coin-shower", "allin-slam"]:
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(STATIC, "table", f + ".ogg"), "-q:a", "4", os.path.join(HERE, "ctx", "pick_" + f + ".mp3")], check=True)
ctx = ["table/coin-few-1", "table/coin-pile-1", "table/card-deal", "table/card-flip", "table/card-pile", "table/card-play", "table/coin-one-1", "reel-1", "fanfare", "check", "coins"]
for c in ctx:
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(STATIC, c + ".ogg"), "-q:a", "4", os.path.join(HERE, "ctx", c.replace("/", "_") + ".mp3")], check=True)
json.dump(S, open(os.path.join(HERE, "candidates.json"), "w"), indent=1)
print(len(S) - 1, "open slots,", sum(len(v["candidates"]) for k, v in S.items() if k != "picked"), "candidates")

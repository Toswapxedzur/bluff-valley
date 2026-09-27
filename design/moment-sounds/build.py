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
os.makedirs(os.path.join(HERE, "clips"), exist_ok=True)

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

THUD = lambda: hit("mixkit-1989", 0.6)                       # a money bag landing: the low thud family
S = {}
def slot(key, label, where, cands):
    S[key] = {"label": label, "where": where, "candidates": [{"name": n, **save(f"{key}-{i}", y)} for i, (n, y) in enumerate(cands)]}

slot("allInSlam", "All-in drop", "the whole pile slams down (replaces the old push sound)", [
    ("Your clay-chip pile + a money-bag thud", layer([(load("app:table/coin-pile-2"), 0, 1.0), (THUD(), 10, 0.8)])),
    ("Poker chips dropping — one heavy hit", hit("fs-383870", 0.9, first=False)),
    ("Chip drop + cards pounded on the table", layer([(hit("fs-540369", 0.6), 0, 1.0), (hit("fs-466789", 0.5), 0, 0.8)]))])
slot("cardKnock", "Bust", "your own hand busts (the shake)", [
    ("Card deck hit", hit("mixkit-1994", 0.45)),
    ("Cards pounded on a table", hit("fs-466789", 0.45)),
    ("Paper cards, a dull hit", hit("aod-paper-cards-04", 0.35))])
slot("buttonTap", "Dealer button lands", "D / SB / BB reach their new seats (very quiet)", [
    ("Your table knock (the check), quiet", hit("app:check", 0.3)),
    ("A small ball tap", hit("mixkit-2073", 0.3)),
    ("A card tap", hit("aod-paper-cards-09", 0.25))])
slot("ballRoll", "Roulette ball rolling", "while the wheel spins (fades as it slows)", [
    ("Casino roulette ball", seg("mixkit-1987", 0.0, 2.3)),
    ("Roulette wheel (poenia)", seg("fs-709624", 0.5, 2.3)),
    ("Roulette wheel spin loop", seg("fs-482663", 0.0, 2.3))])
slot("ballSettle", "Ball drops into the pocket", "the ball settles (the number pops out)", [
    ("Ball damping (poenia)", hit("fs-709623", 0.35)),
    ("End of a spin (poenia)", seg("fs-709621", 2.6, 1.2)),
    ("Casino roulette ball — its end", seg("mixkit-1987", 2.3, 1.0))])
slot("reelSpin", "Slot reels spinning", "until the first reel stops (the stops keep their clicks)", [
    ("Slot machine wheel", seg("mixkit-1932", 0.0, 1.5)),
    ("Arcade slot machine wheel", seg("mixkit-1933", 0.0, 1.5)),
    ("Slot machine random wheel", seg("mixkit-1930", 0.0, 1.5))])
slot("medalClink", "Achievement toast", "the toast slides in", [
    ("A natural metal coin", hit("fs-400116", 0.8)),
    ("A coin dropped on a table", hit("fs-510735", 1.0)),
    ("A real coin drop", hit("fs-343462", 0.3))])
slot("ringSet", "A ring lands", "equipping a ring; the new-look ring dropping onto your avatar", [
    ("Metallic lock", hit("mixkit-2858", 0.5)),
    ("Metal bar hit", hit("mixkit-3138", 0.5)),
    ("A coin drop + your table knock", layer([(hit("fs-343462", 0.3), 0, 1.0), (hit("app:check", 0.3), 0, 0.5)]))])
slot("squeeze", "The river squeeze", "the all-in showdown's last card turning slowly (1.1 s)", [
    ("Card slide, slowed", seg("fs-843344", 0.0, 1.1, tempo=0.5)),
    ("Your deal slide (Kenney 3), slowed", hit("kenney-casino-card-slide-3", 1.1, tempo=0.5)),
    ("Index card flips, slowed", hit("fs-319154", 1.1, tempo=0.6))])
slot("lowThud", "Low thud", "the suck-out's jolt, a knocked-out plate dropping, the banner opening", [
    ("Money bag drop", hit("mixkit-1989", 0.6)),
    ("Cards pounded on a table", hit("fs-466789", 0.5)),
    ("A stomp impact", hit("mixkit-3057", 0.9))])
slot("revealHit", "A rare hand's name", "four of a kind / straight flush / royal appearing", [
    ("Thud + clinking coins", layer([(THUD(), 0, 1.0), (hit("mixkit-1993", 0.8), 40, 0.6)])),
    ("Pounded cards + a light coin shower", layer([(hit("fs-466789", 0.5), 0, 1.0), (seg("fs-728430", 0.4, 0.9), 30, 0.5)])),
    ("Metal bar hits", hit("mixkit-3138", 1.0))])
slot("stampHit", "Jackpot multiplier stamp", "the ×35 / ×100 slamming in", [
    ("Money-bag thud + your table knock", layer([(THUD(), 0, 1.0), (hit("app:check", 0.3), 0, 0.7)])),
    ("A fast punch", hit("mixkit-2047", 0.5)),
    ("A heavy thud (slot machine punches)", hit("fs-637820", 0.6))])
slot("coinShower", "Coin fountain", "the jackpot's coins bursting up and raining down", [
    ("A light coin shower", seg("fs-728430", 0.2, 1.6)),
    ("Coins spilling", seg("fs-569073", 0.2, 1.6)),
    ("Coins falling", seg("fs-621103", 0.2, 1.6))])

# the sounds already in the game that the "in context" sequences play around each candidate
ctx = ["table/coin-few-1", "table/coin-pile-1", "table/card-deal", "table/card-flip", "table/card-pile", "table/card-play", "table/coin-one-1", "reel-1", "fanfare", "check", "coins"]
os.makedirs(os.path.join(HERE, "ctx"), exist_ok=True)
for c in ctx:
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(STATIC, c + ".ogg"), "-q:a", "4", os.path.join(HERE, "ctx", c.replace("/", "_") + ".mp3")], check=True)
json.dump(S, open(os.path.join(HERE, "candidates.json"), "w"), indent=1)
print(len(S), "slots,", sum(len(v["candidates"]) for v in S.values()), "candidates")
